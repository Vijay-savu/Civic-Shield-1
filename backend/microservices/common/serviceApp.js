const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { notFoundHandler, errorHandler } = require("../../src/middlewares/error.middleware");

function createServiceApp({ serviceName, registerRoutes }) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true,
      service: serviceName,
      message: `${serviceName} is healthy`,
    });
  });

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createServiceApp };
