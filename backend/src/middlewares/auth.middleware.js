const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      status: "rejected",
      reason: "token_missing",
      message: "Unauthorized: Missing Bearer token",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = {
      sub: payload.sub,
      email: payload.email,
      role: String(payload.role || "citizen").toLowerCase(),
      riskScore: payload.riskScore || "Low",
    };
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      status: "rejected",
      reason: "token_modified_or_invalid",
      message: "Unauthorized: Invalid or modified token",
    });
  }
}

function requireRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) => String(role).toLowerCase());

  return (req, res, next) => {
    const requesterRole = String(req.user?.role || "").toLowerCase();

    if (!requesterRole || !normalizedRoles.includes(requesterRole)) {
      return res.status(403).json({
        success: false,
        status: "rejected",
        reason: "insufficient_role",
        message: "Forbidden: Insufficient role",
      });
    }

    return next();
  };
}

module.exports = { authenticateToken, requireRoles };
