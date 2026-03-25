const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { proxyRequest } = require("./proxy");

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:5001";
const DOCUMENT_SERVICE_URL = process.env.DOCUMENT_SERVICE_URL || "http://localhost:5002";
const VERIFICATION_SERVICE_URL = process.env.VERIFICATION_SERVICE_URL || "http://localhost:5003";
const MONITORING_SERVICE_URL = process.env.MONITORING_SERVICE_URL || "http://localhost:5004";

const ROUTE_TARGETS = [
  { prefix: "/api/v1/auth", target: AUTH_SERVICE_URL, service: "auth-service" },
  { prefix: "/api/v1/secure", target: AUTH_SERVICE_URL, service: "auth-service" },
  { prefix: "/api/v1/documents", target: DOCUMENT_SERVICE_URL, service: "document-service" },
  { prefix: "/api/v1/check-tamper", target: DOCUMENT_SERVICE_URL, service: "document-service" },
  { prefix: "/api/v1/verification", target: VERIFICATION_SERVICE_URL, service: "verification-service" },
  { prefix: "/api/v1/applications", target: VERIFICATION_SERVICE_URL, service: "verification-service" },
  { prefix: "/api/v1/alerts", target: MONITORING_SERVICE_URL, service: "monitoring-service" },
  { prefix: "/api/v1/admin", target: MONITORING_SERVICE_URL, service: "monitoring-service" },
  { prefix: "/api/v1/audit", target: MONITORING_SERVICE_URL, service: "monitoring-service" },
  { prefix: "/api/v1/demo", target: MONITORING_SERVICE_URL, service: "monitoring-service" },
];

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "api-gateway",
    routing: ROUTE_TARGETS,
  });
});

app.use((req, res, next) => {
  const matched = ROUTE_TARGETS.find((entry) => req.originalUrl.startsWith(entry.prefix));
  if (!matched) {
    return next();
  }

  return proxyRequest(req, res, matched.target);
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    status: "not_found",
    reason: "route_not_found",
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use((error, _req, res, _next) => {
  res.status(500).json({
    success: false,
    status: "fallback",
    reason: "gateway_error",
    message: error?.message || "Gateway internal error",
  });
});

module.exports = app;
