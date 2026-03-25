const express = require("express");
const { verifyEligibility } = require("./verification.controller");

const router = express.Router();

router.post("/check/:documentId", verifyEligibility);

module.exports = router;
