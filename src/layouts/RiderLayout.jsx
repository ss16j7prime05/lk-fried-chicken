import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Package, History, Wallet, User, Settings as SettingsIcon, LogOut,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../AuthContext.jsx";
import { NotificationBell } from "../components/notifications/NotificationBell";

// Device-local UI preference (not Firestore) — remembers the collapsed sidebar choice.
const SIDEBAR_KEY = "lkfc_rider_sidebar_collapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
};

// Shared Rider shell — collapsible sidebar on tablet/desktop, bottom navigation on mobile.
// Single source for rider navigation (same responsive pattern as CustomerLayout), so rider
// pages carry no nav of their own. The sidebar collapses to an icon rail on tablet/desktop
// (persisted per-device); the content padding follows so nothing overlaps or clips.
export const RiderLayout = () => {
  const { pathname } = useLocation();
  const { t } = usePreferences();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore blocked/full localStorage
    }
  }, [collapsed]);

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
    <div
      className={`min-h-screen bg-gray-50 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0 transition-[padding] duration-200 ${
        collapsed ? "md:pl-20" : "md:pl-64"
      }`}
    >
      {/* Notification Center bell — floating, all breakpoints */}
      <div className="fixed top-3 right-3 z-[55]">
        <NotificationBell className="bg-white shadow-soft border border-gray-50" />
      </div>

      {/* Desktop / tablet sidebar (sticky full-height). Collapses to an icon rail. */}
      <nav
        aria-label="Rider"
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-white border-r border-gray-100 transition-[width] duration-200 ${
          collapsed ? "w-20 px-2 py-6 items-center" : "w-64 p-6"
        }`}
      >
        <div className={`flex items-center mb-10 w-full ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && <h1 className="text-2xl font-black text-primary truncate">{t("ro.brand")}</h1>}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? t("ro.expandSidebar") : t("ro.collapseSidebar")}
            className="flex items-center justify-center w-11 h-11 rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {collapsed ? <PanelLeftOpen size={22} /> : <PanelLeftClose size={22} />}
          </button>
        </div>

        <div className={`flex-1 w-full space-y-2 ${collapsed ? "flex flex-col items-center" : ""}`}>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex items-center rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  collapsed ? "justify-center w-12 h-12" : "gap-4 p-4 w-full"
                } ${active ? "bg-primary-light text-primary font-bold" : "text-gray-400 hover:bg-gray-50"}`}
              >
                <item.icon size={22} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={logout}
          title={collapsed ? t("ro.logout") : undefined}
          aria-label={t("ro.logout")}
          className={`flex items-center rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-secondary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 ${
            collapsed ? "justify-center w-12 h-12" : "gap-4 p-4 w-full"
          }`}
        >
          <LogOut size={22} className="shrink-0" />
          {!collapsed && <span>{t("ro.logout")}</span>}
        </button>
      </nav>

      {/* Mobile bottom navigation — 48px+ targets, safe-area aware */}
      <nav
        aria-label="Rider"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-1 flex items-stretch z-50 pb-[env(safe-area-inset-bottom)]"
      >
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
            >
              <span
                className={`flex items-center justify-center w-10 h-7 rounded-lg transition-all duration-200 ${
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
