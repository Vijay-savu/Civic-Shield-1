const express = require("express");
const { requireRoles } = require("../../middlewares/auth.middleware");
const { simulateFailedLogin, simulateTampering } = require("./demo.controller");

const router = express.Router();

router.post("/simulate-failed-login", requireRoles("admin"), simulateFailedLogin);
router.post("/simulate-tampering/:id", requireRoles("admin"), simulateTampering);

module.exports = router;
