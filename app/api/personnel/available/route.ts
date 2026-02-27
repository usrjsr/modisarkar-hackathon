import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import PersonnelModel from '@/lib/db/models/Personnel'
import { FIELD_DEPLOYABLE_RANKS, RANK_TO_LEVEL } from '@/lib/constants/ranks'
import { hasCompletedRest, isEligibleForZone, getFatigueBand } from '@/lib/algorithms/fatigueCalculator'
import type { Personnel } from '@/lib/types/personnel'
import type { HeatmapColor } from '@/lib/constants/thresholds'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const shift = searchParams.get('shift')
    const date = searchParams.get('date')
    const zoneColor = searchParams.get('zoneColor') as HeatmapColor | null
    const zoneId = searchParams.get('zoneId')
    const rankFilter = searchParams.get('rank')

    if (!shift || !date) {
      return NextResponse.json(
        { success: false, error: 'Missing required query params: shift, date' },
        { status: 400 }
      )
    }

    const shiftStartHour: Record<string, number> = {
      morning: 6,
      evening: 14,
      night: 22,
    }

    if (!shiftStartHour[shift]) {
      return NextResponse.json(
        { success: false, error: 'Invalid shift. Must be morning, evening, or night' },
        { status: 400 }
      )
    }

    const shiftDate = new Date(date)
    const shiftStart = new Date(shiftDate)
    shiftStart.setHours(shiftStartHour[shift], 0, 0, 0)

    const query: Record<string, unknown> = {
      rank: { $in: FIELD_DEPLOYABLE_RANKS },
      status: { $in: ['Active', 'Standby'] },
      $or: [
        { nextAvailableAt: null },
        { nextAvailableAt: { $lte: shiftStart } },
      ],
    }

    if (rankFilter) query.rank = rankFilter
    if (zoneId) query.homeZone = zoneId

    const personnel = await PersonnelModel
      .find(query)
      .sort({ fatigueScore: 1 })
      .populate('homeZone', 'name code')
      .populate('currentZone', 'name code')

    const personnelPlain = personnel.map(p => p.toObject()) as Personnel[]

    const available: typeof personnelPlain = []
    const unavailable: typeof personnelPlain = []

    for (const officer of personnelPlain) {
      const restOk = hasCompletedRest(officer, shiftStart)
      const zoneOk = zoneColor ? isEligibleForZone(officer, zoneColor) : true
      const onLeave = officer.leavePeriods.some(lp => {
        const start = new Date(lp.startDate)
        const end = new Date(lp.endDate)
        return shiftStart >= start && shiftStart <= end
      })

      if (restOk && zoneOk && !onLeave) {
        available.push(officer)
      } else {
        unavailable.push(officer)
      }
    }

    const grouped = {
      zoneManagers: available.filter(o => RANK_TO_LEVEL[o.rank] === 'ZoneManager'),
      sectorDuty: available.filter(o => RANK_TO_LEVEL[o.rank] === 'SectorDuty'),
      strategic: available.filter(o => RANK_TO_LEVEL[o.rank] === 'Strategic'),
    }

    const fatigueSummary = {
      fresh: available.filter(o => getFatigueBand(o.fatigueScore).band === 'low').length,
      moderate: available.filter(o => getFatigueBand(o.fatigueScore).band === 'moderate').length,
      tired: available.filter(o => getFatigueBand(o.fatigueScore).band === 'high').length,
      critical: available.filter(o => getFatigueBand(o.fatigueScore).band === 'critical').length,
    }

    return NextResponse.json({
      success: true,
      data: {
        available,
        unavailable,
        grouped,
        fatigueSummary,
        meta: {
          totalAvailable: available.length,
          totalUnavailable: unavailable.length,
          shift,
          date: shiftDate,
          zoneColor: zoneColor ?? 'any',
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch available personnel' }, { status: 500 })
  }
}