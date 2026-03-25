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
  loginRateLimitWindowMinutes: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || 15),
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 5),
  uploadDir: process.env.UPLOAD_DIR || "uploads/documents",
  eligibilityIncomeThreshold: Number(process.env.ELIGIBILITY_INCOME_THRESHOLD || 250000),
  resilienceFallbackMessage:
    process.env.RESILIENCE_FALLBACK_MESSAGE ||
    "Service temporarily unavailable. Showing fallback response.",
  nodeEnv: process.env.NODE_ENV || "development",
};
