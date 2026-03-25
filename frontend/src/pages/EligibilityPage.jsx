import { useEffect, useState } from "react";
import { FiCheckCircle, FiShield } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { checkEligibility, checkTamper, getErrorMessage } from "../services/api";

export default function EligibilityPage() {
  const { lastDocumentId } = useAuth();
  const [documentId, setDocumentId] = useState(lastDocumentId || "");
  const [eligibility, setEligibility] = useState(null);
  const [tamper, setTamper] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDocumentId(lastDocumentId || "");
  }, [lastDocumentId]);

  const runEligibility = async () => {
    setError("");
    try {
      const response = await checkEligibility(documentId);
      setEligibility(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const runTamperCheck = async () => {
    setError("");
    try {
      const response = await checkTamper(documentId);
      setTamper(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="page-stack">
      <h1><FiCheckCircle /> Eligibility Result</h1>
      <p className="muted">Privacy-preserving output: only status and reason.</p>

      <div className="card form-grid inline">
        <label>
          Document ID
          <input value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="Enter document id" />
        </label>
        <button className="btn" type="button" onClick={runEligibility} disabled={!documentId}>Check Eligibility</button>
        <button className="btn btn-outline" type="button" onClick={runTamperCheck} disabled={!documentId}>
          <FiShield /> Check Tamper
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="grid two">
        <div className="card">
          <h3>Eligibility</h3>
          {eligibility ? (
            <>
              <p><strong>Status:</strong> {eligibility.status}</p>
              <p><strong>Reason:</strong> {eligibility.reason}</p>
              <p><strong>Risk Score:</strong> {eligibility.riskScore}</p>
            </>
          ) : (
            <p className="muted">No eligibility result yet.</p>
          )}
        </div>

        <div className="card">
          <h3>Tamper Check</h3>
          {tamper ? (
            <>
              <p><strong>Status:</strong> {tamper.status}</p>
              <p><strong>Reason:</strong> {tamper.reason}</p>
              <p><strong>Risk Score:</strong> {tamper.riskScore}</p>
            </>
          ) : (
            <p className="muted">No tamper check result yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
