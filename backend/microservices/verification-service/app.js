const verificationRoutes = require("../../src/modules/verification/verification.routes");
const applicationRoutes = require("../../src/modules/application/application.routes");
const { authenticateToken } = require("../../src/middlewares/auth.middleware");
const { createServiceApp } = require("../common/serviceApp");

const app = createServiceApp({
  serviceName: "verification-service",
  registerRoutes: (serviceApp) => {
    serviceApp.use(authenticateToken);
    serviceApp.use("/api/v1/verification", verificationRoutes);
    serviceApp.use("/api/v1/applications", applicationRoutes);
  },
});

module.exports = app;
