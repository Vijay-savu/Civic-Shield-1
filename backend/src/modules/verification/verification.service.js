const Verification = require("./verification.model");
const { eligibilityIncomeThreshold } = require("../../config/env");
const { maxRiskScore } = require("../../utils/risk.util");
const { getDocumentForRequester, verifyDocumentIntegrity } = require("../document/document.service");

async function evaluateEligibility({ documentId, requester, ipAddress }) {
  const document = await getDocumentForRequester({ documentId, requester });
  const integrity = await verifyDocumentIntegrity({
    document,
    requester,
    ipAddress,
    source: "verification.eligibility",
  });

  let status = "Not Eligible";
  let reason = "income_not_available";

  if (integrity.integrityStatus === "compromised") {
    reason = "tampering_detected";
  } else if (document.documentType !== "income_certificate") {
    reason = "income_certificate_required";
  } else if (document.validationStatus !== "valid") {
    reason = "invalid_income_document";
  } else if (typeof document.extractedIncome !== "number") {
    reason = "income_not_available";
  } else if (document.extractedIncome < eligibilityIncomeThreshold) {
    status = "Eligible";
    reason = "income_below_threshold";
  } else {
    status = "Not Eligible";
    reason = "income_above_threshold";
  }

  const riskScore = maxRiskScore(requester.riskScore || "Low", integrity.riskScore || "Low");

  const verification = await Verification.create({
    documentId: document._id,
    citizenId: document.userId,
    verifiedBy: requester.sub,
    eligibilityStatus: status,
    integrityStatus: integrity.integrityStatus === "safe" ? "Verified" : "Tampered",
    decisionReason: reason,
  });

  return {
    verificationId: verification._id.toString(),
    status,
    reason,
    riskScore,
  };
}

module.exports = {
  evaluateEligibility,
};
