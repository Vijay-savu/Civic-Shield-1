const AuditLog = require("./audit.model");

async function logAuditAction(payload) {
  return AuditLog.create(payload);
}

async function listAuditLogs({ limit = 50 }) {
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  return AuditLog.find().sort({ createdAt: -1 }).limit(parsedLimit).lean();
}

module.exports = {
  logAuditAction,
  listAuditLogs,
};
