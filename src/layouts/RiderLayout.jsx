import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home, Map as MapIcon, History, Wallet, Settings as SettingsIcon, LogOut,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../AuthContext.jsx";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { getAlarmAudioCtx } from "../store/alarmSounds";

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
  const { logout, profile } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const avatarChar = (profile?.name || profile?.riderName || "R").charAt(0).toUpperCase();

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore blocked/full localStorage
    }
  }, [collapsed]);

  // ปลุก AudioContext จาก user gesture แรก (เหมือน StoreLayout) — เบราว์เซอร์บล็อกเสียงจนกว่าจะมี
  // การแตะ/คลิก ถ้าไรเดอร์เปิดแอปมาแบบออนไลน์อยู่แล้ว เสียงเรียกงานใหม่ครั้งแรกจะเงียบถ้าไม่ปลุกไว้ก่อน
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = getAlarmAudioCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      } catch { /* ignore */ }
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
  }, []);

  // LINE MAN-style 5-menu bottom nav. Profile lives on the avatar (top-right), not the nav.
  const navItems = [
    { icon: Home, label: t("ro.nav.home"), path: "/rider" },
    { icon: MapIcon, label: t("ro.nav.jobMap"), path: "/rider/map" },
    { icon: History, label: t("ro.nav.history"), path: "/rider/history" },
    { icon: Wallet, label: t("ro.nav.finance"), path: "/rider/earnings" },
    { icon: SettingsIcon, label: t("ro.nav.settings"), path: "/rider/settings" },
  ];

  // Home is active on "/rider" and the job-detail sub-flow; others prefix-match.
  const isActive = (path) =>
    path === "/rider"
      ? pathname === "/rider" || pathname.startsWith("/rider/job")
      : pathname === path || pathname.startsWith(`${path}/`);

  // On the waiting/home screen the profile avatar is hidden (it overlaps the stats card) —
  // only the notification bell stays top-right. Other rider pages keep the avatar so the
  // profile page stays reachable (the avatar is its only entry point).
  const onHome = pathname === "/rider";

  return (
    <div
      className={`min-h-screen bg-gray-50 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0 transition-[padding] duration-200 ${
        collapsed ? "md:pl-20" : "md:pl-64"
      }`}
    >
      {/* Floating top-right: profile avatar (hidden on home) + notification bell. Offset by
          the top safe-area inset so the bell is never clipped under a notch/status bar. */}
      <div className="fixed right-3 z-[55] flex items-center gap-2 top-[calc(0.75rem+env(safe-area-inset-top))]">
        {!onHome && (
          <Link
            to="/rider/profile"
            aria-label={t("ro.nav.profile")}
            className="w-11 h-11 rounded-full bg-white shadow-soft border border-gray-50 flex items-center justify-center font-black text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {avatarChar}
          </Link>
        )}
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

      {/* On home the content reserves top space for the floating bell (bell height + top
          inset) so nothing tucks under it; other pages keep their normal top padding. */}
      <main
        className={`max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 ${
          onHome ? "pt-[calc(4rem+env(safe-area-inset-top))]" : "pt-4 sm:pt-6 md:pt-8"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
};
