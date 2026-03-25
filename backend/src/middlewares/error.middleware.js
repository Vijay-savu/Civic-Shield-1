function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
}

function errorHandler(error, _req, res, _next) {
  if (error && error.name === "MulterError") {
    const multerStatus = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(multerStatus).json({
      success: false,
      message: error.message,
    });
  }

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
  });
}

module.exports = { notFoundHandler, errorHandler };
