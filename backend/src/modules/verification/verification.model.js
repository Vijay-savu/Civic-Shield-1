const mongoose = require("mongoose");

const verificationSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eligibilityStatus: {
      type: String,
      enum: ["Eligible", "Not Eligible"],
      required: true,
    },
    integrityStatus: {
      type: String,
      enum: ["Verified", "Tampered"],
      required: true,
    },
    decisionReason: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

verificationSchema.index({ documentId: 1, createdAt: -1 });

const Verification = mongoose.model("Verification", verificationSchema);

module.exports = Verification;
