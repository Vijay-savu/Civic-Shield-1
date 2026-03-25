const express = require("express");

const router = express.Router();

router.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
      reason: "secure_route_access_granted",
      user: req.user,
    },
  });
});

router.get("/token-validate", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "valid",
      reason: "token_verified",
      riskScore: req.user.riskScore || "Low",
    },
  });
});

module.exports = router;
