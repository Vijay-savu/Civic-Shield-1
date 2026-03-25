import { useEffect, useState } from "react";
import { getErrorMessage, getMyApplicationSummary, getMyApplications } from "../services/api";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function MyApplicationsPage() {
  const [summary, setSummary] = useState({
    applications: 0,
    eligible: 0,
    pending: 0,
    tamperAlerts: 0,
    latestScheme: "None",
    latestStatus: "None",
    lastSubmitted: null,
  });
  const [applications, setApplications] = useState([]);
  const [expandedId, setExpandedId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [summaryRes, applicationsRes] = await Promise.all([
        getMyApplicationSummary(),
        getMyApplications(),
      ]);
      setSummary(summaryRes.data || {});
      setApplications(applicationsRes.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page-stack">
      {error && <p className="error-text">{error}</p>}

      <div className="grid four">
        <div className="card metric">
          <span className="section-title">Applications</span>
          <h2 style={{ margin: "8px 0 0", fontSize: "3rem" }}>{summary.applications || 0}</h2>
        </div>
        <div className="card metric">
          <span className="section-title">Eligible</span>
          <h2 style={{ margin: "8px 0 0", fontSize: "3rem", color: "#1f8b61" }}>{summary.eligible || 0}</h2>
        </div>
        <div className="card metric">
          <span className="section-title">Pending</span>
          <h2 style={{ margin: "8px 0 0", fontSize: "3rem" }}>{summary.pending || 0}</h2>
        </div>
        <div className="card metric">
          <span className="section-title">Tamper Alerts</span>
          <h2 style={{ margin: "8px 0 0", fontSize: "3rem", color: "#cc2f3d" }}>{summary.tamperAlerts || 0}</h2>
        </div>
      </div>

      <div className="grid three">
        <div className="card metric">
          <span className="section-title">Latest Scheme</span>
          <h3 style={{ margin: "8px 0 0", fontSize: "2rem" }}>{summary.latestScheme || "None"}</h3>
        </div>
        <div className="card metric">
          <span className="section-title">Latest Status</span>
          <h3 style={{ margin: "8px 0 0", fontSize: "2rem" }}>{summary.latestStatus || "None"}</h3>
        </div>
        <div className="card metric">
          <span className="section-title">Last Submitted</span>
          <h3 style={{ margin: "8px 0 0", fontSize: "2rem" }}>{formatDate(summary.lastSubmitted)}</h3>
        </div>
      </div>

      <div className="grid two">
        {applications.map((application) => {
          const isExpanded = expandedId === application.id;
          return (
            <div key={application.id} className="card">
              <div className="scheme-status-row">
                <span className="scheme-tag">Scheme</span>
                <span className={`pill ${application.decisionStatus === "Eligible" ? "success" : "warn"}`}>
                  {application.decisionStatus}
                </span>
              </div>
              <h3 style={{ margin: "8px 0 4px", fontSize: "2rem" }}>{application.schemeName}</h3>
              <p className="muted">Submitted on {formatDate(application.submittedAt)}</p>

              <div className="grid two" style={{ marginTop: "10px" }}>
                <div className="status-box">
                  <span className="section-title">Application ID</span>
                  <p className="break" style={{ marginTop: "8px" }}>{application.id}</p>
                </div>
                <div className="status-box">
                  <span className="section-title">Decision</span>
                  <p style={{ marginTop: "8px" }}>{application.decisionStatus}</p>
                </div>
                <div className="status-box">
                  <span className="section-title">Documents</span>
                  <p style={{ marginTop: "8px" }}>{application.documentsStatus}</p>
                </div>
                <div className="status-box">
                  <span className="section-title">Income Check</span>
                  <p style={{ marginTop: "8px" }}>{application.incomeCheckStatus}</p>
                </div>
              </div>

              {isExpanded && <p className="muted" style={{ marginTop: "10px" }}>{application.decisionReason}</p>}

              <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setExpandedId((prev) => (prev === application.id ? "" : application.id))}
                >
                  {isExpanded ? "Close" : "Open"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {applications.length === 0 && (
        <div className="card">
          <p className="muted">No applications yet. Go to Apply for Schemes to submit your first loan application.</p>
        </div>
      )}
    </div>
  );
}
