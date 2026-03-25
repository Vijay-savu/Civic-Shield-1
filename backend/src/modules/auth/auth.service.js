const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("./auth.model");
const { logAuditAction } = require("../audit/audit.service");
const { jwtSecret, jwtExpiresIn, otpExpiryMinutes, nodeEnv } = require("../../config/env");

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function deriveRiskScore(failedLoginCount) {
  if (failedLoginCount >= 5) {
    return "High";
  }

  if (failedLoginCount >= 3) {
    return "Medium";
  }

  return "Low";
}

async function safeAudit(payload) {
  try {
    await logAuditAction(payload);
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    riskScore: user.riskScore,
    lastLoginAt: user.lastLoginAt,
  };
}

async function registerUser({ email, password, role }) {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 6) {
    const error = new Error("Password must be at least 6 characters long");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error("Email already registered");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    role: role === "Admin" ? "Admin" : "Citizen",
  });

  return sanitizeUser(user);
}

async function loginWithPassword({ email, password, ipAddress, userAgent }) {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
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
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    user.failedLoginCount += 1;
    user.lastFailedLoginAt = new Date();
    user.riskScore = deriveRiskScore(user.failedLoginCount);
    await user.save();

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress,
      userAgent,
      metadata: {
        reason: "invalid_credentials",
        failedLoginCount: user.failedLoginCount,
        riskScore: user.riskScore,
      },
    });

    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const otpCode = generateOtpCode();
  user.otpHash = hashOtp(otpCode);
  user.otpExpiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
  user.otpAttempts = 0;
  await user.save();

  await safeAudit({
    action: "login",
    outcome: "info",
    actorId: user._id,
    actorEmail: user.email,
    actorRole: user.role,
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
  };
}

async function verifyOtpAndIssueToken({ email, otp, ipAddress, userAgent }) {
  if (!email || !otp) {
    const error = new Error("Email and OTP are required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.otpHash || !user.otpExpiresAt) {
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
    throw error;
  }

  if (user.otpExpiresAt.getTime() < Date.now()) {
    user.otpHash = null;
    user.otpExpiresAt = null;
    await user.save();

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress,
      userAgent,
      metadata: {
        reason: "otp_expired",
      },
    });

    const error = new Error("OTP expired. Please login again.");
    error.statusCode = 401;
    throw error;
  }

  if (user.otpAttempts >= 5) {
    user.riskScore = "High";
    await user.save();

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress,
      userAgent,
      metadata: {
        reason: "otp_attempt_limit_exceeded",
        riskScore: user.riskScore,
      },
    });

    const error = new Error("Too many invalid OTP attempts. Login again.");
    error.statusCode = 429;
    throw error;
  }

  const isOtpValid = hashOtp(String(otp).trim()) === user.otpHash;
  if (!isOtpValid) {
    user.otpAttempts += 1;
    user.failedLoginCount += 1;
    user.lastFailedLoginAt = new Date();
    user.riskScore = deriveRiskScore(user.failedLoginCount);
    await user.save();

    await safeAudit({
      action: "login",
      outcome: "failure",
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress,
      userAgent,
      metadata: {
        reason: "invalid_otp",
        otpAttempts: user.otpAttempts,
        failedLoginCount: user.failedLoginCount,
        riskScore: user.riskScore,
      },
    });

    const error = new Error("Invalid OTP");
    error.statusCode = 401;
    throw error;
  }

  user.otpHash = null;
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
  user.failedLoginCount = 0;
  user.riskScore = "Low";
  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  await safeAudit({
    action: "login",
    outcome: "success",
    actorId: user._id,
    actorEmail: user.email,
    actorRole: user.role,
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
