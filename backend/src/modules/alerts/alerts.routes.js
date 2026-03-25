const express = require("express");
const { getAlerts } = require("./alerts.controller");

const router = express.Router();

router.get("/", getAlerts);

module.exports = router;
