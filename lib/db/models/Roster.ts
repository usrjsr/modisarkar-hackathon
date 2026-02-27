import mongoose from "mongoose"

const RosterSchema = new mongoose.Schema(
{
  generatedAt: Date,
  validFrom: Date,
  validUntil: Date,

  configSnapshot: {
    totalForce: Number,
    weights: Object,
    standbyPool: Number
  },

  schedule: [
    {
      date: Date,
      dayOfWeek: Number,
      isHoliday: Boolean,

      shifts: {
        morning: Object,
        evening: Object,
        night: Object
      },

      fatigueMatrix: Object
    }
  ],

  violations: [
    {
      type: String,
      description: String,
      severity: String
    }
  ],

  isActive: Boolean,
  replacedBy: mongoose.Schema.Types.ObjectId
},
{ timestamps: true }
)

export default mongoose.models.Roster ||
mongoose.model("Roster", RosterSchema)