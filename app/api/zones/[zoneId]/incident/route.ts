import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import mongoose from 'mongoose'
import ZoneModel from '@/lib/db/models/Zone'
import PersonnelModel from '@/lib/db/models/Personnel'
import IncidentModel from '@/lib/db/models/Incident'
import DeploymentModel from '@/lib/db/models/Deployment'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import { recalculateZoneScore, calculateDeficit } from '@/lib/algorithms/proportionalDistributor'
import { resolveIncident } from '@/lib/algorithms/deficitResolver'
import { buildAdjacencyMap } from '@/lib/algorithms/graph/adjacencyBuilder'
import type { Zone, ZoneSnapshot, ZoneAllocation } from '@/lib/types/zone'
import type { Personnel } from '@/lib/types/personnel'
import { FIELD_DEPLOYABLE_RANKS } from '@/lib/constants/ranks'

interface Params {
  params: Promise<{ zoneId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { zoneId } = await params

    const body = await req.json()
    const { newDensityScore, shift, shiftStart, triggeredBy } = body

    if (!newDensityScore || !shift || !shiftStart) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: newDensityScore, shift, shiftStart' },
        { status: 400 }
      )
    }

    if (newDensityScore < 1 || newDensityScore > 10) {
      return NextResponse.json(
        { success: false, error: 'newDensityScore must be between 1 and 10' },
        { status: 400 }
      )
    }

    // ── Load zone and system config ──
    const zone = await ZoneModel.findById(zoneId)
    if (!zone) {
      return NextResponse.json({ success: false, error: 'Zone not found' }, { status: 404 })
    }
    if (!zone.isActive) {
      return NextResponse.json({ success: false, error: 'Zone is not active' }, { status: 400 })
    }

    const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
    if (!config) {
      return NextResponse.json({ success: false, error: 'SystemConfig not found' }, { status: 404 })
    }

    const shiftDate = new Date(shiftStart)

    // ── Build zone/allocation data ──
    const allZones = await ZoneModel.find({ isActive: true })
    const zonesPlain = allZones.map(z => {
      const o = z.toObject()
      return { ...o, _id: o._id.toString() } as Zone
    })
    const affectedZone = zonesPlain.find(z => z._id === zoneId)!

    // Hydrate adjacency
    const adjacencyMap = buildAdjacencyMap(zonesPlain, 'macro')
    for (const zp of zonesPlain) {
      zp.adjacency = (adjacencyMap[zp._id] ?? []).map(e => e.zoneId)
      zp.distanceMatrix = (adjacencyMap[zp._id] ?? []).map(e => ({
        zoneId: e.zoneId,
        distanceKm: e.distanceKm,
        travelTimeMinutes: e.travelTimeMinutes,
      }))
    }

    const allAllocations: ZoneAllocation[] = zonesPlain.map(z => ({
      zoneId: z._id,
      zScore: z.zScore ?? 0,
      allocation: z.allocation ?? 0,
      safeThreshold: z.safeThreshold ?? 0,
      heatmapColor: z.heatmapColor ?? 'green',
    }))

    // ── Calculate deficit ──
    const currentStrength = zone.currentDeployment ?? 0
    const { newRequirement, delta, newZScore } = calculateDeficit(
      affectedZone,
      newDensityScore,
      currentStrength,
      allAllocations,
      config.weights,
    )
    const { heatmapColor } = recalculateZoneScore(
      zone.sizeScore,
      newDensityScore,
      config.weights,
    )

    // ── Create incident record ──
    const incident = await IncidentModel.create({
      zoneId,
      triggeredBy: triggeredBy ?? null,
      triggeredAt: new Date(),
      originalDensity: zone.densityScore,
      newDensity: newDensityScore,
      delta: newDensityScore - zone.densityScore,
      resolution: {
        status: 'Pending',
        steps: [],
        finalStrength: currentStrength,
        deficitResolved: false,
        remainingDeficit: Math.max(0, delta),
      },
      manualOverride: { applied: false, by: null, notes: '', troopsAdded: 0 },
    })

    // ── Update zone density immediately ──
    await ZoneModel.findOneAndUpdate(
      { _id: zoneId, version: zone.version },
      {
        densityScore: newDensityScore,
        zScore: newZScore,
        heatmapColor,
        $inc: { version: 1 },
      },
    )

    // ── AUTO-RESOLVE if deficit > 0 ──
    let resolutionData = null
    if (delta > 0) {
      // Build deployed personnel map and zone snapshots
      const deployedPersonnel = new Map<string, Personnel[]>()
      for (const zp of zonesPlain) {
        const officers = await PersonnelModel.find({
          currentZones: zp._id,
          status: 'Deployed',
          rank: { $in: FIELD_DEPLOYABLE_RANKS },
        }).lean()
        deployedPersonnel.set(
          zp._id,
          officers.map(o => ({ ...o, _id: o._id.toString() })) as Personnel[]
        )
      }

      const standbyOfficers = await PersonnelModel.find({
        status: 'Standby',
        rank: { $in: FIELD_DEPLOYABLE_RANKS },
      }).lean()
      const standbyPool = standbyOfficers.map(o => ({
        ...o,
        _id: o._id.toString(),
      })) as Personnel[]

      const allZoneSnapshots: ZoneSnapshot[] = zonesPlain.map(zp => ({
        zone: zp,
        currentDeployment: deployedPersonnel.get(zp._id)?.length ?? 0,
        safeThreshold: zp.safeThreshold ?? 0,
      }))

      // Run the cascading resolution (Step A → B → C)
      const result = resolveIncident({
        affectedZone,
        newDensityScore,
        shift,
        shiftStart: shiftDate,
        allZoneSnapshots,
        allAllocations,
        deployedPersonnel,
        standbyPool,
        weights: config.weights,
      })

      // ── Apply resolution to DB ──
      // Move personnel to affected zone and update their currentZones
      if (result.movedPersonnel.length > 0) {
        const movedIds = result.movedPersonnel.map(p =>
          new mongoose.Types.ObjectId(String(p.officerId))
        )
        const zoneObjectId = new mongoose.Types.ObjectId(zoneId)

        // Update moved personnel: add affected zone to currentZones, set Deployed
        await PersonnelModel.updateMany(
          { _id: { $in: movedIds } },
          { $set: { status: 'Deployed' }, $addToSet: { currentZones: zoneObjectId } },
        )

        // Remove source zones from moved officers (they've been reassigned)
        for (const step of result.steps) {
          if (step.step === 'A' && step.sourceZones.length > 0) {
            for (const sourceId of step.sourceZones) {
              const sourceZoneOid = new mongoose.Types.ObjectId(sourceId)
              await PersonnelModel.updateMany(
                { _id: { $in: movedIds } },
                { $pull: { currentZones: sourceZoneOid } },
              )
            }
          }
        }
      }

      // Update standby officers that were deployed (Step B)
      for (const step of result.steps) {
        if (step.step === 'B') {
          const standbyMoved = result.movedPersonnel
            .filter(p => !result.steps.some(s => s.step === 'A' && s.sourceZones.length > 0))
          if (standbyMoved.length > 0) {
            const standbyIds = standbyMoved.map(p => new mongoose.Types.ObjectId(String(p.officerId)))
            const zoneObjectId = new mongoose.Types.ObjectId(zoneId)
            await PersonnelModel.updateMany(
              { _id: { $in: standbyIds } },
              { $set: { status: 'Deployed', currentZones: [zoneObjectId] } },
            )
          }
        }
      }

      // Update affected zone's currentDeployment
      await ZoneModel.findByIdAndUpdate(zoneId, {
        currentDeployment: currentStrength + result.troopsResolved,
      })

      // Update source zones' currentDeployment (subtract siphoned troops)
      for (const step of result.steps) {
        if (step.step === 'A' && step.sourceZones.length > 0) {
          for (const sourceId of step.sourceZones) {
            const sourcePersonnelCount = deployedPersonnel.get(sourceId)?.length ?? 0
            // We moved some troops away, update count
            const troopsPerSource = Math.ceil(step.troopsMoved / step.sourceZones.length)
            await ZoneModel.findByIdAndUpdate(sourceId, {
              currentDeployment: Math.max(0, sourcePersonnelCount - troopsPerSource),
            })
          }
        }
      }

      // Update incident resolution
      await IncidentModel.findByIdAndUpdate(incident._id, {
        'resolution.status': result.status,
        'resolution.steps': result.steps,
        'resolution.finalStrength': currentStrength + result.troopsResolved,
        'resolution.deficitResolved': result.remainingDeficit === 0,
        'resolution.remainingDeficit': result.remainingDeficit,
      })

      resolutionData = {
        status: result.status,
        troopsResolved: result.troopsResolved,
        remainingDeficit: result.remainingDeficit,
        steps: result.steps,
        warningMessage: result.warningMessage,
        movedPersonnelCount: result.movedPersonnel.length,
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        incidentId: incident._id,
        zoneId,
        originalDensity: zone.densityScore,
        newDensity: newDensityScore,
        newZScore,
        deltaT: delta,
        newRequirement,
        currentStrength,
        heatmapColor,
        resolution: resolutionData,
        message: delta > 0
          ? `Deficit of ${delta} resolved via auto-resolution.`
          : 'No deficit — zone is adequately staffed at new density.',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Incident trigger error:', error)
    return NextResponse.json({ success: false, error: 'Failed to trigger incident' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { zoneId } = await params

    const incidents = await IncidentModel
      .find({ zoneId })
      .sort({ triggeredAt: -1 })
      .limit(20)

    return NextResponse.json({ success: true, data: incidents })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch incidents' }, { status: 500 })
  }
}