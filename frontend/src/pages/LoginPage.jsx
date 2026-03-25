import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiLock, FiMail, FiShield } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, loginWithPassword } from "../services/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const [form, setForm] = useState({ email: "vijay@gmail.com", password: "123456" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await loginWithPassword(form);
      setSession(response.data);
      navigate("/dashboard");
    } catch (err) {
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
          <div className="status-pill">
            <FiCheckCircle />
            <span>Verified Access</span>
          </div>
        </div>

        <div className="card login-panel otp-like-panel">
          <h2 className="panel-title">
            <span className="panel-icon">
              <FiLock />
            </span>
            Secure Login
          </h2>

          <form onSubmit={submitLogin} className="form-grid">
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
                  required
                />
              </div>
            </label>

            <button className="btn login-btn" type="submit" disabled={loading}>
              {loading ? "Checking..." : "Login"}
            </button>
          </form>

          {error && <p className="error-text">{error}</p>}
        </div>

        <p className="muted auth-footer-note">
          <FiShield /> Protected by Security Layer
        </p>
      </div>
    </div>
  );
}
