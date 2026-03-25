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
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await loginWithPassword(req.body);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        email: result.email,
        otpPreview: result.otpPreview,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const result = await verifyOtpAndIssueToken(req.body);
    return res.status(200).json({
      success: true,
      message: "MFA verification successful",
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
