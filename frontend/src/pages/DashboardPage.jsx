import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getAdminLogs,
  getErrorMessage,
  getMyApplicationSummary,
  getMyApplications,
} from "../services/api";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();
  const [summary, setSummary] = useState({
    applications: 0,
    eligible: 0,
    pending: 0,
    tamperAlerts: 0,
    latestScheme: "None",
    latestStatus: "None",
    lastSubmitted: null,
  });
  const [adminMetrics, setAdminMetrics] = useState({
    totalRegisteredUsers: 0,
    registeredCitizens: 0,
    totalApplications: 0,
    eligibleApplications: 0,
    notEligibleApplications: 0,
    pendingReviewApplications: 0,
    suspiciousApplications: 0,
  });
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState("");

  const loadCitizen = async () => {
    const [summaryRes, applicationsRes] = await Promise.all([
      getMyApplicationSummary(),
      getMyApplications(),
    ]);
    setSummary(summaryRes.data || {});
    setApplications(applicationsRes.data || []);
  };

  const loadAdmin = async () => {
    const overviewRes = await getAdminLogs();
    setAdminMetrics(overviewRes.data?.metrics || {});
    setApplications([]);
  };

  const load = async () => {
    setError("");
    try {
      if (isAdmin) {
        await loadAdmin();
      } else {
        await loadCitizen();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  const recentApplications = useMemo(() => applications.slice(0, 3), [applications]);

  if (isAdmin) {
    return (
      <div className="page-stack">
        {error && <p className="error-text">{error}</p>}

        <div className="card">
          <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
          <p className="muted" style={{ margin: "10px 0 0" }}>
            Admin view is focused on platform oversight and application decisions.
          </p>
        </div>

        <div className="grid four">
          <div className="card metric">
            <span className="section-title">Applications</span>
            <h2 style={{ margin: "8px 0 0", fontSize: "3rem" }}>{adminMetrics.totalApplications || 0}</h2>
          </div>
          <div className="card metric">
            <span className="section-title">Needs Review</span>
            <h2 style={{ margin: "8px 0 0", fontSize: "3rem", color: "#9d7800" }}>
              {adminMetrics.pendingReviewApplications || 0}
            </h2>
          </div>
          <div className="card metric">
            <span className="section-title">Eligible</span>
            <h2 style={{ margin: "8px 0 0", fontSize: "3rem", color: "#1f8b61" }}>
              {adminMetrics.eligibleApplications || 0}
            </h2>
          </div>
          <div className="card metric">
            <span className="section-title">Not Eligible</span>
            <h2 style={{ margin: "8px 0 0", fontSize: "3rem", color: "#c04b22" }}>
              {adminMetrics.notEligibleApplications || 0}
            </h2>
          </div>
        </div>

        <div className="grid two">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Admin Actions</h3>
            <p className="muted">Review applications and decide accept/deny with reason.</p>
            <div className="grid two" style={{ marginTop: "10px" }}>
              <Link to="/admin/applications" className="btn">Open Applications</Link>
              <Link to="/admin/logs" className="btn btn-outline">Open Overview</Link>
              <Link to="/alerts" className="btn btn-outline">Security Alerts</Link>
              <button type="button" className="btn btn-outline" onClick={load}>Refresh Dashboard</button>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Registered Users</h3>
            <div className="grid two" style={{ marginTop: "10px" }}>
              <div className="status-box">
                <span className="section-title">Total Users</span>
                <p style={{ marginTop: "8px", fontSize: "1.5rem", fontWeight: 700 }}>
                  {adminMetrics.totalRegisteredUsers || 0}
                </p>
              </div>
              <div className="status-box">
                <span className="section-title">Citizens</span>
                <p style={{ marginTop: "8px", fontSize: "1.5rem", fontWeight: 700 }}>
                  {adminMetrics.registeredCitizens || 0}
                </p>
              </div>
              <div className="status-box">
                <span className="section-title">Suspicious</span>
                <p style={{ marginTop: "8px", fontSize: "1.5rem", fontWeight: 700, color: "#cc2f3d" }}>
                  {adminMetrics.suspiciousApplications || 0}
                </p>
              </div>
              <div className="status-box">
                <span className="section-title">Pending Review</span>
                <p style={{ marginTop: "8px", fontSize: "1.5rem", fontWeight: 700, color: "#9d7800" }}>
                  {adminMetrics.pendingReviewApplications || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
          <p className="muted">Use these shortcuts for demo flow.</p>
          <div className="grid two" style={{ marginTop: "10px" }}>
            <Link to="/eligibility" className="btn">Apply for Schemes</Link>
            <Link to="/applications" className="btn btn-outline">My Applications</Link>
            <Link to="/upload" className="btn btn-outline">My Documents</Link>
            <Link to="/alerts" className="btn btn-outline">Security Alerts</Link>
          </div>
        </div>

        <div className="card">
          <div className="scheme-status-row" style={{ marginBottom: "8px" }}>
            <h3 style={{ margin: 0 }}>Recent Applications</h3>
            <Link to="/applications" className="btn btn-outline">View All</Link>
          </div>

          {recentApplications.length === 0 && (
            <p className="muted">No applications yet. Submit your first scheme application.</p>
          )}

          {recentApplications.map((application) => (
            <div key={application.id} className="status-box" style={{ marginTop: "10px" }}>
              <div className="scheme-status-row">
                <strong>{application.schemeName}</strong>
                <span className={`pill ${application.decisionStatus === "Eligible" ? "success" : "warn"}`}>
                  {application.decisionStatus}
                </span>
              </div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Submitted on {formatDate(application.submittedAt)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
