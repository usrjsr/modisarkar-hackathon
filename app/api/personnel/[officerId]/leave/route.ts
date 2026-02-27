import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import PersonnelModel from '@/lib/db/models/Personnel'
import DeploymentModel from '@/lib/db/models/Deployment'
import { patchMassAbsence } from '@/lib/algorithms/deficitResolver'
import { buildAdjacencyMap } from '@/lib/algorithms/graph/adjacencyBuilder'
import ZoneModel from '@/lib/db/models/Zone'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import type { Zone, ZoneSnapshot, ZoneAllocation } from '@/lib/types/zone'
import type { Personnel } from '@/lib/types/personnel'

interface Params {
  params: Promise<{ officerId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const body = await req.json()
    const { startDate, endDate, reason, approvedBy } = body

    if (!startDate || !endDate || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: startDate, endDate, reason' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end <= start) {
      return NextResponse.json(
        { success: false, error: 'endDate must be after startDate' },
        { status: 400 }
      )
    }

    const officer = await PersonnelModel.findById(officerId)
    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    const overlapping = officer.leavePeriods.some((lp: { startDate: string | Date; endDate: string | Date }) => {
      const lpStart = new Date(lp.startDate)
      const lpEnd = new Date(lp.endDate)
      return start <= lpEnd && end >= lpStart
    })

    if (overlapping) {
      return NextResponse.json(
        { success: false, error: 'Officer already has overlapping leave period' },
        { status: 409 }
      )
    }

    const leavePeriod = {
      startDate: start,
      endDate: end,
      reason,
      approvedBy: approvedBy ?? null,
    }

    await PersonnelModel.findByIdAndUpdate(
      officerId,
      {
        $push: { leavePeriods: leavePeriod },
        status: 'OnLeave',
        $inc: { version: 1 },
      }
    )

    const activeDeployments = await DeploymentModel.find({
      'personnel.officerId': officerId,
      date: {
        $gte: start,
        $lte: end,
      },
      status: { $in: ['Scheduled', 'Active'] },
    })

    const patchResults = []

    if (activeDeployments.length > 0) {
      const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
      const allZones = await ZoneModel.find({ isActive: true })
      const zonesPlain = allZones.map(z => z.toObject()) as Zone[]
      const adjacencyMap = buildAdjacencyMap(zonesPlain, 'macro')

      for (const zone of zonesPlain) {
        zone.adjacency = (adjacencyMap[zone._id] ?? []).map(e => e.zoneId)
      }

      for (const deployment of activeDeployments) {
        const affectedZone = zonesPlain.find(
          z => z._id === deployment.zoneId.toString()
        )
        if (!affectedZone) continue

        const deployedInZone = await PersonnelModel.find({
          _id: {
            $in: deployment.personnel.map((p: { officerId: string }) => p.officerId),
          },
        })

        const deployedPlain = deployedInZone.map(p => p.toObject()) as Personnel[]
        const absentOfficers = deployedPlain.filter(
          p => p._id === officerId
        )

        if (!absentOfficers.length) continue

        const shiftDate = new Date(deployment.date)
        const shiftStartHour: Record<string, number> = {
          morning: 6,
          evening: 14,
          night: 22,
        }
        const shiftStart = new Date(shiftDate)
        shiftStart.setHours(shiftStartHour[deployment.shift], 0, 0, 0)

        const allDeployments = await DeploymentModel.find({
          date: {
            $gte: new Date(shiftDate.toDateString()),
            $lt: new Date(new Date(shiftDate).setDate(shiftDate.getDate() + 1)),
          },
          shift: deployment.shift,
        }).populate('personnel.officerId')

        const deployedPersonnel = new Map<string, Personnel[]>()
        const allAllocations: ZoneAllocation[] = []

        for (const zone of zonesPlain) {
          const dep = allDeployments.find(d => d.zoneId.toString() === zone._id)
          const officers: Personnel[] = dep
            ? dep.personnel.map((p: { officerId: string }) => p.officerId).filter(Boolean)
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
          nextAvailableAt: { $lte: shiftStart },
        })
        const standbyPool = standbyOfficers.map(o => o.toObject()) as Personnel[]

        const allZoneSnapshots: ZoneSnapshot[] = zonesPlain.map(zone => ({
          zone,
          currentDeployment: deployedPersonnel.get(zone._id)?.length ?? 0,
          safeThreshold: zone.safeThreshold ?? 0,
        }))

        const result = patchMassAbsence({
          affectedZone: affectedZone,
          absentOfficers,
          shift: deployment.shift,
          shiftStart,
          allZoneSnapshots,
          allAllocations,
          deployedPersonnel,
          standbyPool,
          weights: config?.weights ?? { w_s: 0.3, w_d: 0.7 },
        })

        await DeploymentModel.findByIdAndUpdate(deployment._id, {
          $pull: {
            personnel: { officerId: officerId },
          },
          $inc: {
            totalStrength: -1,
            deficit: 1,
            version: 1,
          },
          status: result.remainingDeficit > 0 ? 'Critical' : 'Modified',
        })

        if (result.movedPersonnel.length > 0) {
          await DeploymentModel.findByIdAndUpdate(deployment._id, {
            $push: {
              personnel: { $each: result.movedPersonnel },
            },
            $inc: {
              totalStrength: result.troopsResolved,
              deficit: -result.troopsResolved,
            },
          })
        }

        patchResults.push({
          deploymentId: deployment._id,
          date: deployment.date,
          shift: deployment.shift,
          status: result.status,
          troopsResolved: result.troopsResolved,
          remainingDeficit: result.remainingDeficit,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        officerId: officerId,
        leavePeriod,
        deploymentPatches: patchResults,
        message: patchResults.length > 0
          ? `Leave approved. ${patchResults.length} deployment(s) patched.`
          : 'Leave approved. No active deployments affected.',
      },
    }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to process leave request' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const body = await req.json()
    const { leaveId } = body

    if (!leaveId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: leaveId' },
        { status: 400 }
      )
    }

    const officer = await PersonnelModel.findById(officerId)
    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    const leave = officer.leavePeriods.find(
      (lp: { _id: { toString: () => string } }) => lp._id.toString() === leaveId
    )

    if (!leave) {
      return NextResponse.json({ success: false, error: 'Leave period not found' }, { status: 404 })
    }

    const now = new Date()
    if (new Date(leave.startDate) <= now) {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel leave that has already started' },
        { status: 400 }
      )
    }

    await PersonnelModel.findByIdAndUpdate(
      officerId,
      {
        $pull: { leavePeriods: { _id: leaveId } },
        status: 'Active',
        $inc: { version: 1 },
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Leave period cancelled successfully',
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to cancel leave' }, { status: 500 })
  }
}