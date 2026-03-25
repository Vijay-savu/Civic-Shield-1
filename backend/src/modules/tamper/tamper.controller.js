const { logAuditAction } = require("../audit/audit.service");
const { monitor } = require("../../utils/monitor.util");
const {
  getDocumentIntegrityStatusForUser,
} = require("../document/document.service");

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function checkTamper(req, res, next) {
  try {
    const result = await getDocumentIntegrityStatusForUser({
      documentId: req.params.id,
      requester: req.user,
      ipAddress: req.ip,
      source: "tamper.check",
    });

    monitor("tampering", {
      actorEmail: req.user.email,
      documentId: req.params.id,
      status: result.status,
      reason: result.reason,
      riskScore: result.riskScore,
      ipAddress: req.ip,
    });

    await safeAudit({
      action: "tampering",
      outcome: result.status === "safe" ? "success" : "failure",
      actorId: req.user.sub,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: "document",
      targetId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        status: result.status,
        reason: result.reason,
        riskScore: result.riskScore,
      },
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  checkTamper,
};
