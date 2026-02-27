import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import ZoneModel from '@/lib/db/models/Zone'
import IncidentModel from '@/lib/db/models/Incident'
import DeploymentModel from '@/lib/db/models/Deployment'
import { recalculateZoneScore, calculateDeficit } from '@/lib/algorithms/proportionalDistributor'
import type { ZoneAllocation } from '@/lib/types/zone'

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

    const zone = await ZoneModel.findById(zoneId)
    if (!zone) {
      return NextResponse.json({ success: false, error: 'Zone not found' }, { status: 404 })
    }

    if (!zone.isActive) {
      return NextResponse.json({ success: false, error: 'Zone is not active' }, { status: 400 })
    }

    const shiftDate = new Date(shiftStart)

    const allZones = await ZoneModel.find({ isActive: true })
    const allAllocations: ZoneAllocation[] = allZones.map(z => ({
      zoneId: z._id.toString(),
      zScore: z.zScore ?? 0,
      allocation: z.currentDeployment ?? 0,
      safeThreshold: z.safeThreshold ?? 0,
      heatmapColor: z.heatmapColor ?? 'green',
    }))

    const currentDeployment = await DeploymentModel.findOne({
      zoneId: zoneId,
      date: {
        $gte: new Date(shiftDate.toDateString()),
        $lt: new Date(new Date(shiftDate).setDate(shiftDate.getDate() + 1)),
      },
      shift,
    })

    const currentStrength = currentDeployment?.totalStrength ?? zone.currentDeployment ?? 0

    const { newRequirement, delta, newZScore } = calculateDeficit(
      zone.toObject(),
      newDensityScore,
      currentStrength,
      allAllocations,
    )

    const { heatmapColor } = recalculateZoneScore(
      zone.sizeScore,
      newDensityScore,
    )

    const incident = await IncidentModel.create({
      zoneId: zoneId,
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
      manualOverride: {
        applied: false,
        by: null,
        notes: '',
        troopsAdded: 0,
      },
    })

    await ZoneModel.findByIdAndUpdate(zoneId, {
      densityScore: newDensityScore,
      heatmapColor,
      $inc: { version: 1 },
    })

    return NextResponse.json({
      success: true,
      data: {
        incidentId: incident._id,
        zoneId: zoneId,
        originalDensity: zone.densityScore,
        newDensity: newDensityScore,
        newZScore,
        deltaT: delta,
        newRequirement,
        currentStrength,
        heatmapColor,
        message: delta > 0
          ? `Deficit of ${delta} officers detected. Call /api/zones/redistribute to resolve.`
          : 'No deficit — zone is adequately staffed at new density.',
      },
    }, { status: 201 })
  } catch {
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