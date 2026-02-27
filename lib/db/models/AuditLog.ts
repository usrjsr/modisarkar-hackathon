import mongoose from "mongoose"

const AuditLogSchema = new mongoose.Schema(
{
  entityType: {
    type: String,
    enum: ["Zone","Personnel","Deployment","Roster","SystemConfig"]
  },

  entityId: mongoose.Schema.Types.ObjectId,

  action: {
    type: String,
    enum: [
      "CREATE",
      "UPDATE",
      "DELETE",
      "LOCK",
      "UNLOCK",
      "DEPLOY",
      "REDISTRIBUTE",
      "OVERRIDE"
    ]
  },

  previousVersion: Number,
  newVersion: Number,

  previousState: Object,
  newState: Object,

  conflictDetected: Boolean,
  conflictResolution: String,

  userId: mongoose.Schema.Types.ObjectId,
  sessionId: String,
  ipAddress: String
},
{ timestamps: true }
)

export default mongoose.models.AuditLog ||
mongoose.model("AuditLog", AuditLogSchema)