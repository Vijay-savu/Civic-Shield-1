const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const secureRoutes = require("../modules/secure/secure.routes");
const documentRoutes = require("../modules/document/document.routes");
const verificationRoutes = require("../modules/verification/verification.routes");
const auditRoutes = require("../modules/audit/audit.routes");
const alertsRoutes = require("../modules/alerts/alerts.routes");
const adminRoutes = require("../modules/admin/admin.routes");
const tamperRoutes = require("../modules/tamper/tamper.routes");
const demoRoutes = require("../modules/demo/demo.routes");
const { authenticateToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use("/auth", authRoutes);

// Zero Trust baseline: all non-auth APIs require JWT.
router.use(authenticateToken);
router.use("/secure", secureRoutes);
router.use("/documents", documentRoutes);
router.use("/verification", verificationRoutes);
router.use("/audit", auditRoutes);
router.use("/alerts", alertsRoutes);
router.use("/admin", adminRoutes);
router.use("/demo", demoRoutes);
router.use("/", tamperRoutes);

module.exports = router;
