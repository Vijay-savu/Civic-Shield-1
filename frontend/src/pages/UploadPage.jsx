import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiUploadCloud } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, uploadDocument } from "../services/api";

const DOCUMENT_TYPES = [
  { value: "aadhaar_card", label: "Aadhaar Card" },
  { value: "pan_card", label: "PAN Card" },
  { value: "birth_certificate", label: "Birth Certificate" },
  { value: "driving_licence", label: "Driving Licence" },
  { value: "income_certificate", label: "Income Certificate" },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { setLastDocumentId } = useAuth();

  const [documentType, setDocumentType] = useState("aadhaar_card");
  const [ocrHint, setOcrHint] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await uploadDocument({ file, documentType, ocrHint });
      setResult(response.data);
      setLastDocumentId(response.data?.id || "");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <h1><FiUploadCloud /> Upload Document</h1>
      <p className="muted">Hashing + OCR validation run automatically right after upload.</p>

      <div className="card">
        <form onSubmit={submitUpload} className="form-grid">
          <label>
            Document Type
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} required>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Select Document
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          </label>

          <label>
            OCR Hint (Optional for image/PDF demo)
            <textarea
              rows={4}
              value={ocrHint}
              onChange={(e) => setOcrHint(e.target.value)}
              placeholder="Paste text for simulated OCR, e.g. Aadhaar: 1234 5678 9012"
            />
          </label>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Uploading..." : "Upload"}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}

        {result && (
          <div className="result-box">
            <p><strong>Document ID:</strong> {result.id}</p>
            <p><strong>Type:</strong> {result.documentType}</p>
            <p><strong>Status:</strong> {result.status}</p>
            <p><strong>Reason:</strong> {result.reason}</p>
            <p><strong>Validation:</strong> {result.validationStatus}</p>
            <p><strong>Validation Reason:</strong> {result.validationReason}</p>
            <p><strong>OCR Status:</strong> {result.ocrStatus}</p>
            <p><strong>SHA-256:</strong> {result.sha256Hash}</p>

            {result.extractedFields && Object.keys(result.extractedFields).length > 0 && (
              <div>
                <p><strong>Extracted Fields:</strong></p>
                {Object.entries(result.extractedFields).map(([key, value]) => (
                  <p key={key} className="muted">{key}: {String(value)}</p>
                ))}
              </div>
            )}

            {result.validationStatus === "invalid" && (
              <p className="error-text">Invalid document: {result.validationReason}</p>
            )}

            <button className="btn btn-outline" type="button" onClick={() => navigate("/eligibility")}>
              Go To Eligibility
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
