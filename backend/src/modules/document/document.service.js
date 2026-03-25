const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const Document = require("./document.model");
const { createAlert } = require("../alerts/alerts.service");
const { monitor } = require("../../utils/monitor.util");

const SUPPORTED_DOCUMENT_TYPES = new Set([
  "aadhaar_card",
  "pan_card",
  "birth_certificate",
  "driving_licence",
  "income_certificate",
]);

function normalizeDocumentType(documentType) {
  const normalized = String(documentType || "")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");

  const aliases = {
    aadhaar: "aadhaar_card",
    aadhar: "aadhaar_card",
    aadhaar_card: "aadhaar_card",
    pan: "pan_card",
    pan_card: "pan_card",
    birth: "birth_certificate",
    birth_certificate: "birth_certificate",
    driving: "driving_licence",
    driving_licence: "driving_licence",
    driving_license: "driving_licence",
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

function parseNumericValue(raw) {
  const normalized = String(raw).replace(/,/g, "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractIncomeFromText(text) {
  const patterns = [
    /(?:annual\s+)?income\s*[:=-]?\s*(?:Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /salary\s*[:=-]?\s*(?:Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = parseNumericValue(match[1]);
      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

function extractIncomeFromFileName(fileName) {
  const match = fileName.match(/income[_-]?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  if (!match || !match[1]) {
    return null;
  }

  return parseNumericValue(match[1]);
}

function maskMiddle(value, start, end) {
  const raw = String(value || "");
  if (raw.length <= start + end) {
    return raw;
  }

  const left = raw.slice(0, start);
  const right = raw.slice(raw.length - end);
  const middle = "*".repeat(raw.length - start - end);
  return `${left}${middle}${right}`;
}

function getIncomeBand(income) {
  if (income < 250000) {
    return "below_2_5_lakh";
  }
  if (income < 500000) {
    return "between_2_5_and_5_lakh";
  }
  return "above_5_lakh";
}

function extractAadhaarNumber(text) {
  const candidates = text.match(/(?:\d[ -]?){8,16}\d/g) || [];

  for (const candidate of candidates) {
    const digitsOnly = candidate.replace(/\D/g, "");
    if (digitsOnly.length === 12) {
      return {
        value: digitsOnly,
        reason: "aadhaar_verified",
      };
    }
  }

  if (candidates.length > 0) {
    return {
      value: null,
      reason: "aadhaar_number_must_be_12_digits",
    };
  }

  return {
    value: null,
    reason: "aadhaar_number_not_found",
  };
}

function extractPanNumber(text) {
  const match = text.toUpperCase().match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
  if (!match) {
    return null;
  }

  return match[0];
}

function extractDrivingLicenceNumber(text) {
  const patterns = [
    /\b[A-Z]{2}[ -]?\d{2}[ -]?\d{4}[ -]?\d{7}\b/i,
    /\b[A-Z]{2}[ -]?\d{13}\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      return match[0].replace(/\s+/g, "");
    }
  }

  return null;
}

function extractDateOfBirth(text) {
  const ddmmyyyy = text.match(/\b(0?[1-9]|[12][0-9]|3[01])[\/.-](0?[1-9]|1[0-2])[\/.-]((?:19|20)\d{2})\b/);
  if (ddmmyyyy) {
    const day = String(ddmmyyyy[1]).padStart(2, "0");
    const month = String(ddmmyyyy[2]).padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  const yyyymmdd = text.match(/\b((?:19|20)\d{2})[\/.-](0?[1-9]|1[0-2])[\/.-](0?[1-9]|[12][0-9]|3[01])\b/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = String(yyyymmdd[2]).padStart(2, "0");
    const day = String(yyyymmdd[3]).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

async function buildOcrInput({ file, ocrHint }) {
  const extension = path.extname(file.originalname).toLowerCase();
  const chunks = [];
  let readFailed = false;

  const canReadAsText =
    file.mimetype.startsWith("text/") ||
    [".txt", ".csv", ".json", ".md"].includes(extension);

  if (canReadAsText) {
    try {
      const content = await fs.readFile(file.path, "utf8");
      chunks.push(content);
    } catch (_error) {
      readFailed = true;
    }
  }

  if (ocrHint) {
    chunks.push(String(ocrHint));
  }

  chunks.push(path.basename(file.originalname, extension).replace(/[_-]+/g, " "));

  return {
    text: chunks.join("\n"),
    readFailed,
  };
}

function validateDocumentFromOcr({ documentType, ocrText, readFailed, fileName }) {
  const normalizedText = String(ocrText || "").trim();
  const baseResult = {
    extractedIncome: null,
    extractedFields: {},
    validationStatus: "invalid",
    validationReason: "document_needs_review",
    ocrStatus: readFailed ? "failed" : "not_found",
  };

  if (!normalizedText) {
    return baseResult;
  }

  if (documentType === "aadhaar_card") {
    const aadhaarResult = extractAadhaarNumber(normalizedText);
    if (aadhaarResult.value) {
      return {
        ...baseResult,
        extractedFields: {
          aadhaarLast4: aadhaarResult.value.slice(-4),
          aadhaarMasked: maskMiddle(aadhaarResult.value, 4, 4),
        },
        validationStatus: "valid",
        validationReason: "aadhaar_verified",
        ocrStatus: "extracted",
      };
    }

    return {
      ...baseResult,
      validationReason: aadhaarResult.reason,
    };
  }

  if (documentType === "pan_card") {
    const pan = extractPanNumber(normalizedText);
    if (pan) {
      return {
        ...baseResult,
        extractedFields: {
          panMasked: maskMiddle(pan, 3, 2),
        },
        validationStatus: "valid",
        validationReason: "pan_verified",
        ocrStatus: "extracted",
      };
    }

    return {
      ...baseResult,
      validationReason: "pan_format_invalid",
    };
  }

  if (documentType === "driving_licence") {
    const licenceNumber = extractDrivingLicenceNumber(normalizedText);
    if (licenceNumber) {
      return {
        ...baseResult,
        extractedFields: {
          licenceMasked: maskMiddle(licenceNumber, 4, 3),
        },
        validationStatus: "valid",
        validationReason: "driving_licence_verified",
        ocrStatus: "extracted",
      };
    }

    return {
      ...baseResult,
      validationReason: "driving_licence_number_not_found",
    };
  }

  if (documentType === "birth_certificate") {
    const dob = extractDateOfBirth(normalizedText);
    const hasBirthKeyword = /birth|dob|date\s*of\s*birth/i.test(normalizedText);

    if (dob && hasBirthKeyword) {
      return {
        ...baseResult,
        extractedFields: {
          dateOfBirth: dob,
        },
        validationStatus: "valid",
        validationReason: "birth_certificate_verified",
        ocrStatus: "extracted",
      };
    }

    return {
      ...baseResult,
      validationReason: dob ? "birth_context_missing" : "dob_not_found",
    };
  }

  if (documentType === "income_certificate") {
    const income = extractIncomeFromText(normalizedText) ?? extractIncomeFromFileName(fileName);

    if (typeof income === "number" && income >= 0) {
      return {
        ...baseResult,
        extractedIncome: income,
        extractedFields: {
          incomeDetected: true,
          incomeBand: getIncomeBand(income),
        },
        validationStatus: "valid",
        validationReason: "income_extracted",
        ocrStatus: "extracted",
      };
    }

    return {
      ...baseResult,
      extractedFields: {
        incomeDetected: false,
      },
      validationReason: "income_value_not_found",
    };
  }

  return baseResult;
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
  const sha256Hash = await computeFileSha256(file.path);
  const ocrInput = await buildOcrInput({ file, ocrHint });
  const validation = validateDocumentFromOcr({
    documentType: normalizedType,
    ocrText: ocrInput.text,
    readFailed: ocrInput.readFailed,
    fileName: file.originalname,
  });

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
    validationStatus: validation.validationStatus,
    validationReason: validation.validationReason,
  });

  return {
    id: saved._id.toString(),
    status: "uploaded",
    reason: saved.validationStatus === "valid" ? "document_valid" : "invalid_document",
    documentType: saved.documentType,
    validationStatus: saved.validationStatus,
    validationReason: saved.validationReason,
    ocrStatus: saved.ocrStatus,
    extractedFields: saved.extractedFields,
    sha256Hash: saved.sha256Hash,
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
  getDocumentForRequester,
  verifyDocumentIntegrity,
  getDocumentIntegrityStatusForUser,
  simulateTamperingById,
};
