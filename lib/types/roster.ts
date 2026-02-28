import type { ShiftName } from '../constants/shifts';
import type { PersonnelRef } from './personnel';

export interface ShiftDeployment {
  zoneId: string;
  personnel: PersonnelRef[];
  personnelIds?: string[];       // Lean IDs used by scheduler (avoids massive memory)
  totalStrength: number;
  requiredStrength: number;
  deficit: number; // 0 = fully staffed, positive = understaffed
  status: 'Scheduled' | 'Active' | 'Completed' | 'Modified' | 'Critical';
}

export interface ShiftBlock {
  shift: ShiftName;
  startTime: string; // e.g. "06:00"
  endTime: string;   // e.g. "14:00"
  deployments: ShiftDeployment[];
  standbyCount?: number;
}

export interface DaySchedule {
  date: Date;
  dayNumber: number;    // 1–30
  dayOfWeek: number;    // 0 = Sunday
  isHoliday: boolean;

  shifts: {
    morning: ShiftBlock;
    evening: ShiftBlock;
    night: ShiftBlock;
  };

  // Fatigue snapshot at end of day — keyed by officerId
  fatigueMatrix: Record<string, {
    score: number;
    shiftsWorked: number;
    nightShiftsWorked: number;
  }>;
}

// Config snapshot captured at roster generation time
export interface RosterConfigSnapshot {
  totalForce: number;
  activeForce: number;   // totalForce - standbyPool
  standbyPool: number;
  weights: {
    w_s: number;
    w_d: number;
  };
  totalZones: number;
  standbyPercentage?: number;
  restHours?: {
    lowerRanks: number;
    inspectors: number;
  };
}

export interface RosterViolation {
  type: 'RestViolation' | 'FatigueViolation' | 'UnderstaffedZone' | 'CompositionViolation';
  description: string;
  severity: 'warning' | 'critical';
  affectedOfficerId?: string;
  affectedZoneId?: string;
  dayNumber?: number;
  shift?: ShiftName;
}

// Full 30-day roster document
export interface Roster {
  _id: string;
  generatedAt: Date;
  validFrom: Date;
  validUntil: Date;

  configSnapshot: RosterConfigSnapshot;
  schedule: DaySchedule[]; // Array of 30 DaySchedule objects

  violations: RosterViolation[];

  isActive: boolean;
  replacedBy: string | null; // Roster _id if regenerated
}

// What the scheduler returns before DB persistence
export interface RosterDraft {
  validFrom: Date;
  validUntil: Date;
  configSnapshot: RosterConfigSnapshot;
  schedule: DaySchedule[];
  violations: RosterViolation[];
}

// Query type — used by roster API to fetch a specific cell
export interface RosterCellQuery {
  zoneId: string;
  dayNumber: number;
  shift: ShiftName;
}

// Response for a single clicked roster cell
export interface RosterCellDetail {
  zoneId: string;
  zoneName: string;
  date: Date;
  shift: ShiftName;
  personnel: PersonnelRef[];
  totalStrength: number;
  requiredStrength: number;
  status: ShiftDeployment['status'];
}