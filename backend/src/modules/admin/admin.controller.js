const { getAdminOverviewData } = require("./admin.service");

async function getAdminLogs(req, res, next) {
  try {
    const data = await getAdminOverviewData({
      requester: req.user,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAdminLogs,
};
