const { resilienceFallbackMessage } = require("../config/env");

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    status: "not_found",
    reason: "route_not_found",
    message: `Route not found: ${req.originalUrl}`,
  });
}

function errorHandler(error, _req, res, _next) {
  if (error && error.name === "MulterError") {
    const multerStatus = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(multerStatus).json({
      success: false,
      status: "failed",
      reason: error.code || "multer_error",
      message: error.message,
    });
  }

  const statusCode = error.statusCode || 500;
  const riskScore = error.riskScore || undefined;

  if (statusCode >= 500) {
    return res.status(statusCode).json({
      success: false,
      status: "fallback",
      reason: "service_failure",
      message: error.message || "Internal server error",
      fallbackMessage: resilienceFallbackMessage,
      riskScore,
    });
  }

  return res.status(statusCode).json({
    success: false,
    status: "failed",
    reason: error.reason || "request_rejected",
    message: error.message || "Request failed",
    riskScore,
  });
}

module.exports = { notFoundHandler, errorHandler };
