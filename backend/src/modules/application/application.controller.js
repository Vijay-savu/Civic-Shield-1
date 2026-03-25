const { logAuditAction } = require("../audit/audit.service");
const { monitor } = require("../../utils/monitor.util");
const {
  createLoanApplication,
  listMyApplications,
  getMyApplicationSummary,
  listApplicationsForAdmin,
  reviewApplicationByAdmin,
  getLoanRequirements,
} = require("./application.service");

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function getRequirements(_req, res, next) {
  try {
    const data = getLoanRequirements();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function createApplication(req, res, next) {
  try {
    const result = await createLoanApplication({
      payload: req.body,
      requester: req.user,
      ipAddress: req.ip,
    });

    monitor("verification", {
      actorEmail: req.user.email,
      status: result.decisionStatus,
      reason: result.decisionReason,
      riskScore: result.riskScore,
      ipAddress: req.ip,
    });

    await safeAudit({
      action: "verification",
      outcome: "success",
      actorId: req.user.sub,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: "application",
      targetId: result.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        schemeName: result.schemeName,
        decisionStatus: result.decisionStatus,
        decisionReason: result.decisionReason,
      },
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    await safeAudit({
      action: "verification",
      outcome: "failure",
      actorId: req.user?.sub,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      targetType: "application",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        reason: error.reason || error.message,
      },
    });
    return next(error);
  }
}

async function getMyApplications(req, res, next) {
  try {
    const result = await listMyApplications({ requester: req.user });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getSummary(req, res, next) {
  try {
    const result = await getMyApplicationSummary({ requester: req.user });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function getAdminApplications(req, res, next) {
  try {
    const result = await listApplicationsForAdmin({
      status: req.query.status,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function reviewAdminApplication(req, res, next) {
  try {
    const result = await reviewApplicationByAdmin({
      applicationId: req.params.applicationId,
      action: req.body?.action,
      reason: req.body?.reason,
      reviewer: req.user,
    });

    monitor("verification", {
      actorEmail: req.user.email,
      status: result.decisionStatus,
      reason: result.decisionReason,
      riskScore: result.riskScore,
      ipAddress: req.ip,
    });

    await safeAudit({
      action: "application_review",
      outcome: "success",
      actorId: req.user.sub,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: "application",
      targetId: result.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        reviewAction: result.reviewAction,
        reviewReason: result.reviewReason,
        decisionStatus: result.decisionStatus,
      },
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    await safeAudit({
      action: "application_review",
      outcome: "failure",
      actorId: req.user?.sub,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      targetType: "application",
      targetId: req.params?.applicationId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        reason: error.reason || error.message,
      },
    });

    return next(error);
  }
}

module.exports = {
  getRequirements,
  createApplication,
  getMyApplications,
  getSummary,
  getAdminApplications,
  reviewAdminApplication,
};
