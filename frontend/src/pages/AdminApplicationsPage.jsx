import { useEffect, useMemo, useState } from "react";
import {
  getAdminApplications,
  getErrorMessage,
  reviewAdminApplication,
} from "../services/api";

const STATUS_FILTERS = ["all", "Needs Review", "Suspicious", "Eligible", "Not Eligible"];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function getPillClass(status) {
  if (status === "Eligible") return "pill success";
  if (status === "Not Eligible" || status === "Suspicious") return "pill warn";
  return "pill active";
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasonById, setReasonById] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [inlineErrorById, setInlineErrorById] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = statusFilter === "all" ? { limit: 100 } : { status: statusFilter, limit: 100 };
      const response = await getAdminApplications(params);
      setApplications(response.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const totalCount = useMemo(() => applications.length, [applications]);

  const setReason = (id, value) => {
    setReasonById((prev) => ({ ...prev, [id]: value }));
    setInlineErrorById((prev) => ({ ...prev, [id]: "" }));
  };

  const handleReview = async (applicationId, action) => {
    const reason = String(reasonById[applicationId] || "").trim();

    if (action === "denied" && !reason) {
      setInlineErrorById((prev) => ({
        ...prev,
        [applicationId]: "Please add denial reason before rejecting.",
      }));
      return;
    }

    setActionLoadingId(applicationId);
    setError("");
    try {
      const response = await reviewAdminApplication(applicationId, {
        action,
        reason,
      });

      const updated = response.data;
      setApplications((prev) => prev.map((item) => (item.id === applicationId ? updated : item)));
      setInlineErrorById((prev) => ({ ...prev, [applicationId]: "" }));
    } catch (err) {
      setInlineErrorById((prev) => ({
        ...prev,
        [applicationId]: getErrorMessage(err),
      }));
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="page-stack">
      <div className="card">
        <div className="scheme-status-row">
          <h1 style={{ margin: 0 }}>Admin Applications</h1>
          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="muted" style={{ margin: "10px 0 0" }}>
          Review citizen applications, approve or deny, and provide denial reason when rejecting.
        </p>

        <div className="form-grid inline" style={{ marginTop: "14px" }}>
          <label>
            Filter by status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="status-box">
            <span className="section-title">Total</span>
            <p style={{ margin: "8px 0 0", fontWeight: 700 }}>{totalCount}</p>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {applications.map((application) => {
        const denyReason = reasonById[application.id] || "";
        const inlineError = inlineErrorById[application.id] || "";
        const busy = actionLoadingId === application.id;

        return (
          <div key={application.id} className="card">
            <div className="scheme-status-row" style={{ marginBottom: "10px" }}>
              <div>
                <span className="scheme-tag">Application</span>
                <h3 style={{ margin: "8px 0 4px", fontSize: "1.8rem" }}>{application.schemeName}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Citizen: {application.citizen?.email || "unknown"}
                </p>
              </div>
              <span className={getPillClass(application.decisionStatus)}>{application.decisionStatus}</span>
            </div>

            <div className="grid two">
              <div className="status-box">
                <span className="section-title">Application ID</span>
                <p className="break" style={{ marginTop: "8px" }}>{application.id}</p>
              </div>
              <div className="status-box">
                <span className="section-title">Submitted</span>
                <p style={{ marginTop: "8px" }}>{formatDate(application.submittedAt)}</p>
              </div>
              <div className="status-box">
                <span className="section-title">Current Reason</span>
                <p style={{ marginTop: "8px" }}>{application.decisionReason || "-"}</p>
              </div>
              <div className="status-box">
                <span className="section-title">Last Review</span>
                <p style={{ marginTop: "8px" }}>
                  {application.reviewAction
                    ? `${application.reviewAction} by ${application.reviewedBy || "admin"} on ${formatDate(application.reviewedAt)}`
                    : "Not reviewed yet"}
                </p>
              </div>
            </div>

            <label style={{ marginTop: "12px" }}>
              Denial reason (required only when denying)
              <textarea
                value={denyReason}
                onChange={(event) => setReason(application.id, event.target.value)}
                placeholder="Example: Denied because income exceeds scheme threshold."
              />
            </label>

            {inlineError && <p className="error-text">{inlineError}</p>}

            <div className="doc-actions" style={{ marginTop: "10px" }}>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => handleReview(application.id, "accepted")}
              >
                {busy ? "Saving..." : "Accept"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => handleReview(application.id, "denied")}
              >
                {busy ? "Saving..." : "Deny"}
              </button>
            </div>
          </div>
        );
      })}

      {!loading && applications.length === 0 && (
        <div className="card">
          <p className="muted">No applications found for the selected filter.</p>
        </div>
      )}
    </div>
  );
}
