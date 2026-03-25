const mongoose = require("mongoose");
const Application = require("./application.model");
const Alert = require("../alerts/alerts.model");
const { getDocumentForRequester, verifyDocumentIntegrity } = require("../document/document.service");
const { maxRiskScore } = require("../../utils/risk.util");
const { enforceStrictIdentityMatch } = require("../../config/env");

const DOC_TYPE_LABELS = {
  aadhaar_card: "Aadhaar",
  pan_card: "PAN",
  income_certificate: "Income Certificate",
  birth_certificate: "Birth Certificate",
  ration_card: "Ration Card",
  driving_licence: "Driving Licence",
};

const DOC_TYPE_TO_PAYLOAD_FIELD = {
  aadhaar_card: "aadhaarDocumentId",
  pan_card: "panDocumentId",
  income_certificate: "incomeDocumentId",
  birth_certificate: "birthCertificateDocumentId",
  ration_card: "rationCardDocumentId",
  driving_licence: "drivingLicenceDocumentId",
};

const APPLICATION_STATUSES = ["Eligible", "Not Eligible", "Needs Review", "Suspicious"];

const SCHEME_RULES = {
  "Education Loan": {
    incomeThreshold: 500000,
    requiresIncomeCheck: true,
    requiresAgeCheck: false,
    minAge: null,
    requiredDocumentTypes: ["aadhaar_card", "pan_card", "income_certificate"],
  },
  "Subsidy Support": {
    incomeThreshold: 250000,
    requiresIncomeCheck: true,
    requiresAgeCheck: false,
    minAge: null,
    requiredDocumentTypes: ["aadhaar_card", "pan_card", "income_certificate"],
  },
  "Housing Assistance": {
    incomeThreshold: 1000000,
    requiresIncomeCheck: true,
    requiresAgeCheck: false,
    minAge: null,
    requiredDocumentTypes: ["aadhaar_card", "pan_card", "income_certificate"],
  },
  "Farmer Support": {
    incomeThreshold: 350000,
    requiresIncomeCheck: true,
    requiresAgeCheck: false,
    minAge: null,
    requiredDocumentTypes: ["aadhaar_card", "pan_card", "income_certificate"],
  },
  "Health Care Aid": {
    incomeThreshold: 400000,
    requiresIncomeCheck: true,
    requiresAgeCheck: false,
    minAge: null,
    requiredDocumentTypes: ["aadhaar_card", "pan_card", "income_certificate"],
  },
  "Senior Pension": {
    incomeThreshold: null,
    requiresIncomeCheck: false,
    requiresAgeCheck: true,
    minAge: 60,
    requiredDocumentTypes: ["aadhaar_card", "birth_certificate"],
  },
};

function formatRupees(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getSchemeRule(schemeName) {
  const normalized = String(schemeName || "").trim();
  const rule = SCHEME_RULES[normalized];
  if (!rule) {
    const error = new Error("Unsupported scheme");
    error.statusCode = 400;
    error.reason = "unsupported_scheme";
    throw error;
  }

  return {
    schemeName: normalized,
    ...rule,
  };
}

function requiredField(value, fieldName) {
  if (!String(value || "").trim()) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    error.reason = "missing_required_field";
    throw error;
  }
}

function assertDocumentType(document, expectedType, label) {
  if (document.documentType !== expectedType) {
    const error = new Error(`${label} document is invalid for this application`);
    error.statusCode = 400;
    error.reason = "invalid_document_mapping";
    throw error;
  }
}

function createDocumentsMismatchError(message = "Documents didn't match") {
  const error = new Error(message);
  error.statusCode = 422;
  error.reason = "documents_didnt_match";
  return error;
}

function tokenizeIdentity(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function toTokenSet(list) {
  return new Set((list || []).map((token) => String(token || "").toUpperCase()).filter(Boolean));
}

function intersectHasAny(left, right) {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

function getDocumentIdentityTokens(document) {
  const tokens = document?.extractedFields?.identityTokens;
  if (!Array.isArray(tokens)) {
    return [];
  }

  return tokens
    .map((token) => String(token || "").toUpperCase().trim())
    .filter((token) => token.length >= 3);
}

function ensureDocumentsBelongToApplicant({ documentsByType, requiredDocumentTypes, applicantName, requester }) {
  const expectedTokens = new Set([
    ...tokenizeIdentity(applicantName),
    ...tokenizeIdentity(String(requester?.email || "").split("@")[0]),
  ]);

  if (expectedTokens.size === 0) {
    return;
  }

  const tokenSets = [];

  for (const documentType of requiredDocumentTypes) {
    const document = documentsByType[documentType];
    if (!document) {
      continue;
    }

    const docTokens = toTokenSet(getDocumentIdentityTokens(document));
    const label = DOC_TYPE_LABELS[documentType] || documentType;

    if ((documentType === "aadhaar_card" || documentType === "pan_card") && docTokens.size === 0) {
      throw createDocumentsMismatchError(`Documents didn't match (${label} name missing)`);
    }

    if (docTokens.size > 0) {
      if (!intersectHasAny(docTokens, expectedTokens)) {
        throw createDocumentsMismatchError(`Documents didn't match applicant identity (${label})`);
      }
      tokenSets.push({ documentType, tokens: docTokens });
    }
  }

  for (let i = 0; i < tokenSets.length; i += 1) {
    for (let j = i + 1; j < tokenSets.length; j += 1) {
      if (!intersectHasAny(tokenSets[i].tokens, tokenSets[j].tokens)) {
        throw createDocumentsMismatchError("Documents didn't match each other");
      }
    }
  }
}

function toPublicApplication(application) {
  return {
    id: application._id.toString(),
    schemeName: application.schemeName,
    submittedAt: application.createdAt,
    decisionStatus: application.decisionStatus,
    decisionReason: application.decisionReason,
    documentsStatus: application.documentsStatus,
    incomeCheckStatus: application.incomeCheckStatus,
    riskScore: application.riskScore,
    reviewAction: application.reviewAction || null,
    reviewReason: application.reviewReason || "",
    reviewedAt: application.reviewedAt || null,
  };
}

function toAdminApplication(application) {
  const base = toPublicApplication(application);
  return {
    ...base,
    applicantName: application.applicantName,
    applicantAge: application.applicantAge,
    residentialAddress: application.residentialAddress,
    citizen: {
      id: application.citizenId?._id?.toString() || application.citizenId?.toString() || "",
      email: application.citizenId?.email || "unknown",
    },
    reviewedBy: application.reviewedBy?.email || "",
  };
}

function getPayloadFieldNameByDocumentType(documentType) {
  return DOC_TYPE_TO_PAYLOAD_FIELD[documentType];
}

function parseApplicantAge(ageValue, schemeName) {
  if (ageValue === null || ageValue === undefined || ageValue === "") {
    return null;
  }

  const parsed = Number(ageValue);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 120) {
    const error = new Error(`Invalid applicant age for ${schemeName}`);
    error.statusCode = 400;
    error.reason = "invalid_applicant_age";
    throw error;
  }

  return Math.floor(parsed);
}

function parseStatusFilter(status) {
  const normalized = String(status || "").trim();
  if (!normalized || normalized.toLowerCase() === "all") {
    return "all";
  }

  if (!APPLICATION_STATUSES.includes(normalized)) {
    const error = new Error("Invalid status filter");
    error.statusCode = 400;
    error.reason = "invalid_status_filter";
    throw error;
  }

  return normalized;
}

function parseReviewAction(action) {
  const normalized = String(action || "").trim().toLowerCase();
  if (!["accepted", "denied"].includes(normalized)) {
    const error = new Error("action must be accepted or denied");
    error.statusCode = 400;
    error.reason = "invalid_review_action";
    throw error;
  }

  return normalized;
}

async function createLoanApplication({ payload, requester, ipAddress }) {
  const schemeRule = getSchemeRule(payload.schemeName);
  requiredField(payload.applicantName, "applicantName");
  requiredField(payload.residentialAddress, "residentialAddress");

  const applicantAge = parseApplicantAge(payload.applicantAge, schemeRule.schemeName);
  if (schemeRule.requiresAgeCheck && applicantAge === null) {
    requiredField(payload.applicantAge, "applicantAge");
  }

  const documentsPayload = payload?.documents || {};

  for (const documentType of schemeRule.requiredDocumentTypes) {
    const payloadFieldName = getPayloadFieldNameByDocumentType(documentType);
    requiredField(documentsPayload[payloadFieldName], payloadFieldName);
  }

  const documentsByType = {};
  for (const documentType of schemeRule.requiredDocumentTypes) {
    const payloadFieldName = getPayloadFieldNameByDocumentType(documentType);
    const document = await getDocumentForRequester({
      documentId: documentsPayload[payloadFieldName],
      requester,
    });

    assertDocumentType(document, documentType, DOC_TYPE_LABELS[documentType] || documentType);
    documentsByType[documentType] = document;
  }

  let identityMismatchReason = "";
  if (enforceStrictIdentityMatch) {
    try {
      ensureDocumentsBelongToApplicant({
        documentsByType,
        requiredDocumentTypes: schemeRule.requiredDocumentTypes,
        applicantName: payload.applicantName,
        requester,
      });
    } catch (error) {
      if (error?.reason === "documents_didnt_match") {
        identityMismatchReason = error.message || "Documents didn't match";
      } else {
        throw error;
      }
    }
  }

  const integrityChecks = identityMismatchReason
    ? []
    : await Promise.all(
        schemeRule.requiredDocumentTypes.map((documentType) =>
          verifyDocumentIntegrity({
            document: documentsByType[documentType],
            requester,
            ipAddress,
            source: "application.create",
          })
        )
      );

  const integrityRisks = integrityChecks.map((entry) => entry.riskScore);
  const integrityCompromised = integrityChecks.some((entry) => entry.integrityStatus === "compromised");

  let decisionStatus = "Needs Review";
  let documentsStatus = "Needs Review";
  let incomeCheckStatus = "Unavailable";
  let decisionReason = "Required verification pending";

  if (identityMismatchReason) {
    decisionStatus = "Not Eligible";
    documentsStatus = "Needs Review";
    incomeCheckStatus = "Unavailable";
    decisionReason = `Not eligible: ${identityMismatchReason}`;
  } else if (integrityCompromised) {
    decisionStatus = "Suspicious";
    decisionReason = "Suspicious: tampering detected in one or more submitted documents.";
  } else {
    documentsStatus = "Verified";

    const failureReasons = [];
    const passReasons = [];

    if (schemeRule.requiresIncomeCheck) {
      const incomeDoc = documentsByType.income_certificate;
      if (!incomeDoc || typeof incomeDoc.extractedIncome !== "number") {
        decisionStatus = "Needs Review";
        incomeCheckStatus = "Unavailable";
        decisionReason = "Needs review: Income value could not be extracted from Income Certificate.";
      } else {
        incomeCheckStatus = "Available";
        const threshold = schemeRule.incomeThreshold;
        const income = incomeDoc.extractedIncome;

        if (income > threshold) {
          failureReasons.push(
            `Income is higher than scheme limit (${formatRupees(income)} > ${formatRupees(threshold)}).`
          );
        } else {
          passReasons.push(
            `Income is within scheme limit (${formatRupees(income)} <= ${formatRupees(threshold)}).`
          );
        }
      }
    }

    if (schemeRule.requiresAgeCheck) {
      if (applicantAge === null) {
        decisionStatus = "Needs Review";
        decisionReason = `Needs review: Applicant age is required for ${schemeRule.schemeName}.`;
      } else if (applicantAge < schemeRule.minAge) {
        failureReasons.push(`Applicant age ${applicantAge} is below minimum required age ${schemeRule.minAge}.`);
      } else {
        passReasons.push(`Applicant age ${applicantAge} meets minimum age ${schemeRule.minAge}.`);
      }
    }

    if (decisionStatus !== "Needs Review" || decisionReason === "Required verification pending") {
      if (failureReasons.length > 0) {
        decisionStatus = "Not Eligible";
        decisionReason = `Not eligible: ${failureReasons.join(" ")}`;
      } else {
        decisionStatus = "Eligible";
        decisionReason = passReasons.length
          ? `Eligible: ${passReasons.join(" ")}`
          : "Eligible: required scheme documents verified.";
      }
    }
  }

  const riskScore = integrityRisks.reduce(
    (current, next) => maxRiskScore(current, next),
    maxRiskScore(requester.riskScore || "Low", identityMismatchReason ? "Medium" : "Low")
  );

  const allDocumentsPayload = {
    aadhaarDocumentId: documentsByType.aadhaar_card?._id || null,
    panDocumentId: documentsByType.pan_card?._id || null,
    incomeDocumentId: documentsByType.income_certificate?._id || null,
    birthCertificateDocumentId: documentsByType.birth_certificate?._id || null,
    rationCardDocumentId: documentsByType.ration_card?._id || null,
    drivingLicenceDocumentId: documentsByType.driving_licence?._id || null,
  };

  const application = await Application.create({
    citizenId: requester.sub,
    schemeName: schemeRule.schemeName,
    applicantName: String(payload.applicantName).trim(),
    applicantAge,
    residentialAddress: String(payload.residentialAddress).trim(),
    documents: allDocumentsPayload,
    decisionStatus,
    documentsStatus,
    incomeCheckStatus,
    decisionReason,
    riskScore,
  });

  return toPublicApplication(application);
}

async function listMyApplications({ requester }) {
  const records = await Application.find({ citizenId: requester.sub })
    .sort({ createdAt: -1 })
    .limit(12);

  return records.map(toPublicApplication);
}

async function getMyApplicationSummary({ requester }) {
  const records = await Application.find({ citizenId: requester.sub }).sort({ createdAt: -1 }).limit(12);

  const summary = {
    applications: records.length,
    eligible: records.filter((item) => item.decisionStatus === "Eligible").length,
    notEligible: records.filter((item) => item.decisionStatus === "Not Eligible").length,
    pending: records.filter((item) => item.decisionStatus === "Needs Review").length,
    tamperAlerts: await Alert.countDocuments({
      type: "tampering_detected",
      actorId: requester.sub,
      status: "open",
    }),
    latestScheme: records[0]?.schemeName || "None",
    latestStatus: records[0]?.decisionStatus || "None",
    lastSubmitted: records[0]?.createdAt || null,
  };

  return summary;
}

async function listApplicationsForAdmin({ status, limit = 50 }) {
  const resolvedStatus = parseStatusFilter(status);
  const parsedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

  const query = {};
  if (resolvedStatus !== "all") {
    query.decisionStatus = resolvedStatus;
  }

  const records = await Application.find(query)
    .populate("citizenId", "email")
    .populate("reviewedBy", "email")
    .sort({ createdAt: -1 })
    .limit(parsedLimit);

  return records.map(toAdminApplication);
}

async function reviewApplicationByAdmin({ applicationId, action, reason, reviewer }) {
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    const error = new Error("Invalid application id");
    error.statusCode = 400;
    error.reason = "invalid_application_id";
    throw error;
  }

  const reviewAction = parseReviewAction(action);
  const reviewReason = String(reason || "").trim();

  if (reviewAction === "denied" && !reviewReason) {
    const error = new Error("Denial reason is required");
    error.statusCode = 400;
    error.reason = "deny_reason_required";
    throw error;
  }

  const application = await Application.findById(applicationId)
    .populate("citizenId", "email")
    .populate("reviewedBy", "email");

  if (!application) {
    const error = new Error("Application not found");
    error.statusCode = 404;
    error.reason = "application_not_found";
    throw error;
  }

  if (reviewAction === "accepted") {
    application.decisionStatus = "Eligible";
    application.decisionReason = reviewReason || "Approved by admin after manual review.";
    application.reviewReason = reviewReason || "Approved by admin after manual review.";
  } else {
    application.decisionStatus = "Not Eligible";
    application.decisionReason = `Denied by admin: ${reviewReason}`;
    application.reviewReason = reviewReason;
  }

  application.reviewAction = reviewAction;
  application.reviewedBy = reviewer.sub;
  application.reviewedAt = new Date();

  await application.save();

  const refreshed = await Application.findById(application._id)
    .populate("citizenId", "email")
    .populate("reviewedBy", "email");

  return toAdminApplication(refreshed);
}

function getLoanRequirements() {
  return {
    requiredFields: ["applicantName", "residentialAddress", "schemeName"],
    schemeThresholds: Object.entries(SCHEME_RULES).map(([schemeName, rule]) => ({
      schemeName,
      incomeThreshold: rule.incomeThreshold,
      requiresIncomeCheck: rule.requiresIncomeCheck,
      requiresAgeCheck: rule.requiresAgeCheck,
      minAge: rule.minAge,
      requiredDocuments: rule.requiredDocumentTypes.map((documentType) => ({
        type: documentType,
        label: DOC_TYPE_LABELS[documentType] || documentType,
        payloadField: DOC_TYPE_TO_PAYLOAD_FIELD[documentType],
      })),
    })),
  };
}

module.exports = {
  createLoanApplication,
  listMyApplications,
  getMyApplicationSummary,
  listApplicationsForAdmin,
  reviewApplicationByAdmin,
  getLoanRequirements,
};




