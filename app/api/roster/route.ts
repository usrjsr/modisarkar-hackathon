import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/db/mongodb'
import mongoose from 'mongoose'
import ZoneModel from '@/lib/db/models/Zone'
import PersonnelModel from '@/lib/db/models/Personnel'
import RosterModel from '@/lib/db/models/Roster'
import SystemConfigModel from '@/lib/db/models/SystemConfig'
import { distributeForce } from '@/lib/algorithms/proportionalDistributor'
import { generateRoster } from '@/lib/algorithms/scheduler'
import { buildAndApplyAdjacency } from '@/lib/algorithms/graph/adjacencyBuilder'
import { FIELD_DEPLOYABLE_RANKS } from '@/lib/constants/ranks'
import type { Zone } from '@/lib/types/zone'
import type { Personnel } from '@/lib/types/personnel'

export async function POST(req: NextRequest) {
  try {
    await connectDB()

    const body = await req.json()
    const { startDate } = body

    if (!startDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: startDate' },
        { status: 400 }
      )
    }

    const config = await SystemConfigModel.findOne().sort({ createdAt: -1 })
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'SystemConfig not found. Set up system config first.' },
        { status: 404 }
      )
    }

    const allZones = await ZoneModel.find({ isActive: true })
    if (!allZones.length) {
      return NextResponse.json(
        { success: false, error: 'No active zones found. Create zones first.' },
        { status: 404 }
      )
    }

    const allPersonnel = await PersonnelModel.find({
      rank: { $in: FIELD_DEPLOYABLE_RANKS },
      status: { $in: ['Active', 'Standby'] },
    })

    if (!allPersonnel.length) {
      return NextResponse.json(
        { success: false, error: 'No deployable personnel found.' },
        { status: 404 }
      )
    }

    // Use ACTUAL personnel count as totalForce (not config value which may be stale)
    const actualTotalForce = allPersonnel.length

    const zonesPlain = allZones.map(z => { const o = z.toObject(); return { ...o, _id: o._id.toString() } }) as Zone[]
    const personnelPlain = allPersonnel.map(p => { const o = p.toObject(); return { ...o, _id: o._id.toString() } }) as Personnel[]

    const { zones: hydrated } = buildAndApplyAdjacency(zonesPlain, 'macro')

    const distribution = distributeForce({
      totalForce: actualTotalForce,
      zones: hydrated,
      weights: config.weights,
    })

    // Diagnostic: log per-zone allocation proportional to severity
    console.log(`[ROSTER] Total force: ${actualTotalForce}, Active: ${distribution.activeForce}, Standby: ${distribution.standbyPool}`)
    for (const alloc of distribution.allocations) {
      const zone = hydrated.find(z => z._id === alloc.zoneId)
      console.log(`  Zone "${zone?.name}" (${zone?.code}): zScore=${alloc.zScore}, allocation=${alloc.allocation}, color=${alloc.heatmapColor}`)
    }

    // Update zone scores immediately
    for (const alloc of distribution.allocations) {
      await ZoneModel.findByIdAndUpdate(alloc.zoneId, {
        zScore: alloc.zScore,
        safeThreshold: alloc.safeThreshold,
        heatmapColor: alloc.heatmapColor,
        allocation: alloc.allocation,
      })
    }

    // Generate the full 30-day roster (in-memory, lean IDs only)
    const draft = generateRoster({
      startDate: new Date(startDate),
      totalForce: actualTotalForce,
      zones: hydrated,
      allocations: distribution.allocations,
      personnel: personnelPlain,
      weights: config.weights,
    })

    // ── DEPLOY: Update zone & personnel records based on Day 1 current shift ──
    const currentHour = new Date().getHours()
    const activeShift = currentHour >= 6 && currentHour < 14 ? 'morning'
      : currentHour >= 14 && currentHour < 22 ? 'evening' : 'night'

    const day1 = draft.schedule[0]
    const currentShiftBlock = day1?.shifts?.[activeShift as keyof typeof day1.shifts]

    if (currentShiftBlock?.deployments) {
      console.log(`[DEPLOY] Active shift: ${activeShift}, Deployments: ${currentShiftBlock.deployments.length} zones`)
      console.log(`[DEPLOY] Personnel pool size: ${allPersonnel.length} field-deployable officers`)
      for (const dep of currentShiftBlock.deployments) {
        const ids = dep.personnelIds || []
        console.log(`  Zone ${dep.zoneId}: personnelIds=${ids.length}, totalStrength=${dep.totalStrength}, required=${dep.requiredStrength}, deficit=${dep.deficit}`)
      }
      // Reset all field personnel to Standby first
      await PersonnelModel.updateMany(
        { rank: { $in: FIELD_DEPLOYABLE_RANKS }, status: { $in: ['Active', 'Deployed', 'Standby'] } },
        { $set: { status: 'Standby', currentZone: null } }
      )

      // Deploy personnel to zones based on roster schedule
      let totalDeployedCount = 0
      for (const dep of currentShiftBlock.deployments) {
        const rawIds = dep.personnelIds || []
        const objectIds = rawIds.map((id: string) => new mongoose.Types.ObjectId(id))
        const zoneObjectId = new mongoose.Types.ObjectId(dep.zoneId)

        console.log(`[DEPLOY] Zone ${dep.zoneId}: deploying ${rawIds.length} officers, setting currentDeployment=${rawIds.length}`)
        totalDeployedCount += rawIds.length

        // Update zone's currentDeployment count
        await ZoneModel.findByIdAndUpdate(zoneObjectId, {
          currentDeployment: rawIds.length,
        })

        // Update each deployed officer's status and zone (batch in chunks of 500)
        for (let i = 0; i < objectIds.length; i += 500) {
          const chunk = objectIds.slice(i, i + 500)
          await PersonnelModel.updateMany(
            { _id: { $in: chunk } },
            { $set: { status: 'Deployed', currentZone: zoneObjectId } }
          )
        }
      }
      console.log(`[DEPLOY] Total deployed across all zones: ${totalDeployedCount}`)
    }

    // ── SAVE: Store only summary data in roster document (no personnelIds) ──
    // This keeps the roster document well under MongoDB's 16MB BSON limit
    const summarySchedule = draft.schedule.map((day: any) => {
      const shifts: any = {}
      for (const [shiftName, shiftBlock] of Object.entries(day.shifts) as any[]) {
        const depsSummary = shiftBlock.deployments.map((dep: any) => ({
          zoneId: dep.zoneId,
          totalStrength: dep.totalStrength,
          requiredStrength: dep.requiredStrength,
          deficit: dep.deficit,
          status: dep.status,
          // NO personnelIds — saves ~15MB
        }))
        shifts[shiftName] = {
          shift: shiftBlock.shift,
          startTime: shiftBlock.startTime,
          endTime: shiftBlock.endTime,
          standbyCount: shiftBlock.standbyCount ?? 0,
          deployments: depsSummary,
          // Shift-level totals for the roster dashboard
          totalDeployed: depsSummary.reduce((s: number, d: any) => s + (d.totalStrength ?? 0), 0),
          totalRequired: depsSummary.reduce((s: number, d: any) => s + (d.requiredStrength ?? 0), 0),
        }
      }
      return {
        date: day.date,
        dayNumber: day.dayNumber,
        dayOfWeek: day.dayOfWeek,
        shifts,
        // fatigueMatrix omitted — too large (5000 officers × 30 days)
      }
    })

    const activeRoster = await RosterModel.findOne({ isActive: true })
    if (activeRoster) {
      await RosterModel.findByIdAndUpdate(activeRoster._id, {
        isActive: false,
        replacedBy: null,
      })
    }

    const roster = await RosterModel.create({
      generatedAt: new Date(),
      validFrom: draft.validFrom,
      validUntil: draft.validUntil,
      configSnapshot: {
        ...draft.configSnapshot,
        totalZones: hydrated.length,
      },
      schedule: summarySchedule,
      violations: draft.violations.slice(0, 100), // cap violations to prevent bloat
      isActive: true,
      replacedBy: null,
    })

    if (activeRoster) {
      await RosterModel.findByIdAndUpdate(activeRoster._id, {
        replacedBy: roster._id,
      })
    }

    // Update SystemConfig.totalForce to match reality
    await SystemConfigModel.findByIdAndUpdate(config._id, { totalForce: actualTotalForce })

    return NextResponse.json({
      success: true,
      data: {
        rosterId: roster._id,
        validFrom: draft.validFrom,
        validUntil: draft.validUntil,
        totalDays: draft.schedule.length,
        totalViolations: draft.violations.length,
        criticalViolations: draft.violations.filter(v => v.severity === 'critical').length,
        standbyPool: distribution.standbyPool,
        activeForce: distribution.activeForce,
        zoneAllocations: distribution.allocations,
        deployedShift: activeShift,
        totalPersonnel: actualTotalForce,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Roster generation error:', error?.message || error)
    console.error('Stack:', error?.stack)
    const details = error?.errors ? Object.keys(error.errors).map(k => `${k}: ${error.errors[k].message}`) : []
    return NextResponse.json({ success: false, error: error?.message || 'Failed to generate roster', details }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('active') === 'true'

    if (activeOnly) {
      const roster = await RosterModel.findOne({ isActive: true })
      if (!roster) {
        return NextResponse.json(
          { success: true, data: null },
        )
      }
      return NextResponse.json({ success: true, data: roster })
    }

    const rosters = await RosterModel
      .find()
      .sort({ generatedAt: -1 })
      .limit(10)
      .select('-schedule')

    return NextResponse.json({ success: true, data: rosters })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch rosters' }, { status: 500 })
  }
}