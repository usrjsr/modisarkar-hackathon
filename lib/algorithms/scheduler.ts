import { SHIFT_NAMES, SHIFTS, SHIFT_SEQUENCE, SHIFT_DURATION_HOURS } from '../constants/shifts';
import { STANDBY_POOL_PERCENTAGE, MAX_CONSECUTIVE_NIGHT_SHIFTS } from '../constants/thresholds';
import { RANK_TO_LEVEL, MIN_ZONE_COMPOSITION, FIELD_DEPLOYABLE_RANKS } from '../constants/ranks';
import {
  sortByEligibility,
  hasCompletedRest,
  isEligibleForZone,
  bulkUpdateFatigue,
  buildDailyFatigueSummary,
  decayFatigue,
} from './fatigueCalculator';
import type { Zone, ZoneAllocation } from '../types/zone';
import type { Personnel, PersonnelRef } from '../types/personnel';
import type { ShiftName } from '../constants/shifts';
import type {
  RosterDraft,
  DaySchedule,
  ShiftBlock,
  ShiftDeployment,
  RosterViolation,
  RosterConfigSnapshot,
} from '../types/roster';

// ─── Input / Output ──────────────────────────────────────────────────────────

export interface SchedulerInput {
  startDate: Date;
  totalForce: number;
  zones: Zone[];
  allocations: ZoneAllocation[];  // From proportionalDistributor
  personnel: Personnel[];
  weights: { w_s: number; w_d: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getShiftStartDate(baseDate: Date, shift: ShiftName): Date {
  const d = new Date(baseDate);
  d.setHours(SHIFTS[shift].startHour, 0, 0, 0);
  return d;
}

function getShiftEndDate(baseDate: Date, shift: ShiftName): Date {
  const d = new Date(baseDate);
  if (shift === 'night') {
    d.setDate(d.getDate() + 1); // crosses midnight
    d.setHours(SHIFTS.night.endHour, 0, 0, 0);
  } else {
    d.setHours(SHIFTS[shift].endHour, 0, 0, 0);
  }
  return d;
}

function clonePersonnel(officers: Personnel[]): Personnel[] {
  return officers.map(o => ({ ...o, fatigueHistory: [...o.fatigueHistory], leavePeriods: [...o.leavePeriods] }));
}

function isOnLeave(officer: Personnel, date: Date): boolean {
  return officer.leavePeriods.some(lp => {
    const start = new Date(lp.startDate);
    const end = new Date(lp.endDate);
    return date >= start && date <= end;
  });
}

function isAvailableForShift(officer: Personnel, shiftStart: Date, shiftEnd: Date): boolean {
  if (officer.status === 'Unavailable') return false;
  if (isOnLeave(officer, shiftStart)) return false;
  if (!hasCompletedRest(officer, shiftStart)) return false;
  return true;
}

// Lean: just return the officer ID to avoid massive memory usage
function toOfficerId(officer: Personnel): string {
  return officer._id;
}

function applyFatigueToPool(
  pool: Personnel[],
  shift: ShiftName,
  emergencyIds: Set<string>
): void {
  const updates = bulkUpdateFatigue(pool, shift, emergencyIds);
  for (const update of updates) {
    const officer = pool.find(o => o._id === update.officerId);
    if (officer) officer.fatigueScore = update.newScore;
  }
}

function applyRestDecayToPool(pool: Personnel[], deployedIds: Set<string>): void {
  for (const officer of pool) {
    if (!deployedIds.has(officer._id)) {
      officer.fatigueScore = decayFatigue(officer, 1);
    }
  }
}

// ─── Pick officers for a single zone shift ───────────────────────────────────

function pickOfficersForZone(
  zone: Zone,
  allocation: ZoneAllocation,
  availablePool: Personnel[],
  standbyPool: Personnel[],
  shiftStart: Date,
  shiftEnd: Date,
  assignedIds: Set<string>,    // Already assigned this shift — global guard
  violations: RosterViolation[],
  dayNumber: number,
  shift: ShiftName,
): { deployedIds: string[]; usedStandbyIds: Set<string> } {
  const deployedIds: string[] = [];
  const usedStandbyIds: Set<string> = new Set();
  // Divide total allocation by number of shifts so each shift fills its fair share
  const numShifts = SHIFT_SEQUENCE.length; // 3
  const needed = Math.ceil(allocation.allocation / numShifts);
  const zoneColor = allocation.heatmapColor;

  // ── 1. Enforce minimum composition first ──────────────────────────────────
  const compositionRanks = Object.keys(MIN_ZONE_COMPOSITION) as Array<keyof typeof MIN_ZONE_COMPOSITION>;

  for (const rank of compositionRanks) {
    const required = MIN_ZONE_COMPOSITION[rank];
    let filled = 0;

    const candidates = availablePool
      .filter(o =>
        o.rank === rank &&
        !assignedIds.has(o._id) &&
        isAvailableForShift(o, shiftStart, shiftEnd) &&
        isEligibleForZone(o, zoneColor)
      )
      .sort((a, b) => a.fatigueScore - b.fatigueScore);

    for (const officer of candidates) {
      if (filled >= required) break;
      deployedIds.push(officer._id);
      assignedIds.add(officer._id);
      filled++;
    }

    if (filled < required) {
      const standbyCandidates = standbyPool.filter(
        o => o.rank === rank && !assignedIds.has(o._id) && isAvailableForShift(o, shiftStart, shiftEnd)
      );
      for (const officer of standbyCandidates) {
        if (filled >= required) break;
        deployedIds.push(officer._id);
        assignedIds.add(officer._id);
        usedStandbyIds.add(officer._id);
        filled++;
      }
    }

    if (filled < required) {
      violations.push({
        type: 'CompositionViolation',
        description: `Zone "${zone.name}" could not fill minimum ${rank} requirement (needed ${required}, got ${filled}).`,
        severity: 'critical',
        affectedZoneId: zone._id,
        dayNumber,
        shift,
      });
    }
  }

  // ── 2. Fill remaining allocation with sector duty ranks ──────────────────
  const remaining = needed - deployedIds.length;

  const sectorCandidates = sortByEligibility(
    availablePool.filter(o =>
      RANK_TO_LEVEL[o.rank] === 'SectorDuty' &&
      !assignedIds.has(o._id) &&
      isAvailableForShift(o, shiftStart, shiftEnd)
    ),
    zoneColor,
    shiftStart
  );

  let filled = 0;
  for (const officer of sectorCandidates) {
    if (filled >= remaining) break;
    deployedIds.push(officer._id);
    assignedIds.add(officer._id);
    filled++;
  }

  // ── 3. Check if zone is understaffed (per-shift threshold) ───────────────
  const perShiftThreshold = Math.ceil(allocation.safeThreshold / SHIFT_SEQUENCE.length);
  if (deployedIds.length < perShiftThreshold) {
    violations.push({
      type: 'UnderstaffedZone',
      description: `Zone "${zone.name}" ${shift} shift on day ${dayNumber}: deployed ${deployedIds.length}/${needed} (safe threshold: ${perShiftThreshold}).`,
      severity: deployedIds.length < Math.floor(perShiftThreshold * 0.5) ? 'critical' : 'warning',
      affectedZoneId: zone._id,
      dayNumber,
      shift,
    });
  }

  return { deployedIds, usedStandbyIds };
}

// ─── Build a single ShiftBlock ────────────────────────────────────────────────

function buildShiftBlock(
  shift: ShiftName,
  dayDate: Date,
  zones: Zone[],
  allocations: ZoneAllocation[],
  activePool: Personnel[],
  standbyOfficers: Personnel[],
  globalAssignedIds: Set<string>,
  violations: RosterViolation[],
  dayNumber: number,
): { block: any; deployedIds: Set<string> } {
  const shiftStart = getShiftStartDate(dayDate, shift);
  const shiftEnd = getShiftEndDate(dayDate, shift);
  const deployments: any[] = [];
  const allDeployedIds: Set<string> = new Set();

  // Sort zones by Z-score DESCENDING so highest-risk zones get first pick of personnel
  const sortedZones = [...zones].sort((a, b) => {
    const allocA = allocations.find(al => al.zoneId === a._id);
    const allocB = allocations.find(al => al.zoneId === b._id);
    return (allocB?.zScore ?? 0) - (allocA?.zScore ?? 0);
  });

  for (const zone of sortedZones) {
    const allocation = allocations.find(a => a.zoneId === zone._id);
    if (!allocation) continue;

    const { deployedIds, usedStandbyIds } = pickOfficersForZone(
      zone,
      allocation,
      activePool,
      standbyOfficers,
      shiftStart,
      shiftEnd,
      globalAssignedIds,
      violations,
      dayNumber,
      shift,
    );

    deployedIds.forEach(id => allDeployedIds.add(id));
    usedStandbyIds.forEach(id => allDeployedIds.add(id));

    const totalStrength = deployedIds.length;
    // Use per-shift allocation (not total) for accurate reporting
    const perShiftAllocation = Math.ceil(allocation.allocation / SHIFT_SEQUENCE.length);
    const requiredStrength = perShiftAllocation;
    const deficit = requiredStrength - totalStrength;

    deployments.push({
      zoneId: zone._id,
      personnelIds: deployedIds,
      totalStrength,
      requiredStrength,
      deficit,
      status: deficit > 0 ? 'Modified' : 'Scheduled',
    });
  }

  // Count standby remaining (don't store full objects)
  const standbyCount = standbyOfficers
    .filter(o => !allDeployedIds.has(o._id) && isAvailableForShift(o, shiftStart, shiftEnd))
    .length;

  const block = {
    shift,
    startTime: SHIFTS[shift].start,
    endTime: SHIFTS[shift].end,
    deployments,
    standbyCount,
  };

  return { block, deployedIds: allDeployedIds };
}

// ─── Update lastShiftEnd for deployed officers ────────────────────────────────

function updateLastShiftEnd(
  pool: Personnel[],
  deployedIds: Set<string>,
  shift: ShiftName,
  dayDate: Date
): void {
  const shiftEnd = getShiftEndDate(dayDate, shift);
  for (const officer of pool) {
    if (deployedIds.has(officer._id)) {
      officer.lastShiftEnd = shiftEnd;
      officer.totalDeployments += 1;
      officer.nextAvailableAt = new Date(
        shiftEnd.getTime() +
        (RANK_TO_LEVEL[officer.rank] === 'ZoneManager' ? 12 : 8) * 60 * 60 * 1000
      );
      if (shift === 'night') {
        officer.consecutiveNightShifts += 1;
      } else {
        officer.consecutiveNightShifts = 0;
      }
    }
  }
}

// ─── Validate consecutive night shift limit ───────────────────────────────────

function checkNightShiftLimit(
  pool: Personnel[],
  deployedIds: Set<string>,
  violations: RosterViolation[],
  dayNumber: number
): void {
  for (const officer of pool) {
    if (
      deployedIds.has(officer._id) &&
      officer.consecutiveNightShifts > MAX_CONSECUTIVE_NIGHT_SHIFTS
    ) {
      violations.push({
        type: 'RestViolation',
        description: `Officer ${officer.badgeNumber} has exceeded ${MAX_CONSECUTIVE_NIGHT_SHIFTS} consecutive night shifts (day ${dayNumber}).`,
        severity: 'warning',
        affectedOfficerId: officer._id,
        dayNumber,
        shift: 'night',
      });
    }
  }
}

// ─── Main Scheduler ──────────────────────────────────────────────────────────

export function generateRoster(input: SchedulerInput): RosterDraft {
  const { startDate, totalForce, zones, allocations, weights } = input;

  // Deep clone personnel so we mutate safely without touching originals
  const allPersonnel = clonePersonnel(
    input.personnel.filter(o => FIELD_DEPLOYABLE_RANKS.includes(o.rank))
  );

  const standbyCount = Math.floor(totalForce * STANDBY_POOL_PERCENTAGE);
  const activeForce = totalForce - standbyCount;
  const violations: RosterViolation[] = [];
  const schedule: DaySchedule[] = [];

  // Log per-zone allocation for debugging
  console.log('[SCHEDULER] Per-zone allocations (total | per-shift):');
  for (const alloc of allocations) {
    const zone = zones.find(z => z._id === alloc.zoneId);
    const perShift = Math.ceil(alloc.allocation / SHIFT_SEQUENCE.length);
    console.log(`  ${zone?.name ?? alloc.zoneId}: total=${alloc.allocation}, perShift=${perShift}, zScore=${alloc.zScore}, color=${alloc.heatmapColor}`);
  }

  // Split into standby pool (lowest fatigue, least senior) vs active pool
  const sortedByFatigue = [...allPersonnel].sort((a, b) => a.fatigueScore - b.fatigueScore);
  const standbyOfficers = sortedByFatigue.slice(0, standbyCount);
  const activePool = sortedByFatigue.slice(standbyCount);

  const configSnapshot: RosterConfigSnapshot = {
    totalForce,
    activeForce,
    standbyPool: standbyCount,
    weights,
    totalZones: zones.length,
  };

  // ── Generate 30 days ──────────────────────────────────────────────────────
  for (let day = 0; day < 30; day++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + day);
    const dayNumber = day + 1;

    const allDeployedToday: Set<string> = new Set();
    const allNightDeployedToday: Set<string> = new Set();

    // Per-day: track who was assigned this day (no officer in 2 zones same day)
    const dayAssignedIds: Set<string> = new Set();

    const shiftBlocks: Partial<Record<ShiftName, ShiftBlock>> = {};

    for (const shift of SHIFT_SEQUENCE) {
      const { block, deployedIds } = buildShiftBlock(
        shift,
        dayDate,
        zones,
        allocations,
        activePool,
        standbyOfficers,
        dayAssignedIds,  // Passed by reference — prevents same-day double assignment
        violations,
        dayNumber,
      );

      shiftBlocks[shift] = block;

      // Track fatigue updates
      deployedIds.forEach(id => allDeployedToday.add(id));
      if (shift === 'night') deployedIds.forEach(id => allNightDeployedToday.add(id));

      // Update shift end times + rest windows
      updateLastShiftEnd([...activePool, ...standbyOfficers], deployedIds, shift, dayDate);

      // Apply fatigue points
      const deployedOfficers = [...activePool, ...standbyOfficers].filter(o => deployedIds.has(o._id));
      applyFatigueToPool(deployedOfficers, shift, new Set());

      // Night shift consecutive check
      if (shift === 'night') {
        checkNightShiftLimit([...activePool, ...standbyOfficers], deployedIds, violations, dayNumber);
      }
    }

    // Decay fatigue for officers who weren't deployed at all today
    applyRestDecayToPool([...activePool, ...standbyOfficers], allDeployedToday);

    // Build fatigue matrix snapshot for this day
    const fatigueMatrix = buildDailyFatigueSummary(
      [...activePool, ...standbyOfficers],
      allDeployedToday,
      allNightDeployedToday,
    );

    schedule.push({
      date: dayDate,
      dayNumber,
      dayOfWeek: dayDate.getDay(),
      isHoliday: false, // Can be enriched later via holiday calendar
      shifts: {
        morning: shiftBlocks['morning']!,
        evening: shiftBlocks['evening']!,
        night: shiftBlocks['night']!,
      },
      fatigueMatrix,
    });
  }

  const validUntil = new Date(startDate);
  validUntil.setDate(startDate.getDate() + 30);

  return {
    validFrom: startDate,
    validUntil,
    configSnapshot,
    schedule,
    violations,
  };
}