const rateLimit = require("express-rate-limit");
const { loginRateLimitMax, loginRateLimitWindowMinutes } = require("../config/env");

const loginRateLimiter = rateLimit({
  windowMs: loginRateLimitWindowMinutes * 60 * 1000,
  max: loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: `Too many login attempts. Try again after ${loginRateLimitWindowMinutes} minutes.`,
  },
});

module.exports = {
  loginRateLimiter,
};
