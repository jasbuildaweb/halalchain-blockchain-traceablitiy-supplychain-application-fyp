import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard, Package, Users,
  FileCheck, LogOut, Leaf, ScanLine, Menu
} from "lucide-react";
import { Role } from "../../types";
import { useState } from "react";

const ROLE_NAV: Record<Role, { label: string; to: string; icon: typeof LayoutDashboard }[]> = {
  ADMIN: [
    { label: "Overview",     to: "/dashboard/admin",                  icon: LayoutDashboard },
    { label: "Users",        to: "/dashboard/admin?tab=users",        icon: Users },
    { label: "Certificates", to: "/dashboard/admin?tab=certificates", icon: FileCheck },
    { label: "Products",     to: "/dashboard/admin?tab=products",     icon: Package },
  ],
  SUPPLIER: [
    { label: "Dashboard", to: "/dashboard/supplier",     icon: Leaf },
  ],
  MANUFACTURER: [
    { label: "Dashboard", to: "/dashboard/manufacturer", icon: Package },
  ],
  LOGISTICS: [
    { label: "Dashboard", to: "/dashboard/logistics",    icon: LayoutDashboard },
  ],
  RETAILER: [
    { label: "Dashboard", to: "/dashboard/retailer",     icon: LayoutDashboard },
  ],
  CONSUMER: [
    { label: "Scan QR", to: "/scan", icon: ScanLine },
  ],
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN:        "bg-purple-600",
  SUPPLIER:     "bg-emerald-600",
  MANUFACTURER: "bg-blue-600",
  LOGISTICS:    "bg-orange-600",
  RETAILER:     "bg-teal-600",
  CONSUMER:     "bg-gray-600",
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = user ? (ROLE_NAV[user.role] ?? []) : [];
  const roleColor = user ? ROLE_COLORS[user.role] : "bg-gray-600";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const SidebarContent = () => {
    const loc = useLocation();

    const isNavActive = (to: string) => {
      if (to.includes("?")) {
        const [path, qs] = to.split("?");
        return loc.pathname === path && loc.search === `?${qs}`;
      }
      return loc.pathname === to && !loc.search.includes("tab=");
    };

    return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`${roleColor} px-6 py-5`}>
        <h1 className="text-white font-bold text-lg tracking-tight">HalalChain</h1>
        <p className="text-white/70 text-xs mt-0.5">{user?.role} Portal</p>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-full ${roleColor} flex items-center justify-center text-white font-semibold text-sm`}>
            {user?.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.company ?? user?.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}

        <NavLink
          to="/scan"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <ScanLine size={18} />
          Scan QR
        </NavLink>
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </div>
  );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-gray-200 bg-white flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar — mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex w-60 flex-col bg-white shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile only) */}
        <header className="flex md:hidden items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500">
            <Menu size={22} />
          </button>
          <h1 className="font-semibold text-gray-900">HalalChain</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
