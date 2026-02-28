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
      standbyPercentage: config.standbyPercentage,
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
      standbyPercentage: config.standbyPercentage,
      restHours: config.restHours,
      fatigueWeights: config.fatigueWeights,
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

      // Reset all field personnel to Standby first (clear zones)
      await PersonnelModel.updateMany(
        { rank: { $in: FIELD_DEPLOYABLE_RANKS }, status: { $in: ['Active', 'Deployed', 'Standby'] } },
        { $set: { status: 'Standby', currentZones: [] } }
      )

      // Collect ALL zone assignments per officer across all deployments
      // An officer (e.g. DIG/SP) may appear in multiple zone deployments
      const officerZoneMap = new Map<string, string[]>()

      for (const dep of currentShiftBlock.deployments) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawDep = dep as any

        // Extract personnel IDs: prefer personnelIds, fallback to personnel array
        let ids: string[] = []
        if (rawDep.personnelIds?.length) {
          ids = rawDep.personnelIds.map((id: unknown) => String(id))
        } else if (rawDep.personnel?.length) {
          ids = rawDep.personnel.map((p: unknown) => {
            if (typeof p === 'string') return p
            const pObj = p as Record<string, unknown>
            return String(pObj._id ?? pObj.id ?? pObj.officerId ?? '')
          }).filter(Boolean)
        }

        console.log(`  Zone ${rawDep.zoneId}: personnelIds=${ids.length}, totalStrength=${rawDep.totalStrength}, required=${rawDep.requiredStrength}, deficit=${rawDep.deficit}`)

        // Update zone's currentDeployment count
        const zoneObjectId = new mongoose.Types.ObjectId(String(rawDep.zoneId))
        await ZoneModel.findByIdAndUpdate(zoneObjectId, {
          currentDeployment: ids.length,
        })

        // Track which zones each officer is assigned to
        for (const officerId of ids) {
          if (!officerZoneMap.has(officerId)) {
            officerZoneMap.set(officerId, [])
          }
          officerZoneMap.get(officerId)!.push(String(rawDep.zoneId))
        }
      }

      // Batch update all deployed officers: set status + all their zones at once
      let totalDeployedCount = 0
      const updateOps = []

      for (const [officerId, zoneIds] of officerZoneMap.entries()) {
        const zoneObjectIds = zoneIds.map(id => new mongoose.Types.ObjectId(id))
        updateOps.push({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(officerId) },
            update: {
              $set: {
                status: 'Deployed',
                currentZones: zoneObjectIds,
              },
            },
          },
        })
        totalDeployedCount++
      }

      // Execute all updates in a single bulk write for efficiency
      if (updateOps.length > 0) {
        await PersonnelModel.bulkWrite(updateOps)
      }

      console.log(`[DEPLOY] Total deployed officers: ${totalDeployedCount}`)
    }

    // ── SAVE: Store roster with personnelIds so we can look up who was deployed ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summarySchedule = draft.schedule.map((day: any) => {
      const shifts: Record<string, unknown> = {}
      for (const [shiftName, shiftBlock] of Object.entries(day.shifts) as [string, { shift: string; startTime: string; endTime: string; standbyCount?: number; deployments: Array<{ zoneId: string; personnelIds?: string[]; personnel?: Array<{ _id?: string; id?: string; officerId?: string }>; totalStrength: number; requiredStrength: number; deficit: number; status: string }> }][]) {
        const depsSummary = shiftBlock.deployments.map((dep) => {
          // Extract personnel IDs from either personnelIds or personnel array
          let ids: string[] = dep.personnelIds || []
          if (!ids.length && dep.personnel?.length) {
            ids = dep.personnel.map(p => {
              const pObj = p as Record<string, unknown>
              return String(pObj._id ?? pObj.id ?? pObj.officerId ?? '')
            }).filter(Boolean)
          }
          return {
            zoneId: dep.zoneId,
            personnelIds: ids,
            totalStrength: dep.totalStrength,
            requiredStrength: dep.requiredStrength,
            deficit: dep.deficit,
            status: dep.status,
          }
        })
        shifts[shiftName] = {
          shift: shiftBlock.shift,
          startTime: shiftBlock.startTime,
          endTime: shiftBlock.endTime,
          standbyCount: shiftBlock.standbyCount ?? 0,
          deployments: depsSummary,
          totalDeployed: depsSummary.reduce((s, d) => s + (d.totalStrength ?? 0), 0),
          totalRequired: depsSummary.reduce((s, d) => s + (d.requiredStrength ?? 0), 0),
        }
      }
      return {
        date: day.date,
        dayNumber: day.dayNumber,
        dayOfWeek: day.dayOfWeek,
        isHoliday: day.isHoliday ?? false,
        shifts,
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
        standbyPercentage: config.standbyPercentage ?? 0.15,
        restHours: config.restHours ?? { lowerRanks: 8, inspectors: 12 },
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
  } catch (error: unknown) {
    const err = error as Record<string, unknown>
    console.error('Roster generation error:', err?.message || err)
    console.error('Stack:', err?.stack)
    const details = err?.errors ? Object.keys(err.errors as object).map(k => `${k}: ${(err.errors as Record<string, { message: string }>)[k]?.message}`) : []
    return NextResponse.json({ success: false, error: err?.message || 'Failed to generate roster', details }, { status: 500 })
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
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch rosters' }, { status: 500 })
  }
}