import { MAX_SIPHON_FRACTION } from '../constants/thresholds';
import { FATIGUE_WEIGHTS } from '../constants/thresholds';
import { calculateDeficit, recalculateZoneScore } from './proportionalDistributor';
import { isEligibleForZone, hasCompletedRest } from './fatigueCalculator';
import type { Zone, ZoneAllocation, ZoneSnapshot } from '../types/zone';
import type { Personnel, PersonnelRef } from '../types/personnel';
import type { ShiftName } from '../constants/shifts';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResolutionMethod =
  | 'AdjacentPool'
  | 'GlobalReserve'
  | 'Escalation'
  | 'Resolved'
  | 'Failed';

export interface ResolutionStep {
  step: 'A' | 'B' | 'C';
  action: string;
  troopsMoved: number;
  sourceZones: string[];   // Zone _ids
  timestamp: Date;
}

export interface IncidentInput {
  // The zone that had a density spike
  affectedZone: Zone;
  newDensityScore: number;

  // Current shift context
  shift: ShiftName;
  shiftStart: Date;

  // All zones + their current deployment state
  allZoneSnapshots: ZoneSnapshot[];
  allAllocations: ZoneAllocation[];

  // All personnel currently deployed or on standby this shift
  deployedPersonnel: Map<string, Personnel[]>;  // zoneId → deployed officers
  standbyPool: Personnel[];               // Global 15% reserve

  // Weights for Z-score recalculation
  weights: { w_s: number; w_d: number };
}

export interface ResolutionResult {
  affectedZoneId: string;
  originalDensity: number;
  newDensity: number;
  newZScore: number;
  deltaT: number;           // Troops needed
  steps: ResolutionStep[];
  status: ResolutionMethod;
  troopsResolved: number;           // How many of deltaT we filled
  remainingDeficit: number;           // 0 if fully resolved
  movedPersonnel: PersonnelRef[];   // Officers actually moved
  warningMessage: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPersonnelRef(officer: Personnel, deployedAt: Date): PersonnelRef {
  return {
    officerId: officer._id,
    rank: officer.rank,
    role: 'EmergencyRedeploy',
    isReserve: false,
    deployedAt,
    fatigueAtDeployment: officer.fatigueScore,
  };
}

function getSafeThreshold(snapshot: ZoneSnapshot): number {
  return snapshot.safeThreshold;
}

function getSurplus(snapshot: ZoneSnapshot): number {
  return Math.max(0, snapshot.currentDeployment - getSafeThreshold(snapshot));
}

function getAdjacentSnapshots(
  affectedZone: Zone,
  allSnapshots: ZoneSnapshot[],
): ZoneSnapshot[] {
  return allSnapshots.filter(
    s => s.zone._id !== affectedZone._id && affectedZone.adjacency.includes(s.zone._id)
  );
}

function pickOfficersFromZone(
  sourceSnapshot: ZoneSnapshot,
  deployedMap: Map<string, Personnel[]>,
  count: number,
  zoneColor: ZoneAllocation['heatmapColor'],
  shiftStart: Date,
): Personnel[] {
  const available = (deployedMap.get(sourceSnapshot.zone._id) ?? [])
    .filter(o =>
      isEligibleForZone(o, zoneColor) &&
      hasCompletedRest(o, shiftStart)
    )
    .sort((a, b) => a.fatigueScore - b.fatigueScore); // lowest fatigue first

  return available.slice(0, count);
}

// ─── Step A: Adjacent Zone Pooling ───────────────────────────────────────────

function stepA_adjacentPooling(
  needed: number,
  affectedZone: Zone,
  newHeatmapColor: ZoneAllocation['heatmapColor'],
  allSnapshots: ZoneSnapshot[],
  deployedMap: Map<string, Personnel[]>,
  shiftStart: Date,
): {
  resolved: number;
  moved: PersonnelRef[];
  sourceZones: string[];
  updatedMap: Map<string, Personnel[]>;
} {
  const adjacentSnapshots = getAdjacentSnapshots(affectedZone, allSnapshots)
    // Only pull from green/yellow zones (low density) — don't strip already stressed zones
    .filter(s => {
      return getSurplus(s) > 0;
    })
    // Prioritise zones with most surplus
    .sort((a, b) => getSurplus(b) - getSurplus(a));

  let resolved = 0;
  const moved: PersonnelRef[] = [];
  const sources: string[] = [];
  const updatedMap = new Map(deployedMap);

  for (const neighbor of adjacentSnapshots) {
    if (resolved >= needed) break;

    const surplus = getSurplus(neighbor);
    const maxSiphon = Math.min(
      Math.floor(neighbor.currentDeployment * MAX_SIPHON_FRACTION),
      surplus,
      needed - resolved
    );

    if (maxSiphon <= 0) continue;

    const picked = pickOfficersFromZone(
      neighbor,
      updatedMap,
      maxSiphon,
      newHeatmapColor,
      shiftStart,
    );

    if (picked.length === 0) continue;

    // Remove from source zone
    const sourceDeployed = updatedMap.get(neighbor.zone._id) ?? [];
    const pickedIds = new Set(picked.map(o => o._id));
    updatedMap.set(
      neighbor.zone._id,
      sourceDeployed.filter(o => !pickedIds.has(o._id))
    );

    picked.forEach(o => {
      moved.push(toPersonnelRef(o, shiftStart));
      o.fatigueScore += FATIGUE_WEIGHTS.emergencyDeployment; // Emergency penalty
    });

    sources.push(neighbor.zone._id);
    resolved += picked.length;
  }

  return { resolved, moved, sourceZones: sources, updatedMap };
}

// ─── Step B: Global Reserve Pooling ──────────────────────────────────────────

function stepB_globalReserve(
  needed: number,
  newHeatmapColor: ZoneAllocation['heatmapColor'],
  standbyPool: Personnel[],
  shiftStart: Date,
): {
  resolved: number;
  moved: PersonnelRef[];
  remaining: Personnel[];  // Standby pool after extraction
} {
  const candidates = standbyPool
    .filter(o =>
      isEligibleForZone(o, newHeatmapColor) &&
      hasCompletedRest(o, shiftStart)
    )
    .sort((a, b) => a.fatigueScore - b.fatigueScore);

  const picked = candidates.slice(0, needed);
  const pickedIds = new Set(picked.map(o => o._id));

  picked.forEach(o => {
    o.fatigueScore += FATIGUE_WEIGHTS.emergencyDeployment;
  });

  return {
    resolved: picked.length,
    moved: picked.map(o => toPersonnelRef(o, shiftStart)),
    remaining: standbyPool.filter(o => !pickedIds.has(o._id)),
  };
}

// ─── Step C: Escalation ──────────────────────────────────────────────────────

function stepC_escalation(remainingDeficit: number, zoneId: string): ResolutionStep {
  return {
    step: 'C',
    action: `CRITICAL ALERT — Zone ${zoneId} has an unresolved deficit of ${remainingDeficit} officers. Manual override required. Adjacent zones and global reserve exhausted.`,
    troopsMoved: 0,
    sourceZones: [],
    timestamp: new Date(),
  };
}

// ─── Main Resolver ───────────────────────────────────────────────────────────

export function resolveIncident(input: IncidentInput): ResolutionResult {
  const {
    affectedZone,
    newDensityScore,
    shiftStart,
    allZoneSnapshots,
    allAllocations,
    deployedPersonnel,
    standbyPool,
    weights,
  } = input;

  const steps: ResolutionStep[] = [];
  const movedAll: PersonnelRef[] = [];

  // ── Recalculate Z-score + deficit ─────────────────────────────────────────
  const { zScore: newZScore, heatmapColor: newHeatmapColor } = recalculateZoneScore(
    affectedZone.sizeScore,
    newDensityScore,
    weights,
  );

  const currentDeployment = (deployedPersonnel.get(affectedZone._id) ?? []).length;

  const { delta } = calculateDeficit(
    affectedZone,
    newDensityScore,
    currentDeployment,
    allAllocations,
    weights,
  );

  // No deficit — density spike didn't require more troops
  if (delta <= 0) {
    return {
      affectedZoneId: affectedZone._id,
      originalDensity: affectedZone.densityScore,
      newDensity: newDensityScore,
      newZScore,
      deltaT: delta,
      steps: [],
      status: 'Resolved',
      troopsResolved: 0,
      remainingDeficit: 0,
      movedPersonnel: [],
      warningMessage: null,
    };
  }

  let remaining = delta;
  let updatedDeployedMap = new Map(deployedPersonnel);
  let updatedStandby = [...standbyPool];

  // ── Step A ────────────────────────────────────────────────────────────────
  const resultA = stepA_adjacentPooling(
    remaining,
    affectedZone,
    newHeatmapColor,
    allZoneSnapshots,
    updatedDeployedMap,
    shiftStart,
  );

  if (resultA.resolved > 0) {
    updatedDeployedMap = resultA.updatedMap;
    movedAll.push(...resultA.moved);
    remaining -= resultA.resolved;

    steps.push({
      step: 'A',
      action: `Siphoned ${resultA.resolved} officers from adjacent zones: ${resultA.sourceZones.join(', ')}.`,
      troopsMoved: resultA.resolved,
      sourceZones: resultA.sourceZones,
      timestamp: new Date(),
    });
  }

  if (remaining <= 0) {
    return {
      affectedZoneId: affectedZone._id,
      originalDensity: affectedZone.densityScore,
      newDensity: newDensityScore,
      newZScore,
      deltaT: delta,
      steps,
      status: 'AdjacentPool',
      troopsResolved: delta,
      remainingDeficit: 0,
      movedPersonnel: movedAll,
      warningMessage: null,
    };
  }

  // ── Step B ────────────────────────────────────────────────────────────────
  const resultB = stepB_globalReserve(
    remaining,
    newHeatmapColor,
    updatedStandby,
    shiftStart,
  );

  if (resultB.resolved > 0) {
    updatedStandby = resultB.remaining;
    movedAll.push(...resultB.moved);
    remaining -= resultB.resolved;

    steps.push({
      step: 'B',
      action: `Pulled ${resultB.resolved} officers from global reserve pool.`,
      troopsMoved: resultB.resolved,
      sourceZones: ['GLOBAL_RESERVE'],
      timestamp: new Date(),
    });
  }

  if (remaining <= 0) {
    return {
      affectedZoneId: affectedZone._id,
      originalDensity: affectedZone.densityScore,
      newDensity: newDensityScore,
      newZScore,
      deltaT: delta,
      steps,
      status: 'GlobalReserve',
      troopsResolved: delta,
      remainingDeficit: 0,
      movedPersonnel: movedAll,
      warningMessage: `Global reserve partially depleted. ${updatedStandby.length} officers remaining in standby.`,
    };
  }

  // ── Step C ────────────────────────────────────────────────────────────────
  steps.push(stepC_escalation(remaining, affectedZone._id));

  return {
    affectedZoneId: affectedZone._id,
    originalDensity: affectedZone.densityScore,
    newDensity: newDensityScore,
    newZScore,
    deltaT: delta,
    steps,
    status: 'Escalation',
    troopsResolved: delta - remaining,
    remainingDeficit: remaining,
    movedPersonnel: movedAll,
    warningMessage: `CRITICAL — ${remaining} officers still needed at Zone ${affectedZone.name}. Manual override required.`,
  };
}

// ─── Mass Absence Patch ───────────────────────────────────────────────────────
// Called when 10% of a zone's force marks themselves on leave before a shift

export interface AbsencePatchInput {
  affectedZone: Zone;
  absentOfficers: Personnel[];
  shift: ShiftName;
  shiftStart: Date;
  allZoneSnapshots: ZoneSnapshot[];
  allAllocations: ZoneAllocation[];
  deployedPersonnel: Map<string, Personnel[]>;
  standbyPool: Personnel[];
  weights: { w_s: number; w_d: number };
}

export function patchMassAbsence(input: AbsencePatchInput): ResolutionResult {
  // Treat absence as a synthetic density spike — same resolution cascade
  // We don't change D, we just treat the deficit as the absent headcount
  return resolveIncident({
    affectedZone: input.affectedZone,
    newDensityScore: input.affectedZone.densityScore, // D unchanged
    shift: input.shift,
    shiftStart: input.shiftStart,
    allZoneSnapshots: input.allZoneSnapshots,
    allAllocations: input.allAllocations,
    deployedPersonnel: new Map(
      Array.from(input.deployedPersonnel.entries()).map(([zoneId, officers]) =>
        zoneId === input.affectedZone._id
          ? [zoneId, officers.filter(o => !input.absentOfficers.find(a => a._id === o._id))]
          : [zoneId, officers]
      )
    ),
    standbyPool: input.standbyPool,
    weights: input.weights,
  });
}