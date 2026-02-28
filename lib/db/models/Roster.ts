import mongoose from "mongoose"

/* ── PersonnelRef sub-schema (lightweight reference stored per deployment) ── */
const PersonnelRefSchema = new mongoose.Schema(
  {
    officerId: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    rank: { type: String, required: true },
    role: { type: String, default: "field" },
    isReserve: { type: Boolean, default: false },
    deployedAt: { type: Date },
    fatigueAtDeployment: { type: Number, default: 0 },
  },
  { _id: false }
)

/* ── ShiftDeployment sub-schema (one per zone per shift) ── */
const ShiftDeploymentSchema = new mongoose.Schema(
  {
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    personnel: [PersonnelRefSchema],
    personnelIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Personnel" }],
    totalStrength: { type: Number, default: 0 },
    requiredStrength: { type: Number, default: 0 },
    deficit: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Scheduled", "Active", "Completed", "Modified", "Critical"],
      default: "Scheduled",
    },
  },
  { _id: false }
)

/* ── ShiftBlock sub-schema (morning / evening / night) ── */
const ShiftBlockSchema = new mongoose.Schema(
  {
    shift: { type: String, enum: ["morning", "evening", "night"], required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    deployments: [ShiftDeploymentSchema],
    standbyCount: { type: Number, default: 0 },
    totalDeployed: { type: Number, default: 0 },
    totalRequired: { type: Number, default: 0 },
  },
  { _id: false }
)

/* ── DaySchedule sub-schema ── */
const DayScheduleSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    dayNumber: Number,
    dayOfWeek: Number,
    isHoliday: { type: Boolean, default: false },

    shifts: {
      morning: ShiftBlockSchema,
      evening: ShiftBlockSchema,
      night: ShiftBlockSchema,
    },

    fatigueMatrix: { type: Map, of: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
)

/* ── Config snapshot sub-schema ── */
const ConfigSnapshotSchema = new mongoose.Schema(
  {
    totalForce: Number,
    activeForce: Number,
    standbyPool: Number,
    weights: {
      w_s: Number,
      w_d: Number,
    },
    totalZones: Number,
    standbyPercentage: Number,
    restHours: {
      lowerRanks: Number,
      inspectors: Number,
    },
  },
  { _id: false }
)

/* ── Violation sub-schema ── */
const ViolationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["RestViolation", "FatigueViolation", "UnderstaffedZone", "CompositionViolation"],
    },
    description: String,
    severity: { type: String, enum: ["warning", "critical"] },
    affectedOfficerId: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel" },
    affectedZoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" },
    dayNumber: Number,
    shift: String,
  },
  { _id: false }
)

/* ── Main Roster schema ── */
const RosterSchema = new mongoose.Schema(
  {
    generatedAt: { type: Date, default: Date.now },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },

    configSnapshot: ConfigSnapshotSchema,
    schedule: [DayScheduleSchema],
    violations: [ViolationSchema],

    isActive: { type: Boolean, default: true },
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Roster", default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Roster ||
  mongoose.model("Roster", RosterSchema)