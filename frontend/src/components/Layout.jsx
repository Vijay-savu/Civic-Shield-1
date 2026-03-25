import { Link, NavLink, useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

const citizenNavItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "My Documents" },
  { to: "/eligibility", label: "Apply for Schemes" },
  { to: "/applications", label: "My Applications" },
  { to: "/alerts", label: "Security Alerts" },
];

const adminNavItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/admin/applications", label: "Applications" },
  { to: "/admin/logs", label: "Admin Overview" },
  { to: "/alerts", label: "Security Alerts" },
];

export default function Layout({ children }) {
  const { clearSession, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const navItems = isAdmin ? adminNavItems : citizenNavItems;

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
            {navItems.map((item) => (
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
