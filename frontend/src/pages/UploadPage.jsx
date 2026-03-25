import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiUploadCloud, FiX } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { deleteDocument, getErrorMessage, getMyDocuments, uploadDocument } from "../services/api";

const DOCUMENT_TYPES = [
  { value: "aadhaar_card", label: "Aadhaar Card" },
  { value: "pan_card", label: "PAN Card" },
  { value: "ration_card", label: "Ration Card" },
  { value: "voter_id", label: "Voter ID" },
  { value: "passport", label: "Passport" },
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
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingDocType, setDeletingDocType] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [uploadState, setUploadState] = useState({});

  const uploadedCount = useMemo(() => Object.values(uploadState).length, [uploadState]);
  const missingCount = DOCUMENT_TYPES.length - uploadedCount;

  const loadUploadedDocuments = async () => {
    setLoadingDocs(true);
    try {
      const response = await getMyDocuments();
      const nextState = (response.data || []).reduce((acc, doc) => {
        acc[doc.documentType] = doc;
        return acc;
      }, {});
      setUploadState(nextState);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    const preferredDocType = localStorage.getItem("civicshield_preferred_doc_type");
    if (preferredDocType && DOCUMENT_TYPES.some((doc) => doc.value === preferredDocType)) {
      setDocumentType(preferredDocType);
    }
    localStorage.removeItem("civicshield_preferred_doc_type");
    loadUploadedDocuments();
  }, []);

  const resetUploadForm = () => {
    setFile(null);
    setOcrHint("");
    setResult(null);
    setError("");
    setFileInputKey((prev) => prev + 1);
  };

  const handleDocumentTypeChange = (nextType) => {
    setDocumentType(nextType);
    resetUploadForm();
  };

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
      setUploadState((prev) => {
        const next = { ...prev, [documentType]: response.data };
        const nextMissingDoc = DOCUMENT_TYPES.find((doc) => !next[doc.value]);
        if (nextMissingDoc?.value) {
          setDocumentType(nextMissingDoc.value);
        }
        return next;
      });
      setFile(null);
      setOcrHint("");
      setFileInputKey((prev) => prev + 1);
    } catch (err) {
      setError(getErrorMessage(err));
      if (err?.response?.data?.reason === "document_type_already_uploaded") {
        await loadUploadedDocuments();
      }
    } finally {
      setLoading(false);
    }
  };

  const removeDocument = async (docType, documentId) => {
    const shouldDelete = window.confirm("Remove this uploaded document?");
    if (!shouldDelete) {
      return;
    }

    setError("");
    setResult(null);
    setDeletingDocType(docType);

    try {
      await deleteDocument(documentId);
      setUploadState((prev) => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
      if (documentType === docType) {
        setFile(null);
      }
      setLastDocumentId("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingDocType("");
    }
  };

  return (
    <div className="page-stack">
      <div className="grid two">
        <div className="card">
          <span className="section-title">Uploaded</span>
          <h2 style={{ margin: "8px 0 0", fontSize: "3rem" }}>{uploadedCount}</h2>
        </div>
        <div className="card">
          <span className="section-title">Missing</span>
          <h2 style={{ margin: "8px 0 0", fontSize: "3rem", color: "#cc7a12" }}>{missingCount}</h2>
        </div>
      </div>

      <div className="card">
        <span className="section-title">Document Status</span>
        {loadingDocs && <p className="muted" style={{ marginTop: "8px" }}>Loading uploaded documents...</p>}
        <div className="grid two" style={{ marginTop: "12px" }}>
          {DOCUMENT_TYPES.map((doc) => {
            const uploaded = uploadState[doc.value];
            const statusText = uploaded
              ? (uploaded.validationStatus === "valid" ? "Verified" : "Invalid")
              : "Missing";
            return (
              <div key={doc.value} className="status-box">
                <div className="scheme-status-row">
                  <strong style={{ fontSize: "1.8rem" }}>{doc.label}</strong>
                  <div className="doc-actions">
                    <span className={`pill ${statusText === "Verified" ? "success" : "warn"}`}>{statusText}</span>
                    {uploaded?.id && (
                      <button
                        type="button"
                        className="icon-delete-btn"
                        aria-label={`Remove ${doc.label}`}
                        onClick={() => removeDocument(doc.value, uploaded.id)}
                        disabled={deletingDocType === doc.value}
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                </div>
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {uploaded ? uploaded.validationReason : "Not uploaded"}
                </p>
                {uploaded?.sha256Hash && (
                  <p className="small-text muted" style={{ margin: "4px 0 0" }}>
                    SHA-256: {uploaded.sha256Hash.slice(0, 18)}...
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="scheme-status-row" style={{ marginBottom: "12px" }}>
          <div>
            <span className="section-title">Upload</span>
            <h2 style={{ margin: "10px 0 0", fontSize: "2.6rem" }}>
              <FiUploadCloud style={{ verticalAlign: "middle" }} /> Add Document
            </h2>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Only one upload is allowed per document type.
            </p>
          </div>
          <span className="muted">PDF or image</span>
        </div>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          Supported: all image formats, PDF, TXT, CSV, JSON, MD, DOC, DOCX.
        </p>

        <form onSubmit={submitUpload} className="form-grid">
          <label>
            Document Type
            <select value={documentType} onChange={(e) => handleDocumentTypeChange(e.target.value)} required>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Upload File
            <input
              key={fileInputKey}
              type="file"
              accept="image/*,.pdf,.txt,.csv,.json,.md,.doc,.docx"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError("");
                setResult(null);
              }}
              required
            />
          </label>

          <label>
            OCR Hint (Optional for image/PDF demo)
            <textarea
              rows={4}
              value={ocrHint}
              onChange={(e) => setOcrHint(e.target.value)}
              placeholder="Example: Aadhaar 1234 5678 9012 | PAN ABCDE1234F | Income Rs 240000"
            />
          </label>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Uploading..." : "Upload Document"}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}

        {result && result.validationStatus === "valid" && (
          <div className="result-box">
            <div className="doc-actions">
              <span className="pill success">Verified</span>
            </div>
            <button className="btn btn-outline" type="button" onClick={() => navigate("/eligibility")}>
              Go To Eligibility
            </button>
          </div>
        )}

        {result && result.validationStatus !== "valid" && (
          <div className="result-box">
            <p><strong>Document ID:</strong> {result.id}</p>
            <p><strong>Type:</strong> {result.documentType}</p>
            <p><strong>Validation:</strong> {result.validationStatus}</p>
            <p><strong>Reason:</strong> {result.validationReason}</p>
            <p><strong>OCR Status:</strong> {result.ocrStatus}</p>
            <p><strong>SHA-256:</strong> {result.sha256Hash}</p>
            <p className="error-text">Invalid document: {result.validationReason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
