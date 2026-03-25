import { Link, NavLink, useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiFileText, FiHome, FiLogOut, FiLock, FiUploadCloud } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: <FiHome /> },
  { to: "/upload", label: "Upload", icon: <FiUploadCloud /> },
  { to: "/eligibility", label: "Eligibility", icon: <FiFileText /> },
  { to: "/alerts", label: "Alerts", icon: <FiAlertTriangle /> },
  { to: "/admin/logs", label: "Admin Logs", icon: <FiLock />, adminOnly: true },
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
      <aside className="sidebar">
        <Link to="/dashboard" className="brand">CivicShield</Link>
        <p className="muted small">Secure E-Governance Platform</p>

        <nav className="nav-list">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{user?.email}</strong>
            <span>{String(user?.role || "citizen").toUpperCase()}</span>
          </div>
          <button type="button" className="btn btn-outline" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
