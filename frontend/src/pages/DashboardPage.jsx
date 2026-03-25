import { useEffect, useState } from "react";
import { FiAlertTriangle, FiShield, FiUploadCloud } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import {
  getErrorMessage,
  getCurrentUser,
  simulateFailedLogin,
  simulateTampering,
  validateToken,
} from "../services/api";

export default function DashboardPage() {
  const { user, lastDocumentId, isAdmin } = useAuth();
  const [tokenStatus, setTokenStatus] = useState("Checking...");
  const [riskScore, setRiskScore] = useState(user?.riskScore || "Low");
  const [demoEmail, setDemoEmail] = useState(user?.email || "");
  const [tamperDocId, setTamperDocId] = useState(lastDocumentId || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [tokenRes, meRes] = await Promise.all([validateToken(), getCurrentUser()]);
        setTokenStatus(tokenRes?.data?.status || "valid");
        setRiskScore(meRes?.data?.riskScore || "Low");
      } catch (err) {
        setTokenStatus(getErrorMessage(err));
      }
    };
    load();
  }, []);

  useEffect(() => {
    setTamperDocId(lastDocumentId || "");
  }, [lastDocumentId]);

  const runFailedLoginDemo = async () => {
    setError("");
    setMessage("");
    try {
      const response = await simulateFailedLogin({ email: demoEmail, attempts: 5 });
      setMessage(`Failed-login simulated: ${response?.data?.reason} (Risk: ${response?.data?.riskScore})`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const runTamperDemo = async () => {
    setError("");
    setMessage("");
    try {
      const response = await simulateTampering(tamperDocId);
      setMessage(`Tampering simulated: ${response?.data?.reason} (Risk: ${response?.data?.riskScore})`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="page-stack">
      <h1>Dashboard</h1>
      <p className="muted">Secure decision system overview and demo controls.</p>

      <div className="grid three">
        <div className="card metric">
          <FiShield />
          <h3>Token Validation</h3>
          <p>{tokenStatus}</p>
        </div>
        <div className="card metric">
          <FiAlertTriangle />
          <h3>Fraud Risk Score</h3>
          <p>{riskScore}</p>
        </div>
        <div className="card metric">
          <FiUploadCloud />
          <h3>Latest Document ID</h3>
          <p className="small-text break">{lastDocumentId || "No upload yet"}</p>
        </div>
      </div>

      <div className="card">
        <h2>Demo Controls</h2>
        <p className="muted">Use these buttons for smooth hackathon demo flow.</p>

        {!isAdmin && <p className="hint">Admin role required for demo trigger APIs.</p>}

        <div className="form-grid inline">
          <label>
            Simulate Failed Login (email)
            <input value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)} placeholder="citizen@email.com" />
          </label>
          <button className="btn" type="button" onClick={runFailedLoginDemo} disabled={!isAdmin}>
            Simulate Failed Login
          </button>
        </div>

        <div className="form-grid inline">
          <label>
            Simulate Tampering (document id)
            <input value={tamperDocId} onChange={(e) => setTamperDocId(e.target.value)} placeholder="Document ID" />
          </label>
          <button className="btn" type="button" onClick={runTamperDemo} disabled={!isAdmin || !tamperDocId}>
            Simulate Tampering
          </button>
        </div>

        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h2>Demo Line</h2>
        <p className="small-text">Login OTP to Upload to Eligibility, then wrong login blocked, tamper detected, alerts and logs visible.</p>
      </div>
    </div>
  );
}

