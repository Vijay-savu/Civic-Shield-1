import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createLoanApplication,
  getErrorMessage,
  getLoanRequirements,
  getMyApplications,
  getMyDocuments,
} from "../services/api";

const DOC_FIELD_BY_TYPE = {
  aadhaar_card: "aadhaarDocumentId",
  pan_card: "panDocumentId",
  income_certificate: "incomeDocumentId",
  birth_certificate: "birthCertificateDocumentId",
  ration_card: "rationCardDocumentId",
  driving_licence: "drivingLicenceDocumentId",
};

const DOC_LABEL = {
  aadhaar_card: "Aadhaar",
  pan_card: "PAN",
  income_certificate: "Income Certificate",
  birth_certificate: "Birth Certificate",
  ration_card: "Ration Card",
  driving_licence: "Driving Licence",
};

const EMPTY_DOC_OPTIONS = {
  aadhaar_card: [],
  pan_card: [],
  income_certificate: [],
  birth_certificate: [],
  ration_card: [],
  driving_licence: [],
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function normalizeRequiredDocuments(rule) {
  const docs = Array.isArray(rule?.requiredDocuments) ? rule.requiredDocuments : [];

  return docs
    .map((item) => {
      if (typeof item === "string") {
        return {
          type: item,
          label: DOC_LABEL[item] || item,
          payloadField: DOC_FIELD_BY_TYPE[item],
        };
      }

      const type = item?.type;
      if (!type) {
        return null;
      }

      return {
        type,
        label: item.label || DOC_LABEL[type] || type,
        payloadField: item.payloadField || DOC_FIELD_BY_TYPE[type],
      };
    })
    .filter(Boolean);
}

function getSchemeEligibilityText(scheme) {
  if (scheme?.requiresIncomeCheck) {
    return `Eligible when verified annual income is Rs. ${(scheme.incomeThreshold || 0).toLocaleString()} or below.`;
  }

  if (scheme?.requiresAgeCheck) {
    return `Eligible when applicant age is ${scheme.minAge || 0}+ with required identity documents.`;
  }

  return "Eligibility is based on required scheme documents.";
}

export default function EligibilityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [requirements, setRequirements] = useState([]);
  const [docOptions, setDocOptions] = useState(EMPTY_DOC_OPTIONS);
  const [applications, setApplications] = useState([]);

  const [form, setForm] = useState({
    applicantName: String(user?.email || "").split("@")[0] || "",
    applicantAge: "",
    residentialAddress: "",
    schemeName: "Education Loan",
    aadhaarDocumentId: "",
    panDocumentId: "",
    incomeDocumentId: "",
    birthCertificateDocumentId: "",
    rationCardDocumentId: "",
    drivingLicenceDocumentId: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const selectedSchemeRule = useMemo(
    () => requirements.find((rule) => rule.schemeName === form.schemeName) || null,
    [requirements, form.schemeName]
  );

  const requiredDocuments = useMemo(() => {
    if (selectedSchemeRule) {
      return normalizeRequiredDocuments(selectedSchemeRule);
    }

    return normalizeRequiredDocuments({
      requiredDocuments: ["aadhaar_card", "pan_card", "income_certificate"],
    });
  }, [selectedSchemeRule]);

  const requiredDocTypes = useMemo(
    () => requiredDocuments.map((doc) => doc.type).filter(Boolean),
    [requiredDocuments]
  );

  const requiresAgeInput = Boolean(selectedSchemeRule?.requiresAgeCheck);
  const ageMinimum = selectedSchemeRule?.minAge || 0;
  const isAgeMissing = requiresAgeInput && !String(form.applicantAge || "").trim();

  const requiredDocState = useMemo(
    () =>
      requiredDocTypes.map((type) => {
        const fieldName = DOC_FIELD_BY_TYPE[type];
        const options = docOptions[type] || [];
        const selectedId = fieldName ? form[fieldName] : "";
        return {
          type,
          label: DOC_LABEL[type] || type,
          hasUpload: options.length > 0,
          isSelected: Boolean(selectedId),
        };
      }),
    [requiredDocTypes, docOptions, form]
  );

  const missingUploads = useMemo(
    () => requiredDocState.filter((item) => !item.hasUpload).map((item) => item.type),
    [requiredDocState]
  );

  const pendingSelections = useMemo(
    () => requiredDocState.filter((item) => item.hasUpload && !item.isSelected).map((item) => item.type),
    [requiredDocState]
  );

  const applySchemeSelection = (schemeName) => {
    const schemeRule = requirements.find((rule) => rule.schemeName === schemeName);
    const neededDocs = normalizeRequiredDocuments(schemeRule);

    setForm((prev) => {
      const next = { ...prev, schemeName };

      neededDocs.forEach((document) => {
        const fieldName = DOC_FIELD_BY_TYPE[document.type];
        if (!fieldName) {
          return;
        }

        next[fieldName] = "";
      });

      if (!schemeRule?.requiresAgeCheck) {
        next.applicantAge = "";
      }

      return next;
    });
  };

  const loadPageData = async () => {
    setError("");
    try {
      const [requirementsRes, documentsRes, applicationsRes] = await Promise.all([
        getLoanRequirements(),
        getMyDocuments(),
        getMyApplications(),
      ]);

      const schemeRules = requirementsRes.data?.schemeThresholds || [];
      setRequirements(schemeRules);

      const byType = {
        aadhaar_card: [],
        pan_card: [],
        income_certificate: [],
        birth_certificate: [],
        ration_card: [],
        driving_licence: [],
      };

      (documentsRes.data || []).forEach((doc) => {
        if (byType[doc.documentType]) {
          byType[doc.documentType].push(doc);
        }
      });

      setDocOptions(byType);
      setApplications(applicationsRes.data || []);

      const initialScheme =
        schemeRules.find((rule) => rule.schemeName === form.schemeName)?.schemeName ||
        schemeRules[0]?.schemeName ||
        "Education Loan";

      setForm((prev) => {
        const next = { ...prev, schemeName: initialScheme };
        Object.values(DOC_FIELD_BY_TYPE).forEach((fieldName) => {
          next[fieldName] = "";
        });

        if (!schemeRules.find((rule) => rule.schemeName === initialScheme)?.requiresAgeCheck) {
          next.applicantAge = "";
        }

        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const onChange = (key) => (event) => {
    if (key === "schemeName") {
      applySchemeSelection(event.target.value);
      return;
    }

    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const submitApplication = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await createLoanApplication({
        applicantName: form.applicantName,
        applicantAge: form.applicantAge,
        residentialAddress: form.residentialAddress,
        schemeName: form.schemeName,
        documents: {
          aadhaarDocumentId: form.aadhaarDocumentId,
          panDocumentId: form.panDocumentId,
          incomeDocumentId: form.incomeDocumentId,
          birthCertificateDocumentId: form.birthCertificateDocumentId,
          rationCardDocumentId: form.rationCardDocumentId,
          drivingLicenceDocumentId: form.drivingLicenceDocumentId,
        },
      });

      setResult(response.data);
      await loadPageData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const visibleSchemes = requirements.length
    ? requirements
    : [
        {
          schemeName: "Education Loan",
          incomeThreshold: 500000,
          requiresIncomeCheck: true,
          requiresAgeCheck: false,
          minAge: null,
          requiredDocuments: [
            { type: "aadhaar_card", label: "Aadhaar" },
            { type: "pan_card", label: "PAN" },
            { type: "income_certificate", label: "Income Certificate" },
          ],
        },
      ];

  const documentGridClass = requiredDocuments.length >= 3 ? "grid three" : "grid two";

  return (
    <div className="page-stack">
      <div className="grid two">
        {visibleSchemes.map((item) => {
          const selected = form.schemeName === item.schemeName;
          const docs = normalizeRequiredDocuments(item);
          return (
            <div key={item.schemeName} className="scheme-card" style={{ borderColor: selected ? "#87a8ee" : undefined }}>
              <div className="scheme-status-row">
                <span className="scheme-tag">Scheme</span>
                <button
                  className={`btn ${selected ? "" : "btn-outline"}`}
                  type="button"
                  onClick={() => applySchemeSelection(item.schemeName)}
                >
                  {selected ? "Selected" : "Choose"}
                </button>
              </div>
              <h3 style={{ margin: 0, fontSize: "2rem" }}>{item.schemeName}</h3>
              <p className="muted" style={{ margin: 0 }}>{getSchemeEligibilityText(item)}</p>
              <p className="small-text muted" style={{ margin: "8px 0 0" }}>
                Required: {docs.map((doc) => doc.label).join(", ") || "-"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="scheme-status-row" style={{ marginBottom: "8px" }}>
          <h2 style={{ margin: 0 }}>Scheme Application</h2>
          <span className="muted">{form.schemeName}</span>
        </div>

        {(missingUploads.length > 0 || pendingSelections.length > 0 || isAgeMissing) && (
          <div className="status-box" style={{ marginBottom: "14px", background: "#fff8ea", borderColor: "#f0ddab" }}>
            {missingUploads.length > 0 && (
              <strong>Missing upload: {missingUploads.map((docType) => DOC_LABEL[docType] || docType).join(", ")}</strong>
            )}
            {pendingSelections.length > 0 && (
              <p style={{ margin: "8px 0 0", fontWeight: 600 }}>
                Please select uploaded document: {pendingSelections.map((docType) => DOC_LABEL[docType] || docType).join(", ")}.
              </p>
            )}
            {isAgeMissing && (
              <p style={{ margin: "8px 0 0", fontWeight: 600 }}>Age is required for this scheme (minimum {ageMinimum}+).</p>
            )}
            {missingUploads.length > 0 && (
              <div className="doc-actions" style={{ marginTop: "10px" }}>
                {missingUploads.map((docType) => (
                  <button
                    key={docType}
                    className="btn btn-outline"
                    type="button"
                    onClick={() => {
                      localStorage.setItem("civicshield_preferred_doc_type", docType);
                      navigate("/upload");
                    }}
                  >
                    Upload {DOC_LABEL[docType] || docType}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={submitApplication} className="form-grid">
          <div className="grid two">
            <label>
              Applicant name
              <input value={form.applicantName} onChange={onChange("applicantName")} required />
            </label>
            <label>
              Scheme
              <select value={form.schemeName} onChange={onChange("schemeName")}>
                {visibleSchemes.map((item) => (
                  <option key={item.schemeName} value={item.schemeName}>
                    {item.schemeName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {requiresAgeInput && (
            <label>
              Applicant age
              <input
                type="number"
                min={ageMinimum || 1}
                max={120}
                value={form.applicantAge}
                onChange={onChange("applicantAge")}
                placeholder={`Enter age (${ageMinimum}+ required)`}
                required
              />
            </label>
          )}

          <label>
            Residential address
            <textarea value={form.residentialAddress} onChange={onChange("residentialAddress")} required />
          </label>

          <div className={documentGridClass}>
            {requiredDocuments.map((document) => {
              const fieldName = DOC_FIELD_BY_TYPE[document.type];
              if (!fieldName) {
                return null;
              }

              return (
                <label key={document.type}>
                  Select {document.label}
                  <select value={form[fieldName]} onChange={onChange(fieldName)} required>
                    <option value="">Select {document.label}</option>
                    {(docOptions[document.type] || []).map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.originalName}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>

          <button
            className="btn"
            type="submit"
            disabled={loading || missingUploads.length > 0 || pendingSelections.length > 0 || isAgeMissing}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {result && (
          <div className="result-box">
            <p><strong>Application ID:</strong> {result.id}</p>
            <p><strong>Decision:</strong> {result.decisionStatus}</p>
            <p><strong>Documents:</strong> {result.documentsStatus}</p>
            <p><strong>Income Check:</strong> {result.incomeCheckStatus}</p>
            <p><strong>Reason:</strong> {result.decisionReason}</p>
          </div>
        )}
      </div>

      <div className="grid two">
        {applications.map((application) => (
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
            <p className="muted" style={{ marginTop: "10px" }}>{application.decisionReason}</p>
          </div>
        ))}
        {applications.length === 0 && (
          <div className="card">
            <p className="muted"><FiCheckCircle /> No applications submitted yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
