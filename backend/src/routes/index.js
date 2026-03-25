const express = require("express");

const authRoutes = require("../modules/auth/auth.routes");
const secureRoutes = require("../modules/secure/secure.routes");
const documentRoutes = require("../modules/document/document.routes");
const { authenticateToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use("/auth", authRoutes);

// Zero Trust baseline: all non-auth APIs require JWT.
router.use(authenticateToken);
router.use("/secure", secureRoutes);
router.use("/documents", documentRoutes);

module.exports = router;
