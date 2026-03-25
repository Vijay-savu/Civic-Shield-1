const express = require("express");
const { requireRoles } = require("../../middlewares/auth.middleware");
const { getAdminLogs } = require("./admin.controller");

const router = express.Router();

router.get("/logs", requireRoles("admin"), getAdminLogs);

module.exports = router;
