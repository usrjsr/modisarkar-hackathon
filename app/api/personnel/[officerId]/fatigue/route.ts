import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import PersonnelModel from '@/lib/db/models/Personnel'
import {
  calculateFatigue,
  getFatigueBand,
  decayFatigue,
} from '@/lib/algorithms/fatigueCalculator'
import type { Personnel } from '@/lib/types/personnel'
import type { ShiftName } from '@/lib/constants/shifts'

interface Params {
  params: Promise<{ officerId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const officer = await PersonnelModel.findById(officerId)
    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    const { band, label } = getFatigueBand(officer.fatigueScore)

    return NextResponse.json({
      success: true,
      data: {
        officerId: officer._id,
        badgeNumber: officer.badgeNumber,
        name: officer.name,
        fatigueScore: officer.fatigueScore,
        band,
        label,
        history: officer.fatigueHistory.slice(-30),
        consecutiveNightShifts: officer.consecutiveNightShifts,
        lastShiftEnd: officer.lastShiftEnd,
        nextAvailableAt: officer.nextAvailableAt,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch fatigue data' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const body = await req.json()
    const { shift, isEmergencyDeployment = false, zoneId } = body

    if (!shift) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: shift' },
        { status: 400 }
      )
    }

    const validShifts: ShiftName[] = ['morning', 'evening', 'night']
    if (!validShifts.includes(shift)) {
      return NextResponse.json(
        { success: false, error: 'Invalid shift. Must be morning, evening, or night' },
        { status: 400 }
      )
    }

    const officer = await PersonnelModel.findById(officerId)
    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    const officerPlain = officer.toObject() as Personnel

    const result = calculateFatigue({
      officer: officerPlain,
      shift,
      isEmergencyDeployment,
    })

    const historyEntry = {
      date: new Date(),
      shift,
      zoneId: zoneId ?? null,
      points: result.pointsAdded,
      reason: result.reason,
    }

    await PersonnelModel.findByIdAndUpdate(
      officerId,
      {
        fatigueScore: result.newScore,
        $push: {
          fatigueHistory: {
            $each: [historyEntry],
            $slice: -90,
          },
        },
        $inc: { version: 1 },
      },
      { new: true }
    )

    const { band, label } = getFatigueBand(result.newScore)

    return NextResponse.json({
      success: true,
      data: {
        officerId,
        previousScore: result.previousScore,
        pointsAdded: result.pointsAdded,
        newScore: result.newScore,
        band,
        label,
        isFatigued: result.isFatigued,
        reason: result.reason,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update fatigue' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await connectDB()
    const { officerId } = await params

    const body = await req.json()
    const { daysRested } = body

    if (!daysRested || daysRested < 1) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid field: daysRested (must be >= 1)' },
        { status: 400 }
      )
    }

    const officer = await PersonnelModel.findById(officerId)
    if (!officer) {
      return NextResponse.json({ success: false, error: 'Officer not found' }, { status: 404 })
    }

    const officerPlain = officer.toObject() as Personnel
    const decayedScore = decayFatigue(officerPlain, daysRested)

    await PersonnelModel.findByIdAndUpdate(
      officerId,
      {
        fatigueScore: decayedScore,
        $inc: { version: 1 },
      },
      { new: true }
    )

    const { band, label } = getFatigueBand(decayedScore)

    return NextResponse.json({
      success: true,
      data: {
        officerId,
        previousScore: officer.fatigueScore,
        newScore: decayedScore,
        daysRested,
        band,
        label,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to apply fatigue decay' }, { status: 500 })
  }
}