const { logAuditAction } = require("../audit/audit.service");
const { monitor } = require("../../utils/monitor.util");
const {
  uploadDocumentForUser,
  getDocumentIntegrityStatusForUser,
} = require("./document.service");

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const result = await uploadDocumentForUser({
      file: req.file,
      userId: req.user.sub,
    });

    monitor("uploads", {
      actorEmail: req.user.email,
      status: result.status,
      reason: result.reason,
      ipAddress: req.ip,
    });

    await safeAudit({
      action: "upload",
      outcome: "success",
      actorId: req.user.sub,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: "document",
      targetId: result.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        status: result.status,
        reason: result.reason,
      },
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    monitor("uploads", {
      actorEmail: req.user?.email,
      status: "failed",
      reason: error.reason || error.message,
      ipAddress: req.ip,
    });

    await safeAudit({
      action: "upload",
      outcome: "failure",
      actorId: req.user?.sub,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      targetType: "document",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        reason: error.reason || error.message,
      },
    });

    return next(error);
  }
}

async function getDocumentIntegrity(req, res, next) {
  try {
    const result = await getDocumentIntegrityStatusForUser({
      documentId: req.params.documentId,
      requester: req.user,
      ipAddress: req.ip,
      source: "document.integrity",
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
  uploadDocument,
  getDocumentIntegrity,
};
