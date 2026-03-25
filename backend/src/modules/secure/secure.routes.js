const express = require("express");

const router = express.Router();

router.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Secure route access granted",
    data: {
      user: req.user,
      zeroTrust: "JWT verified on this request",
    },
  });
});

module.exports = router;
