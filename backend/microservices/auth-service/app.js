const authRoutes = require("../../src/modules/auth/auth.routes");
const secureRoutes = require("../../src/modules/secure/secure.routes");
const { authenticateToken } = require("../../src/middlewares/auth.middleware");
const { createServiceApp } = require("../common/serviceApp");

const app = createServiceApp({
  serviceName: "auth-service",
  registerRoutes: (serviceApp) => {
    serviceApp.use("/api/v1/auth", authRoutes);
    serviceApp.use("/api/v1/secure", authenticateToken, secureRoutes);
  },
});

module.exports = app;
