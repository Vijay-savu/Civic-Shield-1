const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const Document = require("./document.model");
const { createAlert } = require("../alerts/alerts.service");
const { monitor } = require("../../utils/monitor.util");

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

async function simulateOcrIncomeExtraction(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const canReadAsText =
    file.mimetype.startsWith("text/") ||
    [".txt", ".csv", ".json", ".md"].includes(extension);

  if (canReadAsText) {
    try {
      const textContent = await fs.readFile(file.path, "utf8");
      const incomeFromText = extractIncomeFromText(textContent);
      if (incomeFromText !== null) {
        return {
          extractedIncome: incomeFromText,
          ocrStatus: "extracted",
        };
      }
    } catch (_error) {
      return {
        extractedIncome: null,
        ocrStatus: "failed",
      };
    }
  }

  const incomeFromFileName = extractIncomeFromFileName(file.originalname);
  if (incomeFromFileName !== null) {
    return {
      extractedIncome: incomeFromFileName,
      ocrStatus: "extracted",
    };
  }

  return {
    extractedIncome: null,
    ocrStatus: "not_found",
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

async function uploadDocumentForUser({ file, userId }) {
  if (!file) {
    const error = new Error("Document file is required");
    error.statusCode = 400;
    error.reason = "missing_document_file";
    throw error;
  }

  const sha256Hash = await computeFileSha256(file.path);
  const { extractedIncome, ocrStatus } = await simulateOcrIncomeExtraction(file);

  const saved = await Document.create({
    userId,
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    filePath: file.path,
    sha256Hash,
    extractedIncome,
    ocrStatus,
  });

  return {
    id: saved._id.toString(),
    status: "uploaded",
    reason: saved.ocrStatus === "extracted" ? "ocr_processed" : "ocr_income_not_found",
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
