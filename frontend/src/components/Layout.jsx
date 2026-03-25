import { Link, NavLink, useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "My Documents" },
  { to: "/eligibility", label: "Apply for Schemes" },
  { to: "/applications", label: "My Applications" },
  { to: "/alerts", label: "Security Alerts" },
  { to: "/admin/logs", label: "Admin Overview", adminOnly: true },
];

export default function Layout({ children }) {
  const { clearSession, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="top-nav-wrap">
          <div className="brand-wrap">
            <div className="brand-avatar">CS</div>
            <div className="brand-copy">
              <Link to="/dashboard" className="brand">CivicShield</Link>
              <span>{String(user?.email || "Citizen").split("@")[0]}</span>
            </div>
          </div>

          <nav className="top-nav-list">
            {navItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `top-nav-item ${isActive ? "active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>

          <div className="top-nav-actions">
            <button type="button" className="logout-btn" onClick={handleLogout}>
              <FiLogOut />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="content-wrap">{children}</div>
      </main>
    </div>
  );
}
