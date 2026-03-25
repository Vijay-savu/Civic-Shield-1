import { useEffect, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { getAlerts, getErrorMessage } from "../services/api";

function formatDate(dateValue) {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleString();
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAlerts = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await getAlerts();
      setAlerts(response.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  return (
    <div className="page-stack">
      <div className="card">
        <h1 style={{ margin: "0 0 8px" }}><FiAlertTriangle /> Security Alerts</h1>
        <p className="muted">If this activity is not yours, contact support and avoid uploading new documents.</p>
        <button className="btn btn-outline" type="button" onClick={loadAlerts}>Refresh Alerts</button>
      </div>

      {loading && <p className="muted">Loading alerts...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          {alerts.map((alert) => (
            <div key={alert._id} className="card" style={{ background: alert.riskScore === "High" ? "#fff2f4" : "#fffdee" }}>
              <div className="scheme-status-row">
                <span className="section-title">{String(alert.type || "alert").replace(/_/g, " ")}</span>
                <span className={`pill ${alert.riskScore === "High" ? "warn" : "active"}`}>{alert.riskScore}</span>
              </div>
              <h3 style={{ margin: "10px 0 8px", fontSize: "2rem" }}>{alert.message}</h3>
              <p className="muted" style={{ margin: 0 }}>Status: {alert.status}</p>
              <p className="muted" style={{ margin: "6px 0 0" }}>{formatDate(alert.createdAt)}</p>
            </div>
          ))}

          {alerts.length === 0 && (
            <div className="card">
              <p className="muted">No alerts found.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
