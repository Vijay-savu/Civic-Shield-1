const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");

const Document = require("./document.model");
const { createAlert } = require("../alerts/alerts.service");
const { monitor } = require("../../utils/monitor.util");
const {
  incomeFallbackAmount,
  forceIncomeAmount,
  enforceDetectedTypeMatch,
} = require("../../config/env");

const SUPPORTED_DOCUMENT_TYPES = new Set([
  "pan_card",
  "aadhaar_card",
  "driving_licence",
  "ration_card",
  "voter_id",
  "passport",
  "birth_certificate",
  "income_certificate",
]);

const DOCUMENT_TYPE_LABELS = {
  pan_card: "PAN",
  aadhaar_card: "Aadhaar",
  driving_licence: "Driving License",
  ration_card: "Ration Card",
  voter_id: "Voter ID",
  passport: "Passport",
  birth_certificate: "Birth Certificate",
  income_certificate: "Income Certificate",
};

const BACKEND_ROOT = path.resolve(__dirname, "../../../");
const LOCAL_ENG_TRAINEDDATA = path.join(BACKEND_ROOT, "eng.traineddata");
let hasLocalEngTrainedData = null;

async function resolveTesseractOptions() {
  if (hasLocalEngTrainedData === null) {
    try {
      await fs.access(LOCAL_ENG_TRAINEDDATA);
      hasLocalEngTrainedData = true;
    } catch (_error) {
      hasLocalEngTrainedData = false;
    }
  }

  if (hasLocalEngTrainedData) {
    return {
      langPath: BACKEND_ROOT,
      gzip: false,
      logger: () => {},
    };
  }

  return {
    logger: () => {},
  };
}

function toDocumentTypeLabel(documentType) {
  return DOCUMENT_TYPE_LABELS[documentType] || documentType;
}

function normalizeDocumentType(documentType) {
  const normalized = String(documentType || "")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");

  const aliases = {
    pan: "pan_card",
    pan_card: "pan_card",
    aadhaar: "aadhaar_card",
    aadhar: "aadhaar_card",
    aadhaar_card: "aadhaar_card",
    aadhar_card: "aadhaar_card",
    driving: "driving_licence",
    driving_licence: "driving_licence",
    driving_license: "driving_licence",
    ration: "ration_card",
    ration_card: "ration_card",
    voter: "voter_id",
    voter_id: "voter_id",
    voterid: "voter_id",
    passport: "passport",
    birth: "birth_certificate",
    birth_certificate: "birth_certificate",
    income: "income_certificate",
    income_certificate: "income_certificate",
  };

  const canonical = aliases[normalized] || normalized;
  if (!SUPPORTED_DOCUMENT_TYPES.has(canonical)) {
    const error = new Error("Unsupported document type");
    error.statusCode = 400;
    error.reason = "invalid_document_type";
    throw error;
  }

  return canonical;
}

function normalizeUpperText(text) {
  return String(text || "").toUpperCase();
}

function compactAlphaNumeric(text) {
  return normalizeUpperText(text).replace(/[^A-Z0-9]/g, "");
}

function compactDigits(text) {
  return String(text || "").replace(/\D/g, "");
}

function tokenizeAlphaNumeric(text) {
  return normalizeUpperText(text)
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function findRegexCandidate(rawText, regex) {
  const tokens = tokenizeAlphaNumeric(rawText);
  for (const token of tokens) {
    if (regex.test(token)) {
      return token;
    }
  }
  return null;
}

function findAadhaarCandidate(rawText) {
  const groupedMatch = String(rawText || "").match(/\b(\d{4}\s*\d{4}\s*\d{4})\b/);
  if (groupedMatch?.[1]) {
    const digits = compactDigits(groupedMatch[1]);
    if (/^\d{12}$/.test(digits)) {
      return digits;
    }
  }

  const directMatch = String(rawText || "").match(/\b(\d{12})\b/);
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  return null;
}

function normalizePanFromOcr(candidate) {
  const source = String(candidate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (source.length !== 10) {
    return null;
  }

  const digitToLetter = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "5": "S",
    "6": "G",
    "8": "B",
  };

  const letterToDigit = {
    O: "0",
    Q: "0",
    D: "0",
    I: "1",
    L: "1",
    Z: "2",
    S: "5",
    B: "8",
    G: "6",
  };

  const chars = source.split("");

  for (let index = 0; index < chars.length; index += 1) {
    const value = chars[index];
    const expectsLetter = index <= 4 || index === 9;

    if (expectsLetter && digitToLetter[value]) {
      chars[index] = digitToLetter[value];
    } else if (!expectsLetter && letterToDigit[value]) {
      chars[index] = letterToDigit[value];
    }
  }

  const normalized = chars.join("");
  if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

function findPanCandidateFlexible(rawText) {
  const strict = findRegexCandidate(rawText, /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/);
  if (strict) {
    return strict;
  }

  const tokens = tokenizeAlphaNumeric(rawText);
  for (const token of tokens) {
    if (token.length !== 10) {
      continue;
    }

    const normalized = normalizePanFromOcr(token);
    if (normalized) {
      return normalized;
    }
  }

  const compact = compactAlphaNumeric(rawText);
  for (let index = 0; index <= compact.length - 10; index += 1) {
    const window = compact.slice(index, index + 10);
    const normalized = normalizePanFromOcr(window);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function extractIncomeValue(text) {
  const source = String(text || "");
  const upper = normalizeUpperText(source);

  const rsMatch = upper.match(/\bRS\.?\s*([0-9][0-9,]{2,})/);
  if (rsMatch?.[1]) {
    const value = Number(rsMatch[1].replace(/,/g, ""));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  const incomeLineMatch = upper.match(/INCOME[^0-9]{0,20}([0-9][0-9,]{2,})/);
  if (incomeLineMatch?.[1]) {
    const value = Number(incomeLineMatch[1].replace(/,/g, ""));
    if (Number.isFinite(value)) {
      return value;
    }
  }

  const allNumbers = Array.from(upper.matchAll(/([0-9][0-9,]{2,})/g))
    .map((entry) => Number(entry[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 1000 && value <= 5000000);

  return allNumbers[0] || null;
}

const NAME_STOPWORDS = new Set([
  "NAME",
  "FATHER",
  "MOTHER",
  "DATE",
  "BIRTH",
  "GOVERNMENT",
  "GOVT",
  "OF",
  "INDIA",
  "INCOME",
  "TAX",
  "DEPARTMENT",
  "PERMANENT",
  "ACCOUNT",
  "NUMBER",
  "CARD",
  "CERTIFICATE",
  "UIDAI",
  "AADHAAR",
  "AADHAR",
  "REVENUE",
  "DEPUTY",
  "TAHSILDAR",
  "DIGITALLY",
  "SIGNED",
  "APPLICATION",
  "NO",
  "DOB",
  "MALE",
  "FEMALE",
  "ADDRESS",
  "STATE",
  "DISTRICT",
  "MANDAL",
]);

function extractIdentityTokens(rawText) {
  const upper = normalizeUpperText(rawText);
  const lines = upper
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidateLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/\bNAME\b/.test(line)) {
      candidateLines.push(line);
      if (lines[i + 1]) {
        candidateLines.push(lines[i + 1]);
      }
    }
  }

  const sourceText = (candidateLines.length > 0 ? candidateLines.join(" ") : upper)
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const rawTokens = sourceText.split(" ").filter(Boolean);
  const tokens = Array.from(
    new Set(
      rawTokens.filter((token) => token.length >= 3 && !NAME_STOPWORDS.has(token))
    )
  );

  return tokens.slice(0, 8);
}

function validatePan(rawText) {
  const candidate = findPanCandidateFlexible(rawText);
  if (candidate) {
    return {
      valid: true,
      reason: "Valid PAN format detected",
      extractedFields: {
        pan: candidate,
      },
    };
  }

  const upper = normalizeUpperText(rawText);
  if (
    upper.includes("INCOME TAX") ||
    upper.includes("PERMANENT ACCOUNT") ||
    upper.includes("GOVERNMENT OF INDIA")
  ) {
    return {
      valid: true,
      reason: "PAN card keywords detected",
      extractedFields: {
        pan: null,
        verificationMode: "keyword_based",
      },
    };
  }

  return {
    valid: false,
    reason: "PAN format invalid",
    extractedFields: {},
  };
}

function validateAadhaar(rawText) {
  const candidate = findAadhaarCandidate(rawText);
  if (candidate) {
    return {
      valid: true,
      reason: "Valid Aadhaar format detected",
      extractedFields: {
        aadhaar: candidate,
      },
    };
  }

  return {
    valid: false,
    reason: "Aadhaar must contain 12 digits",
    extractedFields: {},
  };
}

function validateDrivingLicence(rawText) {
  const tokens = tokenizeAlphaNumeric(rawText);
  const candidate = tokens.find(
    (token) =>
      /^[A-Z0-9]{10,16}$/.test(token) &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(token) &&
      !/^[A-Z]{3}[0-9]{7}$/.test(token) &&
      !/^[A-Z][0-9]{7}$/.test(token) &&
      !/^\d{12}$/.test(token)
  );

  if (candidate) {
    return {
      valid: true,
      reason: "Valid Driving License format detected",
      extractedFields: {
        drivingLicence: candidate,
      },
    };
  }

  return {
    valid: false,
    reason: "Driving License format invalid (expected format similar to AP1220110012345)",
    extractedFields: {},
  };
}

function validateRationCard(rawText) {
  const tokens = tokenizeAlphaNumeric(rawText);
  const candidate = tokens.find(
    (token) =>
      /^[A-Z0-9]{8,}$/.test(token) &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(token) &&
      !/^[A-Z]{3}[0-9]{7}$/.test(token) &&
      !/^[A-Z][0-9]{7}$/.test(token) &&
      !/^\d{12}$/.test(token)
  );

  if (candidate) {
    return {
      valid: true,
      reason: "Valid Ration Card format detected",
      extractedFields: {
        rationCard: candidate,
      },
    };
  }

  return {
    valid: false,
    reason: "Ration Card must be alphanumeric and length >= 8",
    extractedFields: {},
  };
}

function validateVoterId(rawText) {
  const candidate = findRegexCandidate(rawText, /^[A-Z]{3}[0-9]{7}$/);
  if (candidate) {
    return {
      valid: true,
      reason: "Valid Voter ID format detected",
      extractedFields: {
        voterId: candidate,
      },
    };
  }

  return {
    valid: false,
    reason: "Voter ID format invalid",
    extractedFields: {},
  };
}

function validatePassport(rawText) {
  const candidate = findRegexCandidate(rawText, /^[A-Z][0-9]{7}$/);
  if (candidate) {
    return {
      valid: true,
      reason: "Valid Passport format detected",
      extractedFields: {
        passport: candidate,
      },
    };
  }

  return {
    valid: false,
    reason: "Passport format invalid",
    extractedFields: {},
  };
}

function validateBirthCertificate(rawText) {
  const upper = normalizeUpperText(rawText);
  const hasBirth = upper.includes("BIRTH");
  const hasName = upper.includes("NAME");
  const hasDate = upper.includes("DATE");

  if (hasBirth && hasName && hasDate) {
    return {
      valid: true,
      reason: "Birth certificate keywords detected",
      extractedFields: {},
    };
  }

  return {
    valid: false,
    reason: "Birth certificate must contain Birth, Name and Date",
    extractedFields: {},
  };
}

function validateIncomeCertificate(rawText) {
  const upper = normalizeUpperText(rawText);
  const hasIncome = upper.includes("INCOME");
  const forcedIncome = Number(forceIncomeAmount || 0);

  if (Number.isFinite(forcedIncome) && forcedIncome > 0) {
    return {
      valid: true,
      reason: "Income amount set by configuration",
      extractedIncome: forcedIncome,
      extractedFields: {
        income: forcedIncome,
        verificationMode: "forced_income",
      },
    };
  }

  if (!hasIncome) {
    return {
      valid: false,
      reason: "Income keyword not found",
      extractedIncome: null,
      extractedFields: {},
    };
  }

  const income = extractIncomeValue(rawText);
  if (typeof income !== "number") {
    const fallbackIncome = Number(incomeFallbackAmount || 300000);
    if (Number.isFinite(fallbackIncome) && fallbackIncome > 0) {
      return {
        valid: true,
        reason: "Income amount unclear, fallback income applied",
        extractedIncome: fallbackIncome,
        extractedFields: {
          income: fallbackIncome,
          verificationMode: "fallback_income",
        },
      };
    }

    return {
      valid: false,
      reason: "Income amount not found",
      extractedIncome: null,
      extractedFields: {},
    };
  }

  return {
    valid: true,
    reason: "Income certificate validated",
    extractedIncome: income,
    extractedFields: {
      income,
    },
  };
}

function detectDocumentTypeFromText(rawText) {
  const upper = normalizeUpperText(rawText);
  const compact = compactAlphaNumeric(rawText);

  if (findRegexCandidate(rawText, /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) {
    return "pan_card";
  }

  if (findAadhaarCandidate(rawText)) {
    return "aadhaar_card";
  }

  if (findRegexCandidate(rawText, /^[A-Z]{3}[0-9]{7}$/)) {
    return "voter_id";
  }

  if (findRegexCandidate(rawText, /^[A-Z][0-9]{7}$/)) {
    return "passport";
  }

  const hasDrivingKeyword =
    upper.includes("DRIVING") ||
    upper.includes("LICENCE") ||
    upper.includes("LICENSE") ||
    /\bDL\b/.test(upper);
  if (hasDrivingKeyword && findRegexCandidate(rawText, /^[A-Z0-9]{10,16}$/) && !/[A-Z]{5}[0-9]{4}[A-Z]/.test(compact)) {
    return "driving_licence";
  }

  if (upper.includes("RATION")) {
    return "ration_card";
  }

  if (upper.includes("BIRTH")) {
    return "birth_certificate";
  }

  if (upper.includes("INCOME")) {
    return "income_certificate";
  }

  return null;
}

function validateDocumentText({ selectedDocumentType, ocrText, ocrReadFailed = false }) {
  const rawText = String(ocrText || "");
  const upperText = normalizeUpperText(rawText);
  const detectedType = detectDocumentTypeFromText(rawText);
  const typeToValidate = selectedDocumentType || detectedType;

  if (!rawText.trim() && selectedDocumentType) {
    const forcedIncome = Number(forceIncomeAmount || 0);
    const fallbackIncome =
      selectedDocumentType === "income_certificate" &&
      Number.isFinite(forcedIncome) &&
      forcedIncome > 0
        ? forcedIncome
        : selectedDocumentType === "income_certificate" && Number.isFinite(Number(incomeFallbackAmount))
          ? Number(incomeFallbackAmount)
        : null;

    return {
      documentType: toDocumentTypeLabel(selectedDocumentType),
      documentTypeKey: selectedDocumentType,
      valid: true,
      reason: ocrReadFailed
        ? "File uploaded with basic checks. OCR text extraction unavailable."
        : "File uploaded with basic checks. OCR text not detected.",
      extractedIncome: fallbackIncome,
      extractedFields: {
        verificationMode: "basic_upload",
        ...(fallbackIncome ? { income: fallbackIncome } : {}),
      },
      ocrStatus: ocrReadFailed ? "failed" : "not_found",
      detectedDocumentTypeKey: null,
      detectedDocumentType: null,
    };
  }

  if (!typeToValidate) {
    return {
      documentType: "Unknown",
      documentTypeKey: null,
      valid: false,
      reason: "Unable to detect document type",
      extractedIncome: null,
      extractedFields: {},
      ocrStatus: rawText.trim() ? "extracted" : "not_found",
    };
  }

  let result;
  if (typeToValidate === "pan_card") {
    result = validatePan(rawText);
  } else if (typeToValidate === "aadhaar_card") {
    result = validateAadhaar(rawText);
  } else if (typeToValidate === "driving_licence") {
    result = validateDrivingLicence(rawText);
  } else if (typeToValidate === "ration_card") {
    result = validateRationCard(rawText);
  } else if (typeToValidate === "voter_id") {
    result = validateVoterId(rawText);
  } else if (typeToValidate === "passport") {
    result = validatePassport(rawText);
  } else if (typeToValidate === "birth_certificate") {
    result = validateBirthCertificate(rawText);
  } else if (typeToValidate === "income_certificate") {
    result = validateIncomeCertificate(rawText);
  } else {
    result = {
      valid: false,
      reason: "Unsupported document type",
      extractedIncome: null,
      extractedFields: {},
    };
  }

  if (!result.valid && selectedDocumentType && hasKeywordFallbackForType(selectedDocumentType, upperText)) {
    const forcedIncome = Number(forceIncomeAmount || 0);
    const fallbackIncome =
      selectedDocumentType === "income_certificate" &&
      Number.isFinite(forcedIncome) &&
      forcedIncome > 0
        ? forcedIncome
        : selectedDocumentType === "income_certificate" && Number.isFinite(Number(incomeFallbackAmount))
          ? Number(incomeFallbackAmount)
        : null;

    result = {
      valid: true,
      reason: "Document keywords detected",
      extractedIncome:
        typeof result.extractedIncome === "number" ? result.extractedIncome : fallbackIncome,
      extractedFields: {
        ...(result.extractedFields || {}),
        verificationMode: "keyword_based",
        ...(fallbackIncome ? { income: fallbackIncome } : {}),
      },
    };
  }

  const identityTokens = extractIdentityTokens(rawText);
  const extractedFields = {
    ...(result.extractedFields || {}),
    identityTokens,
  };

  return {
    documentType: toDocumentTypeLabel(typeToValidate),
    documentTypeKey: typeToValidate,
    valid: Boolean(result.valid),
    reason: result.reason,
    extractedIncome: typeof result.extractedIncome === "number" ? result.extractedIncome : null,
    extractedFields,
    detectedDocumentTypeKey: detectedType || null,
    detectedDocumentType: detectedType ? toDocumentTypeLabel(detectedType) : null,
    ocrStatus: rawText.trim() ? "extracted" : "not_found",
  };
}

function hasKeywordFallbackForType(documentType, upperText) {
  const checks = {
    pan_card:
      upperText.includes("INCOME TAX") ||
      upperText.includes("PERMANENT ACCOUNT") ||
      upperText.includes("GOVERNMENT OF INDIA"),
    aadhaar_card:
      upperText.includes("AADHAAR") ||
      upperText.includes("AADHAR") ||
      upperText.includes("UIDAI"),
    driving_licence:
      upperText.includes("DRIVING") &&
      (upperText.includes("LICENCE") || upperText.includes("LICENSE")),
    ration_card: upperText.includes("RATION"),
    voter_id: upperText.includes("VOTER") || upperText.includes("ELECTION"),
    passport: upperText.includes("PASSPORT"),
    birth_certificate: upperText.includes("BIRTH"),
    income_certificate: upperText.includes("INCOME"),
  };

  return Boolean(checks[documentType]);
}

async function buildOcrInput({ file, ocrHint }) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const chunks = [];
  let readFailed = false;

  const canReadAsText =
    String(file.mimetype || "").startsWith("text/") ||
    [".txt", ".csv", ".json", ".md"].includes(extension);

  if (canReadAsText) {
    try {
      const content = await fs.readFile(file.path, "utf8");
      chunks.push(content);
    } catch (_error) {
      readFailed = true;
    }
  }

  const isPdf = file.mimetype === "application/pdf" || extension === ".pdf";
  if (isPdf) {
    try {
      const pdfBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(pdfBuffer);
      if (pdfData?.text) {
        chunks.push(pdfData.text);
      }
    } catch (_error) {
      readFailed = true;
    }
  }

  const isImage = String(file.mimetype || "").startsWith("image/");
  if (isImage) {
    try {
      const tesseractOptions = await resolveTesseractOptions();
      const ocrResult = await Tesseract.recognize(file.path, "eng", tesseractOptions);
      const imageText = ocrResult?.data?.text || "";
      if (imageText.trim()) {
        chunks.push(imageText);
      }
    } catch (_error) {
      readFailed = true;
    }
  }

  if (ocrHint) {
    chunks.push(String(ocrHint));
  }

  // Filename hint helps document-type detection when OCR quality is low.
  if (file?.originalname) {
    chunks.push(String(file.originalname));
  }

  return {
    text: chunks.join("\n"),
    readFailed,
  };
}

function canAccessDocument(requester, documentOwnerId) {
  if (!requester) {
    return false;
  }

  if (String(requester.role).toLowerCase() === "admin") {
    return true;
  }

  return String(requester.sub) === String(documentOwnerId);
}

async function computeFileSha256(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

async function getDocumentForRequester({ documentId, requester }) {
  const document = await Document.findById(documentId);
  if (!document) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    error.reason = "document_not_found";
    throw error;
  }

  if (!canAccessDocument(requester, document.userId)) {
    const error = new Error("Forbidden: You cannot access this document");
    error.statusCode = 403;
    error.reason = "document_access_denied";
    throw error;
  }

  return document;
}

function toDocumentSummary(document) {
  return {
    id: document._id.toString(),
    documentType: document.documentType,
    documentTypeLabel: toDocumentTypeLabel(document.documentType),
    valid: document.validationStatus === "valid",
    reason: document.validationReason,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    validationStatus: document.validationStatus,
    validationReason: document.validationReason,
    ocrStatus: document.ocrStatus,
    sha256Hash: document.sha256Hash,
    createdAt: document.createdAt,
  };
}

async function listMyDocumentsForUser({ requester }) {
  const documents = await Document.find({
    userId: requester.sub,
    validationStatus: "valid",
  }).sort({ createdAt: -1 });

  const latestByType = new Map();
  for (const document of documents) {
    if (!latestByType.has(document.documentType)) {
      latestByType.set(document.documentType, document);
    }
  }

  return Array.from(latestByType.values()).map(toDocumentSummary);
}

async function removeDocumentFileIfPresent(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function deleteDocumentForRequester({ documentId, requester }) {
  const document = await getDocumentForRequester({ documentId, requester });
  await removeDocumentFileIfPresent(document.filePath);
  await Document.deleteOne({ _id: document._id });

  return {
    id: document._id.toString(),
    documentType: document.documentType,
    status: "deleted",
    reason: "document_removed",
  };
}

async function createTamperAlert({ requester, documentId, ipAddress, source }) {
  try {
    await createAlert({
      type: "tampering_detected",
      riskScore: "High",
      message: "Document tampering detected by hash mismatch",
      actorId: requester?.sub,
      actorEmail: requester?.email,
      actorRole: requester?.role,
      source,
      targetType: "document",
      targetId: documentId,
      ipAddress,
      metadata: {
        status: "compromised",
      },
    });

    monitor("tampering", {
      documentId,
      status: "compromised",
      actorEmail: requester?.email,
      ipAddress,
      source,
    });
  } catch (error) {
    console.error("Tamper alert creation failed:", error.message);
  }
}

async function verifyDocumentIntegrity({ document, requester, ipAddress, source }) {
  try {
    const currentHash = await computeFileSha256(document.filePath);
    const isValid = currentHash === document.sha256Hash;

    if (!isValid) {
      await createTamperAlert({
        requester,
        documentId: document._id.toString(),
        ipAddress,
        source,
      });
    }

    return {
      integrityStatus: isValid ? "safe" : "compromised",
      hashMatches: isValid,
      riskScore: isValid ? "Low" : "High",
      reason: isValid ? "hash_verified" : "hash_mismatch_detected",
    };
  } catch (_error) {
    await createTamperAlert({
      requester,
      documentId: document._id.toString(),
      ipAddress,
      source,
    });

    return {
      integrityStatus: "compromised",
      hashMatches: false,
      riskScore: "High",
      reason: "file_unreadable_or_missing",
    };
  }
}

async function uploadDocumentForUser({ file, userId, documentType, ocrHint }) {
  if (!file) {
    const error = new Error("Document file is required");
    error.statusCode = 400;
    error.reason = "missing_document_file";
    throw error;
  }

  const normalizedType = normalizeDocumentType(documentType);
  const existingDocument = await Document.findOne({
    userId,
    documentType: normalizedType,
    validationStatus: "valid",
  });

  if (existingDocument) {
    const error = new Error("Only one document is allowed per type. This type is already uploaded.");
    error.statusCode = 409;
    error.reason = "document_type_already_uploaded";
    throw error;
  }

  const sha256Hash = await computeFileSha256(file.path);
  const ocrInput = await buildOcrInput({ file, ocrHint });
  const validation = validateDocumentText({
    selectedDocumentType: normalizedType,
    ocrText: ocrInput.text,
    ocrReadFailed: ocrInput.readFailed,
  });

  if (
    enforceDetectedTypeMatch &&
    validation.detectedDocumentTypeKey &&
    validation.detectedDocumentTypeKey !== normalizedType
  ) {
    await removeDocumentFileIfPresent(file.path);
    const error = new Error(
      `Document type mismatch: selected ${toDocumentTypeLabel(normalizedType)} but detected ${validation.detectedDocumentType}`
    );
    error.statusCode = 422;
    error.reason = "document_type_mismatch";
    throw error;
  }

  if (!validation.valid) {
    await removeDocumentFileIfPresent(file.path);
    const error = new Error(validation.reason);
    error.statusCode = 422;
    error.reason = "invalid_document";
    throw error;
  }

  const saved = await Document.create({
    userId,
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    filePath: file.path,
    sha256Hash,
    documentType: normalizedType,
    extractedIncome: validation.extractedIncome,
    extractedFields: validation.extractedFields,
    ocrStatus: validation.ocrStatus,
    validationStatus: "valid",
    validationReason: validation.reason,
  });

  // Bonus log requested by user.
  monitor("ocr", {
    actorId: userId,
    status: "processed",
    documentType: validation.documentType,
    valid: validation.valid,
    reason: validation.reason,
  });

  return {
    id: saved._id.toString(),
    status: "uploaded",
    documentType: validation.documentType,
    documentTypeKey: saved.documentType,
    valid: true,
    reason: validation.reason,
    ocrStatus: saved.ocrStatus,
    sha256Hash: saved.sha256Hash,
    validationStatus: saved.validationStatus,
    validationReason: saved.validationReason,
    extractedFields: saved.extractedFields,
  };
}

async function getDocumentIntegrityStatusForUser({ documentId, requester, ipAddress, source }) {
  const document = await getDocumentForRequester({ documentId, requester });
  const integrity = await verifyDocumentIntegrity({
    document,
    requester,
    ipAddress,
    source,
  });

  return {
    status: integrity.integrityStatus,
    reason: integrity.reason,
    riskScore: integrity.riskScore,
  };
}

async function simulateTamperingById({ documentId }) {
  const document = await Document.findById(documentId);
  if (!document) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    error.reason = "document_not_found";
    throw error;
  }

  document.sha256Hash = crypto.randomBytes(32).toString("hex");
  await document.save();

  return {
    documentId: document._id.toString(),
    status: "tamper_simulated",
    reason: "hash_overwritten_for_demo",
  };
}

module.exports = {
  uploadDocumentForUser,
  listMyDocumentsForUser,
  deleteDocumentForRequester,
  getDocumentForRequester,
  verifyDocumentIntegrity,
  getDocumentIntegrityStatusForUser,
  simulateTamperingById,
};
