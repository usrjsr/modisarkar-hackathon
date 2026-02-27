import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'
import PersonnelModel from '@/lib/db/models/Personnel'
import DeploymentModel from '@/lib/db/models/Deployment'
import IncidentModel from '@/lib/db/models/Incident'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import { resolveIncident } from '@/lib/algorithms/deficitResolver'
import { buildAdjacencyMap } from '@/lib/algorithms/graph/adjacencyBuilder'
import type { Zone, ZoneSnapshot, ZoneAllocation } from '@/lib/types/zone'
import type { Personnel } from '@/lib/types/personnel'

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { zoneId, newDensityScore, shift, shiftStart, incidentId } = body

    if (!zoneId || newDensityScore === undefined || !shift || !shiftStart) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: zoneId, newDensityScore, shift, shiftStart' },
        { status: 400 }
      )
    }

    const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
    if (!config) {
      return NextResponse.json({ success: false, error: 'SystemConfig not found' }, { status: 404 })
    }

    const allZones = await ZoneModel.find({ isActive: true })
    if (!allZones.length) {
      return NextResponse.json({ success: false, error: 'No active zones found' }, { status: 404 })
    }

    const affectedZoneDoc = allZones.find(z => z._id.toString() === zoneId)
    if (!affectedZoneDoc) {
      return NextResponse.json({ success: false, error: 'Affected zone not found' }, { status: 404 })
    }

    const zonesPlain = allZones.map(z => z.toObject()) as Zone[]
    const affectedZone = zonesPlain.find(z => z._id === zoneId)!

    const adjacencyMap = buildAdjacencyMap(zonesPlain, 'macro')
    for (const zone of zonesPlain) {
      zone.adjacency = (adjacencyMap[zone._id] ?? []).map(e => e.zoneId)
    }

    const shiftDate = new Date(shiftStart)

    const allDeployments = await DeploymentModel.find({
      date: {
        $gte: new Date(shiftDate.toDateString()),
        $lt: new Date(new Date(shiftDate).setDate(shiftDate.getDate() + 1)),
      },
      shift,
    }).populate('personnel.officerId')

    const deployedPersonnel = new Map<string, Personnel[]>()
    const allAllocations: ZoneAllocation[] = []

    for (const zone of zonesPlain) {
      const deployment = allDeployments.find(d => d.zoneId.toString() === zone._id)
      const officers: Personnel[] = deployment
        ? deployment.personnel.map((p: Record<string, unknown>) => p.officerId).filter(Boolean)
        : []
      deployedPersonnel.set(zone._id, officers)

      allAllocations.push({
        zoneId: zone._id,
        zScore: zone.zScore ?? 0,
        allocation: zone.currentDeployment ?? 0,
        safeThreshold: zone.safeThreshold ?? 0,
        heatmapColor: zone.heatmapColor ?? 'green',
      })
    }

    const standbyOfficers = await PersonnelModel.find({
      status: 'Standby',
      nextAvailableAt: { $lte: shiftDate },
    })
    const standbyPool = standbyOfficers.map(o => o.toObject()) as Personnel[]

    const allZoneSnapshots: ZoneSnapshot[] = zonesPlain.map(zone => ({
      zone,
      currentDeployment: deployedPersonnel.get(zone._id)?.length ?? 0,
      safeThreshold: zone.safeThreshold ?? 0,
    }))

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

    await ZoneModel.findByIdAndUpdate(zoneId, {
      densityScore: newDensityScore,
      currentDeployment: (deployedPersonnel.get(zoneId)?.length ?? 0) + result.troopsResolved,
      heatmapColor: result.newZScore >= 7.5 ? 'red'
        : result.newZScore >= 5 ? 'orange'
          : result.newZScore >= 2.5 ? 'yellow'
            : 'green',
      $inc: { version: 1 },
    })

    if (result.movedPersonnel.length > 0) {
      const affectedDeployment = await DeploymentModel.findOne({
        zoneId,
        date: {
          $gte: new Date(shiftDate.toDateString()),
          $lt: new Date(new Date(shiftDate).setDate(shiftDate.getDate() + 1)),
        },
        shift,
      })

      if (affectedDeployment) {
        await DeploymentModel.findByIdAndUpdate(
          affectedDeployment._id,
          {
            $push: { personnel: { $each: result.movedPersonnel } },
            totalStrength: affectedDeployment.totalStrength + result.troopsResolved,
            deficit: Math.max(0, affectedDeployment.deficit - result.troopsResolved),
            status: result.remainingDeficit > 0 ? 'Critical' : 'Modified',
            $inc: { version: 1 },
          }
        )
      }
    }

    if (incidentId) {
      await IncidentModel.findByIdAndUpdate(incidentId, {
        'resolution.status': result.status,
        'resolution.steps': result.steps,
        'resolution.finalStrength': (deployedPersonnel.get(zoneId)?.length ?? 0) + result.troopsResolved,
        'resolution.deficitResolved': result.remainingDeficit === 0,
        'resolution.remainingDeficit': result.remainingDeficit,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        status: result.status,
        deltaT: result.deltaT,
        troopsResolved: result.troopsResolved,
        remainingDeficit: result.remainingDeficit,
        steps: result.steps,
        warningMessage: result.warningMessage,
        movedPersonnel: result.movedPersonnel,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Redistribution failed' }, { status: 500 })
  }
}