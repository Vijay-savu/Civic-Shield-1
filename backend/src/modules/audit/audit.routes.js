const express = require("express");
const { requireRoles } = require("../../middlewares/auth.middleware");
const { getAuditLogs } = require("./audit.controller");

const router = express.Router();

router.get("/logs", requireRoles("Admin"), getAuditLogs);

module.exports = router;
