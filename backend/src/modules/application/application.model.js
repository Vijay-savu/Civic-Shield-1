const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    schemeName: {
      type: String,
      required: true,
      trim: true,
    },
    applicantName: {
      type: String,
      required: true,
      trim: true,
    },
    residentialAddress: {
      type: String,
      required: true,
      trim: true,
    },
    applicantAge: {
      type: Number,
      default: null,
      min: 0,
    },
    documents: {
      aadhaarDocumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null,
      },
      panDocumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null,
      },
      incomeDocumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null,
      },
      birthCertificateDocumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null,
      },
      rationCardDocumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null,
      },
      drivingLicenceDocumentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
        default: null,
      },
    },
    decisionStatus: {
      type: String,
      enum: ["Eligible", "Not Eligible", "Needs Review", "Suspicious"],
      required: true,
    },
    documentsStatus: {
      type: String,
      enum: ["Verified", "Needs Review"],
      required: true,
    },
    incomeCheckStatus: {
      type: String,
      enum: ["Available", "Unavailable"],
      required: true,
    },
    decisionReason: {
      type: String,
      required: true,
      trim: true,
    },
    riskScore: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    reviewAction: {
      type: String,
      enum: ["accepted", "denied", null],
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

applicationSchema.index({ citizenId: 1, createdAt: -1 });

const Application = mongoose.model("Application", applicationSchema);

module.exports = Application;
