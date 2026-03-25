import { Route, Routes, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import EligibilityPage from "./pages/EligibilityPage";
import MyApplicationsPage from "./pages/MyApplicationsPage";
import AlertsPage from "./pages/AlertsPage";
import AdminLogsPage from "./pages/AdminLogsPage";
import AdminApplicationsPage from "./pages/AdminApplicationsPage";

function ProtectedLayout({ children, adminOnly = false, citizenOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly} citizenOnly={citizenOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedLayout>
            <DashboardPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedLayout citizenOnly>
            <UploadPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/eligibility"
        element={
          <ProtectedLayout citizenOnly>
            <EligibilityPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/applications"
        element={
          <ProtectedLayout citizenOnly>
            <MyApplicationsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/alerts"
        element={
          <ProtectedLayout>
            <AlertsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/admin/applications"
        element={
          <ProtectedLayout adminOnly>
            <AdminApplicationsPage />
          </ProtectedLayout>
        }
      />
      <Route
        path="/admin/logs"
        element={
          <ProtectedLayout adminOnly>
            <AdminLogsPage />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
