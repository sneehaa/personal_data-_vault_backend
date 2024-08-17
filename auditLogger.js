const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: String, required: true },
});

const AuditLog = mongoose.model("AuditLog", auditSchema);

const logActivity = async (userId, action, details) => {
  if (!userId) {
    console.error("User ID is required to log activity.");
    return;
  }

  const log = new AuditLog({ userId, action, details });
  try {
    await log.save();
    console.log("Audit log saved successfully.");
  } catch (err) {
    console.error("Error saving audit log:", err);
  }
};


module.exports = {
  AuditLog,
  logActivity,
};
