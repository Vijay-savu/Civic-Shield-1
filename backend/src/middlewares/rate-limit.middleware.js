const rateLimit = require("express-rate-limit");
const { loginRateLimitMax, loginRateLimitWindowMinutes } = require("../config/env");
const { createAlert } = require("../modules/alerts/alerts.service");

function safeCreateRateLimitAlert(payload) {
  createAlert(payload).catch((error) => {
    console.error("Rate-limit alert creation failed:", error.message);
  });
}

const loginRateLimiter = rateLimit({
  windowMs: loginRateLimitWindowMinutes * 60 * 1000,
  max: loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const email = String(req.body?.email || "").toLowerCase().trim() || null;

    safeCreateRateLimitAlert({
      type: "rate_limit_exceeded",
      riskScore: "High",
      message: "Rate limit exceeded on login endpoint",
      actorEmail: email,
      source: "auth.login",
      ipAddress: req.ip,
      metadata: {
        route: req.originalUrl,
        limit: loginRateLimitMax,
        windowMinutes: loginRateLimitWindowMinutes,
      },
    });

    return res.status(429).json({
      success: false,
      status: "blocked",
      reason: "rate_limit_exceeded",
      riskScore: "High",
      message: `Too many login attempts. Try again after ${loginRateLimitWindowMinutes} minutes.`,
    });
  },
});

module.exports = {
  loginRateLimiter,
};
