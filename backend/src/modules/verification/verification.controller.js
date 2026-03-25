const { logAuditAction } = require("../audit/audit.service");
const { evaluateEligibility } = require("./verification.service");

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function verifyEligibility(req, res, next) {
  try {
    const result = await evaluateEligibility({
      documentId: req.params.documentId,
      requester: req.user,
    });

    await safeAudit({
      action: "verification",
      outcome: "success",
      actorId: req.user.sub,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: "document",
      targetId: req.params.documentId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        verificationId: result.verificationId,
        eligibilityStatus: result.eligibilityStatus,
        integrityStatus: result.integrityStatus,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Eligibility verified",
      data: result,
    });
  } catch (error) {
    await safeAudit({
      action: "verification",
      outcome: "failure",
      actorId: req.user?.sub,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      targetType: "document",
      targetId: req.params.documentId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        reason: error.message,
      },
    });

    return next(error);
  }
}

module.exports = {
  verifyEligibility,
};
