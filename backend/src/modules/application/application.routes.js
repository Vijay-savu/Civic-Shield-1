const express = require("express");
const { requireRoles } = require("../../middlewares/auth.middleware");
const {
  getRequirements,
  createApplication,
  getMyApplications,
  getSummary,
  getAdminApplications,
  reviewAdminApplication,
} = require("./application.controller");

const router = express.Router();

router.get("/admin/list", requireRoles("admin"), getAdminApplications);
router.patch("/admin/:applicationId/review", requireRoles("admin"), reviewAdminApplication);

router.get("/requirements", requireRoles("citizen"), getRequirements);
router.get("/summary", requireRoles("citizen"), getSummary);
router.get("/mine", requireRoles("citizen"), getMyApplications);
router.post("/", requireRoles("citizen"), createApplication);

module.exports = router;
