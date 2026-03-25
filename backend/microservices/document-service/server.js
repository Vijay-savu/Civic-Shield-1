const app = require("./app");
const { startService } = require("../common/serviceServer");

const port = Number(process.env.DOCUMENT_SERVICE_PORT || 5002);

startService({
  app,
  port,
  serviceName: "document-service",
});
