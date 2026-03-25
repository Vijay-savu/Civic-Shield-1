const alertsRoutes = require("../../src/modules/alerts/alerts.routes");
const adminRoutes = require("../../src/modules/admin/admin.routes");
const auditRoutes = require("../../src/modules/audit/audit.routes");
const demoRoutes = require("../../src/modules/demo/demo.routes");
const { authenticateToken } = require("../../src/middlewares/auth.middleware");
const { createServiceApp } = require("../common/serviceApp");

const app = createServiceApp({
  serviceName: "monitoring-service",
  registerRoutes: (serviceApp) => {
    serviceApp.use(authenticateToken);
    serviceApp.use("/api/v1/alerts", alertsRoutes);
    serviceApp.use("/api/v1/admin", adminRoutes);
    serviceApp.use("/api/v1/audit", auditRoutes);
    serviceApp.use("/api/v1/demo", demoRoutes);
  },
});

module.exports = app;
