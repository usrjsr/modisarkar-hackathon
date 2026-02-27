export const SHIFTS = {
  MORNING: {
    code: "morning",
    label: "Morning Shift",
    startTime: "06:00",
    endTime: "14:00",
    duration: 8,
    displayTime: "06:00 - 14:00",
    fatigueMultiplier: 1.0
  },
  EVENING: {
    code: "evening",
    label: "Evening Shift",
    startTime: "14:00",
    endTime: "22:00",
    duration: 8,
    displayTime: "14:00 - 22:00",
    fatigueMultiplier: 1.1
  },
  NIGHT: {
    code: "night",
    label: "Night Shift",
    startTime: "22:00",
    endTime: "06:00",
    duration: 8,
    displayTime: "22:00 - 06:00",
    fatigueMultiplier: 1.5
  }
} as const

export const SHIFT_ORDER = ["morning", "evening", "night"] as const

export const ROSTER_DURATION_DAYS = 30
export const STANDBY_POOL_PERCENTAGE = 0.15
export const WEIGHT_SIZE = 0.4
export const WEIGHT_DENSITY = 0.6

export const STATUS_TYPES = {
  Active: "Active",
  OnLeave: "OnLeave",
  Standby: "Standby",
  Deployed: "Deployed",
  Unavailable: "Unavailable"
} as const

export const HEATMAP_COLORS = {
  red: { label: "Critical", threshold: 8, color: "bg-red-600" },
  orange: { label: "High", threshold: 6, color: "bg-orange-600" },
  yellow: { label: "Moderate", threshold: 4, color: "bg-yellow-500" },
  green: { label: "Safe", threshold: 0, color: "bg-green-600" }
} as const
