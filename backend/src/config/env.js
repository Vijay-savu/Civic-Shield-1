const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "replace-with-a-strong-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5),
  demoFixedOtp: process.env.DEMO_FIXED_OTP || "1234",
  demoLoginEmail: process.env.DEMO_LOGIN_EMAIL || "vijay@gmail.com",
  demoLoginPassword: process.env.DEMO_LOGIN_PASSWORD || "123456",
  demoLoginRole: process.env.DEMO_LOGIN_ROLE || "admin",
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 5),
  loginRateLimitWindowMinutes: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || 5),
  loginFailureThreshold: Number(process.env.LOGIN_FAILURE_THRESHOLD || 5),
  loginFailureWindowMinutes: Number(process.env.LOGIN_FAILURE_WINDOW_MINUTES || 5),
  loginAccountLockMinutes: Number(process.env.LOGIN_ACCOUNT_LOCK_MINUTES || 30),
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 5),
  uploadDir: process.env.UPLOAD_DIR || "uploads/documents",
  eligibilityIncomeThreshold: Number(process.env.ELIGIBILITY_INCOME_THRESHOLD || 250000),
  incomeFallbackAmount: Number(process.env.INCOME_FALLBACK_AMOUNT || 300000),
  forceIncomeAmount: Number(process.env.FORCE_INCOME_AMOUNT || 0),
  enforceDetectedTypeMatch:
    String(process.env.ENFORCE_DETECTED_TYPE_MATCH || "false").toLowerCase() === "true",
  enforceStrictIdentityMatch:
    String(process.env.ENFORCE_STRICT_IDENTITY_MATCH || "false").toLowerCase() === "true",
  resilienceFallbackMessage:
    process.env.RESILIENCE_FALLBACK_MESSAGE ||
    "Service temporarily unavailable. Showing fallback response.",
  nodeEnv: process.env.NODE_ENV || "development",
};
