const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("./auth.model");
const { logAuditAction } = require("../audit/audit.service");
const { createAlert } = require("../alerts/alerts.service");
const { calculateRiskScore } = require("../../utils/risk.util");
const { monitor } = require("../../utils/monitor.util");
const { jwtSecret, jwtExpiresIn, otpExpiryMinutes, nodeEnv } = require("../../config/env");

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeRole(role) {
  return String(role || "citizen").toLowerCase() === "admin" ? "admin" : "citizen";
}

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function safeAlert(payload) {
  try {
    await createAlert(payload);
  } catch (error) {
    console.error("Alert write failed:", error.message);
  }
}

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: normalizeRole(user.role),
    riskScore: user.riskScore,
    lastLoginAt: user.lastLoginAt,
  };
}

async function maybeRaiseFailedLoginAlert({ user, ipAddress }) {
  if (user.failedLoginCount < 3) {
    return;
  }

  await safeAlert({
    type: "failed_login_attempts",
    riskScore: user.riskScore,
    message: "Multiple failed login attempts detected",
    actorId: user._id,
    actorEmail: user.email,
    actorRole: normalizeRole(user.role),
    source: "auth.login",
    ipAddress,
    metadata: {
      failedLoginCount: user.failedLoginCount,
    },
  });
}

async function registerUser({ email, password, role }) {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    error.reason = "missing_credentials";
    throw error;
  }

  if (password.length < 6) {
    const error = new Error("Password must be at least 6 characters long");
    error.statusCode = 400;
    error.reason = "weak_password";
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error("Email already registered");
    error.statusCode = 409;
    error.reason = "email_exists";
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedRole = normalizeRole(role);

  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: normalizedRole,
  });

  return sanitizeUser(user);
}

async function loginWithPassword({ email, password, ipAddress, userAgent }) {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    error.reason = "missing_credentials";
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    monitor("login", { email: normalizedEmail, status: "failed", reason: "invalid_credentials", ipAddress });

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorEmail: normalizedEmail,
      ipAddress,
      userAgent,
      metadata: {
        reason: "invalid_credentials",
        riskScore: "Low",
      },
    });

    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    error.reason = "invalid_credentials";
    error.riskScore = "Low";
    throw error;
  }

  user.role = normalizeRole(user.role);

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    user.failedLoginCount += 1;
    user.lastFailedLoginAt = new Date();
    user.riskScore = calculateRiskScore(user.failedLoginCount);
    await user.save();

    monitor("login", {
      email: user.email,
      status: "failed",
      reason: "invalid_credentials",
      failedLoginCount: user.failedLoginCount,
      riskScore: user.riskScore,
      ipAddress,
    });

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: normalizeRole(user.role),
      ipAddress,
      userAgent,
      metadata: {
        reason: "invalid_credentials",
        failedLoginCount: user.failedLoginCount,
        riskScore: user.riskScore,
      },
    });

    await maybeRaiseFailedLoginAlert({ user, ipAddress });

    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    error.reason = "invalid_credentials";
    error.riskScore = user.riskScore;
    throw error;
  }

  const otpCode = generateOtpCode();
  user.otpHash = hashOtp(otpCode);
  user.otpExpiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
  user.otpAttempts = 0;
  await user.save();

  monitor("otp", {
    email: user.email,
    status: "generated",
    riskScore: user.riskScore,
    ipAddress,
  });

  await safeAudit({
    action: "login",
    outcome: "info",
    actorId: user._id,
    actorEmail: user.email,
    actorRole: normalizeRole(user.role),
    ipAddress,
    userAgent,
    metadata: {
      stage: "otp_generated",
      riskScore: user.riskScore,
    },
  });

  return {
    message: "OTP generated. Verify OTP to complete login.",
    email: user.email,
    otpPreview: nodeEnv !== "production" ? otpCode : undefined,
    riskScore: user.riskScore,
  };
}

async function verifyOtpAndIssueToken({ email, otp, ipAddress, userAgent }) {
  if (!email || !otp) {
    const error = new Error("Email and OTP are required");
    error.statusCode = 400;
    error.reason = "missing_otp_fields";
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.otpHash || !user.otpExpiresAt) {
    monitor("otp", { email: normalizedEmail, status: "failed", reason: "no_active_otp_session", ipAddress });

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorEmail: normalizedEmail,
      ipAddress,
      userAgent,
      metadata: {
        reason: "no_active_otp_session",
      },
    });

    const error = new Error("No active OTP session. Login again.");
    error.statusCode = 401;
    error.reason = "no_active_otp_session";
    throw error;
  }

  user.role = normalizeRole(user.role);

  if (user.otpExpiresAt.getTime() < Date.now()) {
    user.otpHash = null;
    user.otpExpiresAt = null;
    await user.save();

    monitor("otp", { email: user.email, status: "failed", reason: "otp_expired", ipAddress });

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: normalizeRole(user.role),
      ipAddress,
      userAgent,
      metadata: {
        reason: "otp_expired",
      },
    });

    const error = new Error("OTP expired. Please login again.");
    error.statusCode = 401;
    error.reason = "otp_expired";
    throw error;
  }

  if (user.otpAttempts >= 5) {
    user.riskScore = "High";
    await user.save();

    monitor("otp", { email: user.email, status: "failed", reason: "otp_attempt_limit_exceeded", ipAddress });

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: normalizeRole(user.role),
      ipAddress,
      userAgent,
      metadata: {
        reason: "otp_attempt_limit_exceeded",
        riskScore: user.riskScore,
      },
    });

    await safeAlert({
      type: "failed_login_attempts",
      riskScore: "High",
      message: "OTP attempts exceeded threshold",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: normalizeRole(user.role),
      source: "auth.verify-otp",
      ipAddress,
      metadata: {
        otpAttempts: user.otpAttempts,
      },
    });

    const error = new Error("Too many invalid OTP attempts. Login again.");
    error.statusCode = 429;
    error.reason = "otp_attempt_limit_exceeded";
    error.riskScore = "High";
    throw error;
  }

  const isOtpValid = hashOtp(String(otp).trim()) === user.otpHash;
  if (!isOtpValid) {
    user.otpAttempts += 1;
    user.failedLoginCount += 1;
    user.lastFailedLoginAt = new Date();
    user.riskScore = calculateRiskScore(user.failedLoginCount);
    await user.save();

    monitor("otp", {
      email: user.email,
      status: "failed",
      reason: "invalid_otp",
      otpAttempts: user.otpAttempts,
      failedLoginCount: user.failedLoginCount,
      riskScore: user.riskScore,
      ipAddress,
    });

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: normalizeRole(user.role),
      ipAddress,
      userAgent,
      metadata: {
        reason: "invalid_otp",
        otpAttempts: user.otpAttempts,
        failedLoginCount: user.failedLoginCount,
        riskScore: user.riskScore,
      },
    });

    await maybeRaiseFailedLoginAlert({ user, ipAddress });

    const error = new Error("Invalid OTP");
    error.statusCode = 401;
    error.reason = "invalid_otp";
    error.riskScore = user.riskScore;
    throw error;
  }

  user.otpHash = null;
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
  user.failedLoginCount = 0;
  user.riskScore = "Low";
  user.lastLoginAt = new Date();
  await user.save();

  const normalizedRole = normalizeRole(user.role);

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: normalizedRole,
      riskScore: user.riskScore,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  monitor("otp", {
    email: user.email,
    status: "verified",
    riskScore: user.riskScore,
    ipAddress,
  });

  await safeAudit({
    action: "login",
    outcome: "success",
    actorId: user._id,
    actorEmail: user.email,
    actorRole: normalizedRole,
    ipAddress,
    userAgent,
    metadata: {
      stage: "otp_verified",
      riskScore: user.riskScore,
    },
  });

  return {
    token,
    user: sanitizeUser(user),
  };
}

async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    error.reason = "user_not_found";
    throw error;
  }

  return sanitizeUser(user);
}

module.exports = {
  registerUser,
  loginWithPassword,
  verifyOtpAndIssueToken,
  getCurrentUser,
};
