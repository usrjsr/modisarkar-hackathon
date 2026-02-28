import mongoose from "mongoose"

const IncidentSchema = new mongoose.Schema(
  {
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone"
    },

    triggeredBy: mongoose.Schema.Types.ObjectId,

    triggeredAt: Date,
    originalDensity: Number,
    newDensity: Number,
    delta: Number,

    resolution: {
      status: {
        type: String,
        enum: [
          "Pending",
          "AdjacentPool",
          "GlobalReserve",
          "Escalation",
          "Resolved",
          "Failed"
        ]
      },

      steps: [
        {
          step: {
            type: String,
            enum: ["A", "B", "C"]  // fixed: was Number
          },
          action: String,
          troopsMoved: Number,
          sourceZones: [String],
          timestamp: Date
        }
      ],

      finalStrength: Number,
      deficitResolved: Boolean,
      remainingDeficit: Number
    },

    manualOverride: {
      applied: Boolean,
      by: mongoose.Schema.Types.ObjectId,
      notes: String,
      troopsAdded: Number
    }
  },
  { timestamps: true }
)

IncidentSchema.index({ zoneId: 1, triggeredAt: -1 })
IncidentSchema.index({ "resolution.status": 1 })

// Force recompile to pick up schema changes (e.g. sourceZones: [String])
if (mongoose.models.Incident) {
  delete mongoose.models.Incident
}

export default mongoose.model("Incident", IncidentSchema)