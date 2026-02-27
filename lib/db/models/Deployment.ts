import mongoose from "mongoose"

const DeploymentSchema = new mongoose.Schema(
{
  zoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Zone"
  },

  date: Date,

  shift: {
    type: String,
    enum: ["morning","evening","night"]
  },

  personnel: [
    {
      officerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Personnel"
      },
      rank: String,
      role: String,
      isReserve: Boolean,
      deployedAt: Date,
      fatigueAtDeployment: Number
    }
  ],

  totalStrength: Number,
  requiredStrength: Number,
  deficit: Number,

  status: {
    type: String,
    enum: ["Scheduled","Active","Completed","Modified","Critical"]
  },

  lockedBy: mongoose.Schema.Types.ObjectId,
  lockedAt: Date,

  version: {
    type: Number,
    default: 0
  },

  modifiedBy: mongoose.Schema.Types.ObjectId
},
{ timestamps: true }
)

DeploymentSchema.index({ zoneId: 1, date: 1, shift: 1 })

export default mongoose.models.Deployment ||
mongoose.model("Deployment", DeploymentSchema)