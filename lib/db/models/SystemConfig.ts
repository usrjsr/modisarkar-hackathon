import mongoose from "mongoose"

const SystemConfigSchema = new mongoose.Schema(
{
  totalForce: Number,

  forceComposition: {
    DGP: Number,
    ADGP: Number,
    IG: Number,
    DIG: Number,
    SP: Number,
    DSP: Number,
    ASP: Number,
    Inspector: Number,
    SI: Number,
    ASI: Number,
    HeadConstable: Number,
    Constable: Number
  },

  weights: {
    w_s: Number,
    w_d: Number
  },

  standbyPercentage: {
    type: Number,
    default: 0.15
  },

  shiftConfig: {
    morning: {
      start: String,
      end: String
    },
    evening: {
      start: String,
      end: String
    },
    night: {
      start: String,
      end: String
    }
  },

  restHours: {
    lowerRanks: Number,
    inspectors: Number
  },

  fatigueWeights: {
    nightShift: Number,
    emergencyDeployment: Number,
    standardShift: Number
  },

  version: {
    type: Number,
    default: 0
  }
},
{ timestamps: true }
)

export default mongoose.models.SystemConfig ||
mongoose.model("SystemConfig", SystemConfigSchema)