const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { loginRateLimiter } = require("../../middlewares/rate-limit.middleware");
const { register, login, verifyOtp, me } = require("./auth.controller");

const router = express.Router();

router.post("/register", register);
router.post("/login", loginRateLimiter, login);
router.post("/verify-otp", verifyOtp);
router.get("/me", authenticateToken, me);

module.exports = router;
