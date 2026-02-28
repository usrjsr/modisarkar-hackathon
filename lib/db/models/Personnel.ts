import mongoose from "mongoose"

const PersonnelSchema = new mongoose.Schema(
  {
    badgeNumber: String,
    name: String,

    email: {
      type: String,
      unique: true,
      sparse: true
    },

    password: String,

    role: {
      type: String,
      enum: ["ADMIN", "COMMAND", "OFFICER"],
      default: "OFFICER"
    },

    rank: {
      type: String,
      enum: [
        "DGP", "ADGP", "IG", "DIG", "SP",
        "DSP", "ASP", "Inspector", "SI",
        "ASI", "HeadConstable", "Constable"
      ]
    },

    commandLevel: {
      type: String,
      enum: ["Command", "Strategic", "ZoneManager", "SectorDuty"]
    },

    homeZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone"
    },

    currentZones: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone"
    }],

    fatigueScore: {
      type: Number,
      default: 0
    },

    fatigueHistory: [
      {
        date: Date,
        shift: String,
        zoneId: mongoose.Schema.Types.ObjectId,
        points: Number,
        reason: String
      }
    ],

    status: {
      type: String,
      enum: ["Active", "OnLeave", "Standby", "Deployed", "Unavailable"]
    },

    leavePeriods: [
      {
        startDate: Date,
        endDate: Date,
        reason: String,
        approvedBy: mongoose.Schema.Types.ObjectId
      }
    ],

    lastShiftEnd: Date,
    consecutiveNightShifts: Number,
    totalDeployments: Number,
    nextAvailableAt: Date,

    version: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
)

PersonnelSchema.index({ rank: 1, status: 1, fatigueScore: 1 })
PersonnelSchema.index({ currentZones: 1, status: 1 })
PersonnelSchema.index({ email: 1 })

export default mongoose.models.Personnel ||
  mongoose.model("Personnel", PersonnelSchema)