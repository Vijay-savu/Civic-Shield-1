const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    sha256Hash: {
      type: String,
      required: true,
    },
    extractedIncome: {
      type: Number,
      default: null,
    },
    ocrStatus: {
      type: String,
      enum: ["extracted", "not_found", "failed"],
      default: "not_found",
    },
  },
  { timestamps: true }
);

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
