const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing Bearer token",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or expired token",
    });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Insufficient role",
      });
    }
    return next();
  };
}

module.exports = { authenticateToken, requireRoles };
