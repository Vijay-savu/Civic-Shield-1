import { useEffect, useState } from "react";
import { FiLock } from "react-icons/fi";
import { getAdminLogs, getErrorMessage } from "../services/api";

function MetricCard({ title, value, accent }) {
  return (
    <div className="card metric">
      <span className="section-title">{title}</span>
      <h2 style={{ margin: "8px 0 0", fontSize: "3rem", color: accent || "#0f2d56" }}>{value}</h2>
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

  const metrics = data?.metrics || {};
  const schemeStats = data?.schemeStats || [];

  return (
    <div className="page-stack">
      <h1><FiLock /> Admin Overview</h1>
      <p className="muted">Admin can view only aggregate platform stats: registrations, applications, and eligibility outcomes.</p>

      <div className="card">
        <button className="btn" type="button" onClick={load}>Refresh Overview</button>
        {loading && <p className="muted">Loading overview...</p>}
        {error && <p className="error-text">{error}</p>}
      </div>

      {data && (
        <>
          <div className="grid four">
            <MetricCard title="Registered Users" value={metrics.totalRegisteredUsers || 0} />
            <MetricCard title="Registered Citizens" value={metrics.registeredCitizens || 0} />
            <MetricCard title="Total Applications" value={metrics.totalApplications || 0} />
            <MetricCard title="Eligible" value={metrics.eligibleApplications || 0} accent="#1f8b61" />
          </div>

          <div className="grid four">
            <MetricCard title="Not Eligible" value={metrics.notEligibleApplications || 0} accent="#c04b22" />
            <MetricCard title="Needs Review" value={metrics.pendingReviewApplications || 0} accent="#9d7800" />
            <MetricCard title="Suspicious" value={metrics.suspiciousApplications || 0} accent="#cc2f3d" />
            <MetricCard title="Admins" value={metrics.registeredAdmins || 0} />
          </div>

          <div className="card">
            <h3>Scheme-wise Summary</h3>
            {schemeStats.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Scheme</th>
                      <th>Total</th>
                      <th>Eligible</th>
                      <th>Not Eligible</th>
                      <th>Needs Review</th>
                      <th>Suspicious</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemeStats.map((row) => (
                      <tr key={row.schemeName}>
                        <td>{row.schemeName}</td>
                        <td>{row.total}</td>
                        <td>{row.eligible}</td>
                        <td>{row.notEligible}</td>
                        <td>{row.needsReview}</td>
                        <td>{row.suspicious}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No applications submitted yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
