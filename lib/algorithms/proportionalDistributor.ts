import { DEFAULT_WEIGHTS, STANDBY_POOL_PERCENTAGE, SAFE_THRESHOLD_FRACTION, HEATMAP_THRESHOLDS } from '../constants/thresholds';
import { MIN_ZONE_COMPOSITION } from '../constants/ranks';
import type { Zone, ZoneAllocation } from '../types/zone';
import type { HeatmapColor } from '../constants/thresholds';

export interface DistributionInput {
  totalForce: number;
  zones: Zone[];
  weights?: { w_s: number; w_d: number };
  standbyPercentage?: number; // Dynamic from SystemConfig, defaults to STANDBY_POOL_PERCENTAGE
}

export interface DistributionResult {
  standbyPool: number;        // Headcount reserved
  activeForce: number;        // Headcount for field deployment
  allocations: ZoneAllocation[];
  totalZScore: number;
  violations: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateZScore(S: number, D: number, w_s: number, w_d: number): number {
  return (w_s * S + w_d * D) / (w_s + w_d);
}

function resolveHeatmapColor(zScore: number): HeatmapColor {
  // zScore is 1–10, map to heatmap bands
  const normalised = ((zScore - 1) / 9) * 10; // scale to 0–10
  if (normalised >= HEATMAP_THRESHOLDS.red.min) return 'red';
  if (normalised >= HEATMAP_THRESHOLDS.orange.min) return 'orange';
  if (normalised >= HEATMAP_THRESHOLDS.yellow.min) return 'yellow';
  return 'green';
}

function meetsMinimumComposition(allocation: number): boolean {
  // A zone needs at least 1 Inspector + 1 SI + 1 ASI = 3 senior officers
  const minimumRequired = Object.values(MIN_ZONE_COMPOSITION).reduce((a, b) => a + b, 0);
  return allocation >= minimumRequired;
}

// ─── Core ───────────────────────────────────────────────────────────────────

export function distributeForce(input: DistributionInput): DistributionResult {
  const { totalForce, zones } = input;
  const w_s = input.weights?.w_s ?? DEFAULT_WEIGHTS.w_s;
  const w_d = input.weights?.w_d ?? DEFAULT_WEIGHTS.w_d;
  const standbyFraction = input.standbyPercentage ?? STANDBY_POOL_PERCENTAGE;
  const violations: string[] = [];

  if (zones.length === 0) {
    throw new Error('Cannot distribute force across zero zones.');
  }
  if (totalForce <= 0) {
    throw new Error('Total force must be a positive integer.');
  }

  // ── Step 1: Reserve standby pool ──────────────────────────────────────────
  const standbyPool = Math.floor(totalForce * standbyFraction);
  const activeForce = totalForce - standbyPool;

  // ── Step 2: Calculate Z-score for every zone ──────────────────────────────
  const scored = zones.map(zone => ({
    zone,
    zScore: calculateZScore(zone.sizeScore, zone.densityScore, w_s, w_d),
  }));

  const totalZScore = scored.reduce((sum, { zScore }) => sum + zScore, 0);

  if (totalZScore === 0) {
    throw new Error('Total Z-score is zero — all zones have S=0 and D=0.');
  }

  // ── Step 3: Proportional allocation (raw, may be fractional) ─────────────
  const rawAllocations = scored.map(({ zone, zScore }) => ({
    zone,
    zScore,
    raw: (zScore / totalZScore) * activeForce,
  }));

  // ── Step 4: Floor allocations, collect remainders ─────────────────────────
  let remainder = activeForce;
  const floored = rawAllocations.map(({ zone, zScore, raw }) => {
    const floored = Math.floor(raw);
    remainder -= floored;
    return { zone, zScore, allocation: floored, fractional: raw - floored };
  });

  // ── Step 5: Distribute remainder to highest-fractional zones ─────────────
  floored
    .sort((a, b) => b.fractional - a.fractional)
    .forEach((entry, idx) => {
      if (idx < remainder) entry.allocation += 1;
    });

  // ── Step 6: Build final allocations + validate ───────────────────────────
  const allocations: ZoneAllocation[] = floored.map(({ zone, zScore, allocation }) => {
    const safeThreshold = Math.ceil(allocation * SAFE_THRESHOLD_FRACTION);
    const heatmapColor = resolveHeatmapColor(zScore);

    if (!meetsMinimumComposition(allocation)) {
      violations.push(
        `Zone "${zone.name}" allocated only ${allocation} officers — below minimum composition (3 senior officers required).`
      );
    }

    return {
      zoneId: zone._id,
      zScore: parseFloat(zScore.toFixed(4)),
      allocation,
      safeThreshold,
      heatmapColor,
    };
  });

  // ── Step 7: Sanity check total ────────────────────────────────────────────
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocation, 0);
  if (totalAllocated !== activeForce) {
    violations.push(
      `Allocation mismatch: distributed ${totalAllocated} but activeForce is ${activeForce}.`
    );
  }

  return {
    standbyPool,
    activeForce,
    allocations,
    totalZScore: parseFloat(totalZScore.toFixed(4)),
    violations,
  };
}

// ─── Re-calculate a single zone's Z-score after a density spike ──────────────
// Used by deficitResolver when D changes mid-shift

export function recalculateZoneScore(
  S: number,
  newD: number,
  weights?: { w_s: number; w_d: number }
): { zScore: number; heatmapColor: HeatmapColor } {
  const w_s = weights?.w_s ?? DEFAULT_WEIGHTS.w_s;
  const w_d = weights?.w_d ?? DEFAULT_WEIGHTS.w_d;
  const zScore = calculateZScore(S, newD, w_s, w_d);
  return {
    zScore: parseFloat(zScore.toFixed(4)),
    heatmapColor: resolveHeatmapColor(zScore),
  };
}

// ─── Calculate new troop requirement after a density spike ───────────────────
// Returns ΔT = Tnew - Tcurrent

export function calculateDeficit(
  zone: Zone,
  newDensityScore: number,
  currentDeployment: number,
  totalAllocations: ZoneAllocation[],
  weights?: { w_s: number; w_d: number }
): { newRequirement: number; delta: number; newZScore: number } {
  const w_s = weights?.w_s ?? DEFAULT_WEIGHTS.w_s;
  const w_d = weights?.w_d ?? DEFAULT_WEIGHTS.w_d;

  const oldAllocation = totalAllocations.find(a => a.zoneId === zone._id);
  const totalZScoreOld = totalAllocations.reduce((sum, a) => sum + a.zScore, 0);

  const newZScore = calculateZScore(zone.sizeScore, newDensityScore, w_s, w_d);

  // Recalculate this zone's share proportionally within existing active force
  const activeForce = totalAllocations.reduce((sum, a) => sum + a.allocation, 0);
  const newZScoreTotal = totalZScoreOld - (oldAllocation?.zScore ?? 0) + newZScore;
  const newRequirement = Math.ceil((newZScore / newZScoreTotal) * activeForce);

  const delta = newRequirement - currentDeployment;

  return {
    newRequirement,
    delta,
    newZScore: parseFloat(newZScore.toFixed(4)),
  };
}