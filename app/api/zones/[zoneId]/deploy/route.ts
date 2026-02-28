import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'
import PersonnelModel from '@/lib/db/models/Personnel'
import DeploymentModel from '@/lib/db/models/Deployment'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import { distributeForce } from '@/lib/algorithms/proportionalDistributor'
import { sortByEligibility } from '@/lib/algorithms/fatigueCalculator'
import { buildAndApplyAdjacency } from '@/lib/algorithms/graph/adjacencyBuilder'
import { FIELD_DEPLOYABLE_RANKS, MIN_ZONE_COMPOSITION, STRATEGIC_LEVEL, ZONE_MANAGER_LEVEL } from '@/lib/constants/ranks'
import type { Zone } from '@/lib/types/zone'
import type { Personnel } from '@/lib/types/personnel'

interface Params {
  params: Promise<{ zoneId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { zoneId } = await params

    const body = await req.json()
    const { shift, date, lockedBy } = body

    if (!shift || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: shift, date' },
        { status: 400 }
      )
    }

    const shiftDate = new Date(date)

    const zone = await ZoneModel.findById(zoneId)
    if (!zone) {
      return NextResponse.json({ success: false, error: 'Zone not found' }, { status: 404 })
    }

    if (!zone.isActive) {
      return NextResponse.json({ success: false, error: 'Zone is not active' }, { status: 400 })
    }

    const existing = await DeploymentModel.findOne({
      zoneId: zoneId,
      date: {
        $gte: new Date(shiftDate.toDateString()),
        $lt: new Date(new Date(shiftDate).setDate(shiftDate.getDate() + 1)),
      },
      shift,
    })

    if (existing) {
      if (existing.lockedBy && existing.lockedBy.toString() !== lockedBy) {
        return NextResponse.json(
          { success: false, error: 'Deployment is locked by another admin', code: 'LOCKED' },
          { status: 423 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'Deployment already exists for this zone/shift/date', code: 'DUPLICATE' },
        { status: 409 }
      )
    }

    const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
    if (!config) {
      return NextResponse.json({ success: false, error: 'SystemConfig not found' }, { status: 404 })
    }

    const allZones = await ZoneModel.find({ isActive: true })
    const zonesPlain = allZones.map(z => z.toObject()) as Zone[]
    const { zones: hydrated } = buildAndApplyAdjacency(zonesPlain, 'macro')

    const distribution = distributeForce({
      totalForce: config.totalForce,
      zones: hydrated,
      weights: config.weights,
    })

    const zoneAllocation = distribution.allocations.find(
      a => a.zoneId === zoneId
    )

    if (!zoneAllocation) {
      return NextResponse.json(
        { success: false, error: 'Could not calculate allocation for zone' },
        { status: 500 }
      )
    }

    const shiftStartHour: Record<string, number> = {
      morning: 6,
      evening: 14,
      night: 22,
    }

    const shiftStart = new Date(shiftDate)
    shiftStart.setHours(shiftStartHour[shift], 0, 0, 0)

    // Query ALL field-deployable personnel (not just those with matching homeZone/currentZone)
    const availablePersonnel = await PersonnelModel.find({
      rank: { $in: FIELD_DEPLOYABLE_RANKS },
      status: { $in: ['Active', 'Standby'] },
      $or: [
        { nextAvailableAt: { $lte: shiftStart } },
        { nextAvailableAt: null },
      ],
    })

    const personnelPlain = availablePersonnel.map(p => p.toObject()) as Personnel[]
    const sorted = sortByEligibility(personnelPlain, zoneAllocation.heatmapColor, shiftStart)

    const deployed: Record<string, unknown>[] = []
    const assignedIds = new Set<string>()

    const compositionRanks = Object.keys(MIN_ZONE_COMPOSITION) as Array<keyof typeof MIN_ZONE_COMPOSITION>
    for (const rank of compositionRanks) {
      const required = MIN_ZONE_COMPOSITION[rank]
      const candidates = sorted.filter(o => o.rank === rank && !assignedIds.has(o._id))

      for (let i = 0; i < Math.min(required, candidates.length); i++) {
        const officer = candidates[i]
        deployed.push({
          officerId: officer._id,
          rank: officer.rank,
          role: 'ZoneManager',
          isReserve: false,
          deployedAt: shiftStart,
          fatigueAtDeployment: officer.fatigueScore,
        })
        assignedIds.add(officer._id)
      }
    }

    const remaining = zoneAllocation.allocation - deployed.length
    const sectorCandidates = sorted.filter(
      o => !assignedIds.has(o._id) && o.commandLevel === 'SectorDuty'
    )

    for (let i = 0; i < Math.min(remaining, sectorCandidates.length); i++) {
      const officer = sectorCandidates[i]
      deployed.push({
        officerId: officer._id,
        rank: officer.rank,
        role: 'SectorDuty',
        isReserve: false,
        deployedAt: shiftStart,
        fatigueAtDeployment: officer.fatigueScore,
      })
      assignedIds.add(officer._id)
    }

    const totalStrength = deployed.length
    const requiredStrength = zoneAllocation.allocation
    const deficit = requiredStrength - totalStrength

    const deployment = await DeploymentModel.create({
      zoneId: zoneId,
      date: shiftDate,
      shift,
      personnel: deployed,
      totalStrength,
      requiredStrength,
      deficit,
      status: deficit > 0 ? 'Modified' : 'Scheduled',
      lockedBy: lockedBy ?? null,
      lockedAt: lockedBy ? new Date() : null,
      version: 0,
      modifiedBy: lockedBy ?? null,
    })

    // Assign zones based on rank hierarchy
    const allZoneIds = (await ZoneModel.find({ isActive: true }).select('_id').lean()).map((z: { _id: { toString: () => string } }) => z._id.toString())
    const targetZone = await ZoneModel.findById(zoneId).lean() as Zone | null
    const adjacentZoneIds = targetZone?.adjacency ?? []

    // Group deployed officers by their command level
    const strategicIds: string[] = []
    const zoneManagerIds: string[] = []
    const sectorDutyIds: string[] = []

    for (const d of deployed) {
      const rank = d.rank as string
      if ((STRATEGIC_LEVEL as readonly string[]).includes(rank)) {
        strategicIds.push(d.officerId as string)
      } else if ((ZONE_MANAGER_LEVEL as readonly string[]).includes(rank)) {
        zoneManagerIds.push(d.officerId as string)
      } else {
        sectorDutyIds.push(d.officerId as string)
      }
    }

    const shiftEndTime = new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000)

    // DIG/SP → all zones
    if (strategicIds.length > 0) {
      await PersonnelModel.updateMany(
        { _id: { $in: strategicIds } },
        {
          status: 'Deployed',
          $addToSet: { currentZones: { $each: allZoneIds } },
          lastShiftEnd: shiftEndTime,
          $inc: { totalDeployments: 1 },
        }
      )
    }

    // DSP/ASP/Inspector → target zone + up to 2 adjacent zones (max 3)
    if (zoneManagerIds.length > 0) {
      const clusterIds = [zoneId, ...adjacentZoneIds.slice(0, 2)]
      await PersonnelModel.updateMany(
        { _id: { $in: zoneManagerIds } },
        {
          status: 'Deployed',
          $addToSet: { currentZones: { $each: clusterIds } },
          lastShiftEnd: shiftEndTime,
          $inc: { totalDeployments: 1 },
        }
      )
    }

    // SI/ASI/HeadConstable/Constable → single zone
    if (sectorDutyIds.length > 0) {
      await PersonnelModel.updateMany(
        { _id: { $in: sectorDutyIds } },
        {
          status: 'Deployed',
          $addToSet: { currentZones: zoneId },
          lastShiftEnd: shiftEndTime,
          $inc: { totalDeployments: 1 },
        }
      )
    }

    await ZoneModel.findByIdAndUpdate(zoneId, {
      currentDeployment: totalStrength,
      $inc: { version: 1 },
    })

    return NextResponse.json({
      success: true,
      data: {
        deploymentId: deployment._id,
        zoneId: zoneId,
        shift,
        date: shiftDate,
        totalStrength,
        requiredStrength,
        deficit,
        status: deployment.status,
        violations: distribution.violations,
      },
    }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create deployment' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { zoneId } = await params

    const deployments = await DeploymentModel
      .find({ zoneId })
      .sort({ date: -1, shift: 1 })
      .populate('personnel.officerId', 'name rank badgeNumber fatigueScore')
      .limit(90)

    return NextResponse.json({ success: true, data: deployments })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch deployments' }, { status: 500 })
  }
}