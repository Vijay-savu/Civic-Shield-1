const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { uploadDocument } = require("./document.controller");
const { maxUploadSizeMb, uploadDir } = require("../../config/env");

const router = express.Router();

const resolvedUploadDir = path.resolve(uploadDir);
if (!fs.existsSync(resolvedUploadDir)) {
  fs.mkdirSync(resolvedUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, resolvedUploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: maxUploadSizeMb * 1024 * 1024,
  },
});

router.post("/upload", upload.single("document"), uploadDocument);

module.exports = router;
