const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["failed_login_attempts", "rate_limit_exceeded", "tampering_detected"],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
    riskScore: {
      type: String,
      enum: ["Low", "Medium", "High"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    actorRole: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      default: null,
    },
    targetType: {
      type: String,
      default: null,
    },
    targetId: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

alertSchema.index({ createdAt: -1 });
alertSchema.index({ type: 1, status: 1, createdAt: -1 });

const Alert = mongoose.model("Alert", alertSchema);

module.exports = Alert;
