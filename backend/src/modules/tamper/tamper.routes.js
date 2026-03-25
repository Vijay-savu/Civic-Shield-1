const express = require("express");
const { checkTamper } = require("./tamper.controller");

const router = express.Router();

router.get("/check-tamper/:id", checkTamper);

module.exports = router;
