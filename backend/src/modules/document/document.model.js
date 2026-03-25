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
    documentType: {
      type: String,
      enum: [
        "aadhaar_card",
        "pan_card",
        "ration_card",
        "voter_id",
        "passport",
        "birth_certificate",
        "driving_licence",
        "income_certificate",
      ],
      required: true,
    },
    extractedIncome: {
      type: Number,
      default: null,
    },
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ocrStatus: {
      type: String,
      enum: ["extracted", "not_found", "failed"],
      default: "not_found",
    },
    validationStatus: {
      type: String,
      enum: ["valid", "invalid"],
      default: "invalid",
    },
    validationReason: {
      type: String,
      default: "document_needs_review",
    },
  },
  { timestamps: true }
);

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
