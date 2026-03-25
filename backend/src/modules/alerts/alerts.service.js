const Alert = require("./alerts.model");
const { logAuditAction } = require("../audit/audit.service");
const { monitor } = require("../../utils/monitor.util");

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function createAlert(payload) {
  const alert = await Alert.create(payload);

  monitor("alerts", {
    type: payload.type,
    riskScore: payload.riskScore,
    actorEmail: payload.actorEmail,
    targetId: payload.targetId,
  });

  await safeAudit({
    action: "alert",
    outcome: "info",
    actorId: payload.actorId,
    actorEmail: payload.actorEmail,
    actorRole: payload.actorRole,
    targetType: "alert",
    targetId: alert._id.toString(),
    ipAddress: payload.ipAddress,
    metadata: {
      type: payload.type,
      riskScore: payload.riskScore,
      source: payload.source,
    },
  });

  return alert;
}

async function listAlerts({ limit = 50, requester }) {
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const query = {};

  if (String(requester?.role || "").toLowerCase() !== "admin") {
    query.$or = [
      { actorId: requester?.sub || null },
      { actorEmail: requester?.email || "" },
    ];
  }

  return Alert.find(query).sort({ createdAt: -1 }).limit(parsedLimit).lean();
}

module.exports = {
  createAlert,
  listAlerts,
};
