import { Outlet, Link, useLocation } from "react-router-dom";
import { Package, History, Wallet, User, Settings as SettingsIcon, LogOut } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../AuthContext.jsx";
import { NotificationBell } from "../components/notifications/NotificationBell";

// Shared Rider shell — sidebar on tablet/desktop, bottom navigation on mobile.
// Same responsive pattern as CustomerLayout (single source for nav), so rider pages
// no longer each carry a wrapping row of nav buttons (the old cause of horizontal
// scroll / clipped buttons on small screens).
export const RiderLayout = () => {
  const { pathname } = useLocation();
  const { t } = usePreferences();
  const { logout } = useAuth();

  const navItems = [
    { icon: Package, label: t("ro.nav.jobs"), path: "/rider" },
    { icon: History, label: t("ro.nav.history"), path: "/rider/history" },
    { icon: Wallet, label: t("ro.nav.earnings"), path: "/rider/earnings" },
    { icon: User, label: t("ro.nav.profile"), path: "/rider/profile" },
    { icon: SettingsIcon, label: t("ro.nav.settings"), path: "/rider/settings" },
  ];

  // Exact match for "/rider", prefix match for the sub-routes.
  const isActive = (path) =>
    path === "/rider" ? pathname === "/rider" : pathname === path || pathname.startsWith(`${path}/`);

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0 md:pl-64">
      {/* Notification Center bell — floating, all breakpoints (same as CustomerLayout) */}
      <div className="fixed top-3 right-3 z-[55]">
        <NotificationBell className="bg-white shadow-soft border border-gray-50" />
      </div>

      {/* Desktop / tablet sidebar */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 p-6">
        <h1 className="text-2xl font-black text-primary mb-12">{t("ro.brand")}</h1>
        <div className="space-y-2 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                isActive(item.path)
                  ? "bg-primary-light text-primary font-bold"
                  : "text-gray-400 hover:bg-gray-50"
              }`}
            >
              <item.icon size={22} /> {item.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-4 p-4 rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-secondary transition-all"
        >
          <LogOut size={22} /> {t("ro.logout")}
        </button>
      </nav>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-1 py-1 flex items-stretch z-50 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 min-w-0"
            >
              <span
                className={`flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-200 ${
                  active ? "text-primary bg-primary-light" : "text-gray-300"
                }`}
              >
                <item.icon size={20} className={`transition-transform duration-200 ${active ? "scale-110" : ""}`} />
              </span>
              <span className={`text-[10px] font-bold leading-none truncate max-w-full ${active ? "text-primary" : "text-gray-400"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};
