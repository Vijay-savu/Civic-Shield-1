import { useEffect, useState } from "react";
import { FiLock } from "react-icons/fi";
import { getAdminLogs, getErrorMessage } from "../services/api";

function formatDate(dateValue) {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleString();
}

function LogSection({ title, rows }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {rows?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Outcome</th>
                <th>Actor</th>
                <th>Reason</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>{row.action}</td>
                  <td>{row.outcome}</td>
                  <td>{row.actorEmail || "-"}</td>
                  <td>{row.metadata?.reason || row.metadata?.status || "-"}</td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No data</p>
      )}
    </div>
  );
}

export default function AdminLogsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getAdminLogs();
      setData(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page-stack">
      <h1><FiLock /> Admin Logs</h1>
      <p className="muted">Aggregated view for login attempts, uploads, tampering, and alerts.</p>

      <div className="card">
        <button className="btn" type="button" onClick={load}>Refresh Logs</button>
        {loading && <p className="muted">Loading logs...</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      {data && (
        <div className="grid two">
          <LogSection title="Login Attempts" rows={data.loginAttempts} />
          <LogSection title="Uploads" rows={data.uploads} />
          <LogSection title="Tampering" rows={data.tampering} />
          <div className="card">
            <h3>Alerts</h3>
            {data.alerts?.length ? (
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
                    {data.alerts.map((alert) => (
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
              </div>
            ) : (
              <p className="muted">No alerts</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
