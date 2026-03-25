const User = require("../auth/auth.model");
const { createAlert } = require("../alerts/alerts.service");
const { logAuditAction } = require("../audit/audit.service");
const { simulateTamperingById } = require("../document/document.service");
const { calculateRiskScore } = require("../../utils/risk.util");
const { monitor } = require("../../utils/monitor.util");

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function simulateFailedLogin(req, res, next) {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const attempts = Math.max(1, Number(req.body?.attempts) || 5);

    if (!email) {
      const error = new Error("Email is required");
      error.statusCode = 400;
      error.reason = "missing_email";
      throw error;
    }

    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.reason = "user_not_found";
      throw error;
    }

    user.failedLoginCount += attempts;
    user.lastFailedLoginAt = new Date();
    user.riskScore = calculateRiskScore(user.failedLoginCount);
    await user.save();

    await createAlert({
      type: "failed_login_attempts",
      riskScore: user.riskScore,
      message: "Demo-triggered failed login anomaly",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      source: "demo.simulate-failed-login",
      ipAddress: req.ip,
      metadata: {
        attemptsInjected: attempts,
        failedLoginCount: user.failedLoginCount,
      },
    });

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        reason: "demo_simulated_failed_login",
        riskScore: user.riskScore,
        failedLoginCount: user.failedLoginCount,
      },
    });

    monitor("login", {
      actorEmail: user.email,
      status: "simulated_failure",
      reason: "demo_trigger",
      riskScore: user.riskScore,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: {
        status: "simulated",
        reason: "failed_login_attempts_injected",
        riskScore: user.riskScore,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function simulateTampering(req, res, next) {
  try {
    const result = await simulateTamperingById({
      documentId: req.params.id,
    });

    await createAlert({
      type: "tampering_detected",
      riskScore: "High",
      message: "Demo-triggered tampering event",
      actorId: req.user.sub,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      source: "demo.simulate-tampering",
      targetType: "document",
      targetId: req.params.id,
      ipAddress: req.ip,
      metadata: {
        mode: "demo",
      },
    });

    await safeAudit({
      action: "tampering",
      outcome: "info",
      actorId: req.user.sub,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: "document",
      targetId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        reason: "demo_simulated_tampering",
      },
    });

    monitor("tampering", {
      actorEmail: req.user.email,
      documentId: req.params.id,
      status: result.status,
      reason: result.reason,
      riskScore: "High",
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      data: {
        status: "simulated",
        reason: "tampering_injected",
        riskScore: "High",
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  simulateFailedLogin,
  simulateTampering,
};
