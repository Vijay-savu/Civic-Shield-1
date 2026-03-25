const AuditLog = require("./audit.model");

async function logAuditAction(payload) {
  return AuditLog.create(payload);
}

async function listAuditLogs({ limit = 50, actions = [] }) {
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const query = {};

  if (Array.isArray(actions) && actions.length > 0) {
    query.action = { $in: actions };
  }

  return AuditLog.find(query).sort({ createdAt: -1 }).limit(parsedLimit).lean();
}

module.exports = {
  logAuditAction,
  listAuditLogs,
};
