const app = require("./app");
const { startService } = require("../common/serviceServer");

const port = Number(process.env.AUTH_SERVICE_PORT || 5001);

startService({
  app,
  port,
  serviceName: "auth-service",
});
