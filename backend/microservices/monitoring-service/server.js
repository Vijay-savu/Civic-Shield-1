const app = require("./app");
const { startService } = require("../common/serviceServer");

const port = Number(process.env.MONITORING_SERVICE_PORT || 5004);

startService({
  app,
  port,
  serviceName: "monitoring-service",
});
