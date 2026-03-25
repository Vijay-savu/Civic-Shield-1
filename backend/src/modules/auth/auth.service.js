const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("./auth.model");
const { logAuditAction } = require("../audit/audit.service");
const { createAlert } = require("../alerts/alerts.service");
const { calculateRiskScore } = require("../../utils/risk.util");
const { monitor } = require("../../utils/monitor.util");
const {
  jwtSecret,
  jwtExpiresIn,
  otpExpiryMinutes,
  demoFixedOtp,
  demoLoginPassword,
  loginFailureThreshold,
  loginFailureWindowMinutes,
  loginAccountLockMinutes,
  nodeEnv,
} = require("../../config/env");

const LOGIN_FAILURE_WINDOW_MS = loginFailureWindowMinutes * 60 * 1000;
const LOGIN_ACCOUNT_LOCK_MS = loginAccountLockMinutes * 60 * 1000;

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeRole(role) {
  return String(role || "citizen").toLowerCase() === "admin" ? "admin" : "citizen";
}

function getRemainingLockMinutes(lockUntil) {
  const remainingMs = Math.max(0, Number(lockUntil?.getTime?.() || 0) - Date.now());
  return Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
}

function getRemainingLockSeconds(lockUntil) {
  const remainingMs = Math.max(0, Number(lockUntil?.getTime?.() || 0) - Date.now());
  return Math.max(1, Math.ceil(remainingMs / 1000));
}

async function ensureDemoCredentialsUser(email) {
  if (nodeEnv === "production") {
    return;
  }

  const demoUsers = [
    {
      email: "vijay@gmail.com",
      password: String(demoLoginPassword || "123456"),
      role: "citizen",
    },
    {
      email: "nikhila@gmail.com",
      password: "654321",
      role: "citizen",
    },
    {
      email: "vijay2@gmail.com",
      password: "12345678",
      role: "admin",
    },
  ];

  const matched = demoUsers.find(
    (item) => String(item.email || "").toLowerCase().trim() === email
  );

  if (!matched) {
    return;
  }

  const role = normalizeRole(matched.role);
  const passwordHash = await bcrypt.hash(String(matched.password), 12);
  const existingUser = await User.findOne({ email: matched.email });

  if (!existingUser) {
    await User.create({
      email: matched.email,
      passwordHash,
      role,
    });
    return;
  }

  existingUser.passwordHash = passwordHash;
  existingUser.role = role;
  await existingUser.save();
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
  await ensureDemoCredentialsUser(normalizedEmail);
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
  const now = Date.now();

  if (user.loginBlockedUntil && user.loginBlockedUntil.getTime() > now) {
    const remainingSeconds = getRemainingLockSeconds(user.loginBlockedUntil);
    const remainingMinutes = getRemainingLockMinutes(user.loginBlockedUntil);

    monitor("login", {
      email: user.email,
      status: "blocked",
      reason: "login_temporarily_blocked",
      failedLoginCount: user.failedLoginCount,
      riskScore: "High",
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
        reason: "login_temporarily_blocked",
        failedLoginCount: user.failedLoginCount,
        lockRemainingMinutes: remainingMinutes,
      },
    });

    const error = new Error(
      `Too many invalid credentials. Account is temporarily blocked. Try again after ${remainingMinutes} minutes.`
    );
    error.statusCode = 429;
    error.reason = "login_temporarily_blocked";
    error.riskScore = "High";
    error.retryAfterSeconds = remainingSeconds;
    error.blockedUntil = user.loginBlockedUntil.toISOString();
    throw error;
  }

  if (user.loginBlockedUntil && user.loginBlockedUntil.getTime() <= now) {
    user.loginBlockedUntil = null;
    user.failedLoginCount = 0;
    user.lastFailedLoginAt = null;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const lastFailedAtMs = Number(user.lastFailedLoginAt?.getTime?.() || 0);
    const isOutsideWindow = !lastFailedAtMs || now - lastFailedAtMs > LOGIN_FAILURE_WINDOW_MS;

    user.failedLoginCount = isOutsideWindow ? 1 : user.failedLoginCount + 1;
    user.lastFailedLoginAt = new Date(now);
    user.riskScore = calculateRiskScore(user.failedLoginCount);

    if (user.failedLoginCount >= loginFailureThreshold) {
      user.loginBlockedUntil = new Date(now + LOGIN_ACCOUNT_LOCK_MS);
      user.riskScore = "High";
      await user.save();

      monitor("login", {
        email: user.email,
        status: "blocked",
        reason: "login_temporarily_blocked",
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
          reason: "login_temporarily_blocked",
          failedLoginCount: user.failedLoginCount,
          lockMinutes: loginAccountLockMinutes,
          lockUntil: user.loginBlockedUntil,
        },
      });

      await safeAlert({
        type: "rate_limit_exceeded",
        riskScore: "High",
        message: `Account locked after ${loginFailureThreshold} failed login attempts within ${loginFailureWindowMinutes} minutes`,
        actorId: user._id,
        actorEmail: user.email,
        actorRole: normalizeRole(user.role),
        source: "auth.login",
        ipAddress,
        metadata: {
          failedLoginCount: user.failedLoginCount,
          windowMinutes: loginFailureWindowMinutes,
          lockMinutes: loginAccountLockMinutes,
          lockUntil: user.loginBlockedUntil,
        },
      });

      const error = new Error(
        `Too many invalid credentials. Account locked for ${loginAccountLockMinutes} minutes.`
      );
      error.statusCode = 429;
      error.reason = "login_temporarily_blocked";
      error.riskScore = "High";
      error.retryAfterSeconds = loginAccountLockMinutes * 60;
      error.blockedUntil = user.loginBlockedUntil.toISOString();
      throw error;
    }

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

  user.otpHash = null;
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
  user.failedLoginCount = 0;
  user.lastFailedLoginAt = null;
  user.loginBlockedUntil = null;
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

  monitor("login", {
    email: user.email,
    status: "success",
    reason: "password_verified",
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
      stage: "direct_login",
      riskScore: user.riskScore,
    },
  });

  return {
    token,
    user: sanitizeUser(user),
    status: "authenticated",
    reason: "password_verified",
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
  await ensureDemoCredentialsUser(normalizedEmail);
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

  const submittedOtp = String(otp).trim();
  const isDemoOtp = nodeEnv !== "production" && submittedOtp === String(demoFixedOtp);
  const isOtpValid = isDemoOtp || hashOtp(submittedOtp) === user.otpHash;
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




