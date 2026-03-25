const {
  registerUser,
  loginWithPassword,
  verifyOtpAndIssueToken,
  getCurrentUser,
} = require("./auth.service");

async function register(req, res, next) {
  try {
    const user = await registerUser(req.body);
    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await loginWithPassword({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({
      success: true,
      status: result.status,
      reason: result.reason,
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const result = await verifyOtpAndIssueToken({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json({
      success: true,
      status: "authenticated",
      reason: "otp_verified",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.sub);
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  verifyOtp,
  me,
};
