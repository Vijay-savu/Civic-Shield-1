const app = require("./app");
const { startService } = require("../common/serviceServer");

const port = Number(process.env.VERIFICATION_SERVICE_PORT || 5003);

startService({
  app,
  port,
  serviceName: "verification-service",
});
