const documentRoutes = require("../../src/modules/document/document.routes");
const tamperRoutes = require("../../src/modules/tamper/tamper.routes");
const { authenticateToken } = require("../../src/middlewares/auth.middleware");
const { createServiceApp } = require("../common/serviceApp");

const app = createServiceApp({
  serviceName: "document-service",
  registerRoutes: (serviceApp) => {
    serviceApp.use(authenticateToken);
    serviceApp.use("/api/v1/documents", documentRoutes);
    serviceApp.use("/api/v1", tamperRoutes);
  },
});

module.exports = app;
