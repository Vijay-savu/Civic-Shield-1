const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { register, login, verifyOtp, me } = require("./auth.controller");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.get("/me", authenticateToken, me);

module.exports = router;
