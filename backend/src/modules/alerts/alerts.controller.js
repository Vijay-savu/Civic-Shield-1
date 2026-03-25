const { listAlerts } = require("./alerts.service");

async function getAlerts(req, res, next) {
  try {
    const alerts = await listAlerts({
      limit: req.query.limit,
      requester: req.user,
    });

    return res.status(200).json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAlerts,
};
