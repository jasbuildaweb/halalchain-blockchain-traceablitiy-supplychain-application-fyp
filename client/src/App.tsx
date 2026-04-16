import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Public pages
import LandingPage   from "./pages/LandingPage";
import LoginPage     from "./pages/LoginPage";
import RegisterPage  from "./pages/RegisterPage";
import ScanPage      from "./pages/ScanPage";
import VerifyPage    from "./pages/VerifyPage";

// Dashboard layout + role pages
import DashboardLayout       from "./components/layout/DashboardLayout";
import AdminDashboard        from "./pages/dashboard/AdminDashboard";
import SupplierDashboard     from "./pages/dashboard/SupplierDashboard";
import ManufacturerDashboard from "./pages/dashboard/ManufacturerDashboard";
import LogisticsDashboard    from "./pages/dashboard/LogisticsDashboard";
import RetailerDashboard     from "./pages/dashboard/RetailerDashboard";

import { Role } from "./types";

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><span className="text-gray-500">Loading…</span></div>;
  if (!user)     return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function DashboardRedirect() {
  const { user } = useAuth();
  const roleRoutes: Record<Role, string> = {
    ADMIN:        "/dashboard/admin",
    SUPPLIER:     "/dashboard/supplier",
    MANUFACTURER: "/dashboard/manufacturer",
    LOGISTICS:    "/dashboard/logistics",
    RETAILER:     "/dashboard/retailer",
    CONSUMER:     "/scan",
  };
  return <Navigate to={user ? (roleRoutes[user.role] ?? "/scan") : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/"              element={<LandingPage />} />
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/register"      element={<RegisterPage />} />
        <Route path="/scan"          element={<ScanPage />} />
        <Route path="/verify/:productId" element={<VerifyPage />} />

        {/* Dashboard — role-gated */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardRedirect />} />
          <Route path="admin"        element={<ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="supplier"     element={<ProtectedRoute roles={["SUPPLIER"]}><SupplierDashboard /></ProtectedRoute>} />
          <Route path="manufacturer" element={<ProtectedRoute roles={["MANUFACTURER"]}><ManufacturerDashboard /></ProtectedRoute>} />
          <Route path="logistics"    element={<ProtectedRoute roles={["LOGISTICS"]}><LogisticsDashboard /></ProtectedRoute>} />
          <Route path="retailer"     element={<ProtectedRoute roles={["RETAILER"]}><RetailerDashboard /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
