const Verification = require("./verification.model");
const {
  eligibilityIncomeThreshold,
} = require("../../config/env");
const {
  getDocumentForRequester,
  verifyDocumentIntegrity,
} = require("../document/document.service");

async function evaluateEligibility({ documentId, requester }) {
  const document = await getDocumentForRequester({ documentId, requester });
  const integrityResult = await verifyDocumentIntegrity(document);

  let eligibilityStatus = "Not Eligible";
  let decisionReason = "income_not_available";

  if (integrityResult.integrityStatus === "Tampered") {
    decisionReason = "tamper_detected";
  } else if (typeof document.extractedIncome !== "number") {
    decisionReason = "income_not_available";
  } else if (document.extractedIncome < eligibilityIncomeThreshold) {
    eligibilityStatus = "Eligible";
    decisionReason = "income_below_threshold";
  } else {
    eligibilityStatus = "Not Eligible";
    decisionReason = "income_above_threshold";
  }

  const verification = await Verification.create({
    documentId: document._id,
    citizenId: document.userId,
    verifiedBy: requester.sub,
    eligibilityStatus,
    integrityStatus: integrityResult.integrityStatus,
    decisionReason,
  });

  return {
    verificationId: verification._id.toString(),
    documentId: document._id.toString(),
    eligibilityStatus,
    integrityStatus: integrityResult.integrityStatus,
    privacy: {
      incomeExposed: false,
      outputPolicy: "decision_only",
    },
    verifiedAt: verification.createdAt,
  };
}

module.exports = {
  evaluateEligibility,
};
