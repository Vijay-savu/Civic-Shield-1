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
      <h1><FiAlertTriangle /> Alerts</h1>
      <p className="muted">Live alert feed for failed logins, rate-limit, and tampering.</p>

      <div className="card">
        <button className="btn" type="button" onClick={loadAlerts}>Refresh Alerts</button>

        {loading && <p className="muted">Loading alerts...</p>}
        {error && <p className="error-text">{error}</p>}

        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert._id}>
                    <td>{alert.type}</td>
                    <td>{alert.riskScore}</td>
                    <td>{alert.status}</td>
                    <td>{alert.message}</td>
                    <td>{formatDate(alert.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alerts.length === 0 && <p className="muted">No alerts found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
