const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("./auth.model");
const { jwtSecret, jwtExpiresIn, otpExpiryMinutes, nodeEnv } = require("../../config/env");

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
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

async function loginWithPassword({ email, password }) {
  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const otpCode = generateOtpCode();
  user.otpHash = hashOtp(otpCode);
  user.otpExpiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
  user.otpAttempts = 0;
  await user.save();

  return {
    message: "OTP generated. Verify OTP to complete login.",
    email: user.email,
    otpPreview: nodeEnv !== "production" ? otpCode : undefined,
  };
}

async function verifyOtpAndIssueToken({ email, otp }) {
  if (!email || !otp) {
    const error = new Error("Email and OTP are required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user || !user.otpHash || !user.otpExpiresAt) {
    const error = new Error("No active OTP session. Login again.");
    error.statusCode = 401;
    throw error;
  }

  if (user.otpExpiresAt.getTime() < Date.now()) {
    user.otpHash = null;
    user.otpExpiresAt = null;
    await user.save();

    const error = new Error("OTP expired. Please login again.");
    error.statusCode = 401;
    throw error;
  }

  if (user.otpAttempts >= 5) {
    const error = new Error("Too many invalid OTP attempts. Login again.");
    error.statusCode = 429;
    throw error;
  }

  const isOtpValid = hashOtp(String(otp).trim()) === user.otpHash;
  if (!isOtpValid) {
    user.otpAttempts += 1;
    await user.save();

    const error = new Error("Invalid OTP");
    error.statusCode = 401;
    throw error;
  }

  user.otpHash = null;
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
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
