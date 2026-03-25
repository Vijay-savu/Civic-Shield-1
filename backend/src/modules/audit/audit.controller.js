const { listAuditLogs } = require("./audit.service");

async function getAuditLogs(req, res, next) {
  try {
    const logs = await listAuditLogs({ limit: req.query.limit });

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAuditLogs,
};
