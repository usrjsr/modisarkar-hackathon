import type { Rank, CommandLevel } from '../constants/ranks';
import type { ShiftName } from '../constants/shifts';

export interface FatigueHistoryEntry {
  date: Date;
  shift: ShiftName;
  zoneId: string;
  points: number;
  reason: 'standardShift' | 'nightShift' | 'emergencyDeployment';
}

export interface LeavePeriod {
  startDate: Date;
  endDate: Date;
  reason: string;
  approvedBy: string; // Officer _id
}

export type PersonnelStatus = 'Active' | 'OnLeave' | 'Standby' | 'Deployed' | 'Unavailable';

export interface Personnel {
  _id: string;
  badgeNumber: string;
  name: string;
  rank: Rank;
  commandLevel: CommandLevel;

  // Assignment
  homeZone: string;        // Zone _id
  currentZones: string[];      // Zone _ids (multi-zone for DIG/SP, DSP/ASP/Inspector)

  // Fatigue
  fatigueScore: number;
  fatigueHistory: FatigueHistoryEntry[];

  // Availability
  status: PersonnelStatus;
  leavePeriods: LeavePeriod[];

  // Scheduling constraints
  lastShiftEnd: Date | null;
  consecutiveNightShifts: number;
  totalDeployments: number;
  nextAvailableAt: Date | null; // Enforces 8hr/12hr rest

  // Optimistic locking
  version: number;
  createdAt: Date;
}

// Lightweight version used inside roster/deployment arrays
export interface PersonnelRef {
  officerId: string;
  rank: Rank;
  role: string;
  isReserve: boolean;
  deployedAt: Date;
  fatigueAtDeployment: number;
}

// What the scheduler sees when picking officers for a shift
export interface PersonnelAvailability {
  officer: Personnel;
  isAvailable: boolean;
  unavailableReason?: 'onLeave' | 'restPeriod' | 'alreadyDeployed' | 'exhausted';
  nextAvailableAt: Date | null;
}

// Input to fatigueCalculator
export interface FatigueInput {
  officer: Personnel;
  shift: ShiftName;
  isEmergencyDeployment: boolean;
}

// Output from fatigueCalculator
export interface FatigueResult {
  officerId: string;
  previousScore: number;
  pointsAdded: number;
  newScore: number;
  reason: FatigueHistoryEntry['reason'];
  isFatigued: boolean; // true if newScore exceeds FATIGUE_HEAVY_ZONE_LIMIT
}

// Group of personnel organised by rank — used by scheduler for zone composition
export interface PersonnelPool {
  zoneManagers: Personnel[];  // DSP, ASP, Inspector
  sectorDuty: Personnel[];    // SI, ASI, HeadConstable, Constable
  standby: Personnel[];       // From 15% reserve pool
}