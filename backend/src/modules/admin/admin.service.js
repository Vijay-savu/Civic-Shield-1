const { listAuditLogs } = require("../audit/audit.service");
const { listAlerts } = require("../alerts/alerts.service");

async function getAdminLogsData({ limit = 50, requester }) {
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

  const [auditLogs, alerts] = await Promise.all([
    listAuditLogs({ limit: parsedLimit }),
    listAlerts({ limit: parsedLimit, requester: { role: "admin" } }),
  ]);

  const loginAttempts = auditLogs.filter((log) => log.action === "login");
  const uploads = auditLogs.filter((log) => log.action === "upload");
  const tampering = [
    ...auditLogs.filter((log) => log.action === "tampering"),
    ...auditLogs.filter(
      (log) => log.action === "verification" && log.metadata?.reason === "tampering_detected"
    ),
  ];

  return {
    status: "ok",
    reason: "admin_logs_retrieved",
    loginAttempts,
    uploads,
    tampering,
    alerts,
    requestedBy: requester?.email || null,
  };
}

module.exports = {
  getAdminLogsData,
};
