const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const Document = require("./document.model");

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

async function uploadDocumentForUser({ file, userId }) {
  if (!file) {
    const error = new Error("Document file is required");
    error.statusCode = 400;
    throw error;
  }

  const fileBuffer = await fs.readFile(file.path);
  const sha256Hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

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
    originalName: saved.originalName,
    storedFileName: saved.fileName,
    size: saved.size,
    mimeType: saved.mimeType,
    ocr: {
      extractedIncome: saved.extractedIncome,
      status: saved.ocrStatus,
      mode: "simulated",
    },
    uploadedAt: saved.createdAt,
  };
}

module.exports = {
  uploadDocumentForUser,
};
