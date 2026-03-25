const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { uploadDocument, getMyDocuments, deleteMyDocument, getDocumentIntegrity } = require("./document.controller");
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
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const mimeType = String(file.mimetype || "").toLowerCase();

    const allowedMimeTypes = new Set([
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/json",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    const allowedExtensions = new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".bmp",
      ".gif",
      ".tif",
      ".tiff",
      ".heic",
      ".heif",
      ".pdf",
      ".txt",
      ".csv",
      ".json",
      ".md",
      ".doc",
      ".docx",
    ]);

    const isAllowed =
      mimeType.startsWith("image/") ||
      allowedMimeTypes.has(mimeType) ||
      allowedExtensions.has(extension);

    if (!isAllowed) {
      const error = new Error("Unsupported file type. Use image, PDF, or common document formats.");
      error.statusCode = 415;
      error.reason = "unsupported_file_type";
      return cb(error);
    }

    return cb(null, true);
  },
  limits: {
    fileSize: maxUploadSizeMb * 1024 * 1024,
  },
});

router.post("/upload", upload.single("document"), uploadDocument);
router.get("/mine", getMyDocuments);
router.delete("/:documentId", deleteMyDocument);
router.get("/:documentId/integrity", getDocumentIntegrity);

module.exports = router;
