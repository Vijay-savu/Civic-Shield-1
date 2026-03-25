import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLock, FiMail, FiShield } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, loginWithPassword } from "../services/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockSeconds, setLockSeconds] = useState(0);

  useEffect(() => {
    if (lockSeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLockSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [lockSeconds]);

  const formatRemainingTime = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    if (lockSeconds > 0) {
      setError(`Login is temporarily blocked. Try again in ${formatRemainingTime(lockSeconds)}.`);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await loginWithPassword(form);
      setSession(response.data);
      setLockSeconds(0);
      navigate("/dashboard");
    } catch (err) {
      const retryAfterSeconds = Number(err?.response?.data?.retryAfterSeconds || 0);
      if (retryAfterSeconds > 0) {
        setLockSeconds(retryAfterSeconds);
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-reference-bg">
      <div className="auth-wrapper">
        <div className="auth-hero compact-hero">
          <h1>CivicShield</h1>
          <p className="muted auth-subtitle">Secure E-Governance Platform</p>
        </div>

        <div className="card login-panel otp-like-panel">
          <h2 className="panel-title">
            <span className="panel-icon">
              <FiLock />
            </span>
            Secure Login
          </h2>

          <form onSubmit={submitLogin} className="form-grid" autoComplete="off">
            <label>
              Email Address
              <div className="input-icon-field">
                <FiMail />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  placeholder="your.email@gov.in"
                  autoComplete="off"
                  required
                />
              </div>
            </label>

            <label>
              Password
              <div className="input-icon-field">
                <FiLock />
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Enter password"
                  autoComplete="off"
                  required
                />
              </div>
            </label>

            <button className="btn login-btn" type="submit" disabled={loading || lockSeconds > 0}>
              {loading
                ? "Checking..."
                : lockSeconds > 0
                  ? `Locked (${formatRemainingTime(lockSeconds)})`
                  : "Login"}
            </button>
          </form>

          {lockSeconds > 0 && (
            <p className="error-text">Account locked. Try again in {formatRemainingTime(lockSeconds)}.</p>
          )}
          {error && <p className="error-text">{error}</p>}
        </div>

        <p className="muted auth-footer-note">
          <FiShield /> Protected by Security Layer
        </p>
      </div>
    </div>
  );
}
