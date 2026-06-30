import { useState, useEffect, useRef, useCallback } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  LayoutDashboard, ClipboardList, UtensilsCrossed, Settings, Bell,
  LogOut, Menu, X, Store, ChevronRight, ChefHat, Phone, MapPin, Users, ShoppingBag,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { STORE_ID } from "../config";
import { normalizeStatus } from "../store/orderStatus";
import { getAlarmAudioCtx, playSound, getEffectiveVolume } from "../store/alarmSounds";

/* ─── constants ─── */
const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/store/v2/dashboard" },
  { icon: ClipboardList,   label: "Orders",    path: "/store/v2/orders"   },
  { icon: ChefHat,         label: "Kitchen",   path: "/store/v2/kitchen"  },
  { icon: UtensilsCrossed, label: "Menu",      path: "/store/v2/menu"     },
  { icon: Settings,        label: "Settings",  path: "/store/v2/settings" },
];

const DEFAULT_NOTIF = {
  enabled: true,
  volume: 80,
  sound: "classic",
  nightMode: { enabled: false, startTime: "22:00", endTime: "07:00", volume: 30 },
};

/* ─── helpers ─── */
const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
const fmtMoney = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
const optionLabel = (v) => { if (!v) return ""; if (typeof v === "object") return v.name || ""; return v; };

/* ─── LiveClock ─── */
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div className="flex flex-col items-end">
      <span className="text-sm font-black text-gray-800 tabular-nums tracking-tight">
        {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span className="text-[10px] font-medium text-gray-400 hidden sm:block">
        {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
      </span>
    </div>
  );
}

/* ─── NewOrderPopup ─── */
function NewOrderPopup({ order, onAccept, onReject, queueLength }) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const itemCount = (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);

  const handleAccept = async () => { setAccepting(true); try { await onAccept(order.id); } finally { setAccepting(false); } };
  const handleReject = async () => { setRejecting(true); try { await onReject(order.id); } finally { setRejecting(false); } };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-[fadeInUp_0.2s_ease]">
        {/* Alert banner */}
        <div className="bg-red-500 px-5 py-3.5 flex items-center gap-3">
          <div className="relative flex h-3 w-3 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </div>
          <p className="text-white font-black flex-1">NEW ORDER RECEIVED</p>
          {queueLength > 1 && (
            <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              +{queueLength - 1} more
            </span>
          )}
        </div>

        {/* Order header */}
        <div className="px-5 pt-5 pb-2 flex items-start justify-between">
          <div>
            <p className="text-xl font-black text-gray-900">{order.orderNo || order.id?.slice(0, 12)}</p>
            <p className="text-sm text-gray-400 font-medium mt-0.5">{fmtTime(order.createdAt)}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${order.paymentMethod === "promptpay" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {order.paymentMethod === "promptpay" ? "PromptPay" : "Cash"}
          </span>
        </div>

        {/* Customer */}
        <div className="px-5 py-3 space-y-2 border-t border-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Users size={15} className="text-gray-400 flex-shrink-0" />
            <span className="font-bold">{order.customerName || "—"}</span>
          </div>
          {order.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Phone size={15} className="text-gray-400 flex-shrink-0" />
              <span>{order.phone}</span>
            </div>
          )}
          {(order.deliveryAddress || order.address) && (
            <div className="flex items-start gap-2 text-sm text-gray-500">
              <MapPin size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{order.deliveryAddress || order.address}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="px-5 py-3 border-t border-gray-50 space-y-2 max-h-48 overflow-y-auto">
          {(order.items || []).map((item, i) => {
            const opts = [optionLabel(item.top_chicken), optionLabel(item.spicy), optionLabel(item.sauce), optionLabel(item.powder)].filter(Boolean).join(" · ");
            return (
              <div key={i} className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.qty || 1}× {item.name}</p>
                  {opts && <p className="text-xs text-gray-400 truncate">{opts}</p>}
                  {item.note && <p className="text-xs text-primary truncate">Note: {item.note}</p>}
                </div>
                <p className="text-sm font-bold text-gray-700 whitespace-nowrap">฿{fmtMoney((item.price || 0) * (item.qty || 1))}</p>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            <ShoppingBag size={13} />
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </div>
          <p className="text-2xl font-black text-gray-900">฿{fmtMoney(order.grandTotal ?? order.subtotal)}</p>
        </div>

        {/* Actions */}
        <div className="px-5 py-5 flex gap-3 border-t border-gray-100">
          <button
            onClick={handleReject}
            disabled={rejecting || accepting}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-200 font-black text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {rejecting ? "Rejecting…" : "✕ Reject"}
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting || rejecting}
            className="flex-[2] py-4 rounded-2xl bg-primary text-white font-black hover:bg-primary-dark transition-colors disabled:opacity-50 text-lg"
          >
            {accepting ? "Accepting…" : "✓ Accept Order"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
}

/* ─── StoreLayout ─── */
export function StoreLayout() {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOpen, setIsOpen]           = useState(true);
  const [storeName, setStoreName]     = useState("LK Fried Chicken");
  const [notifSettings, setNotifSettings] = useState(DEFAULT_NOTIF);
  const [pendingOrders, setPendingOrders] = useState([]);

  /* alarm refs — survive renders */
  const alarmIntervalRef  = useRef(null);
  const isAlarmingRef     = useRef(false);
  const notifSettingsRef  = useRef(notifSettings);   // always current settings for interval cb
  const ordersInitRef     = useRef(false);
  const notifiedIdsRef    = useRef(new Set());

  /* keep settings ref in sync */
  useEffect(() => { notifSettingsRef.current = notifSettings; }, [notifSettings]);

  /* ── browser notification permission ── */
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /* ── unlock AudioContext on first user gesture ── */
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = getAlarmAudioCtx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      } catch {}
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click",      unlock, { once: true });
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click",      unlock);
    };
  }, []);

  /* ── load store doc (name, open state, notification settings) ── */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.isOpen !== undefined) setIsOpen(d.isOpen);
      if (d.storeName)            setStoreName(d.storeName);
      if (d.notificationSettings) {
        setNotifSettings((prev) => ({ ...DEFAULT_NOTIF, ...d.notificationSettings,
          nightMode: { ...DEFAULT_NOTIF.nightMode, ...(d.notificationSettings.nightMode || {}) } }));
      }
    });
    return unsub;
  }, []);

  /* ── orders listener — pending orders drive alarm + popup ── */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "orders"), (snap) => {
      const all     = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const pending = all.filter((o) => normalizeStatus(o.status) === "pending");
      setPendingOrders(pending);

      if (!ordersInitRef.current) {
        /* first snapshot: mark existing pending orders as already notified (no notification for old orders) */
        pending.forEach((o) => notifiedIdsRef.current.add(o.id));
        ordersInitRef.current = true;
        return;
      }

      /* subsequent snapshots: send browser notification for brand-new pending orders */
      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const order = { id: change.doc.id, ...change.doc.data() };
        if (normalizeStatus(order.status) !== "pending") return;
        if (notifiedIdsRef.current.has(order.id)) return;
        notifiedIdsRef.current.add(order.id);
        sendBrowserNotification(order);
      });
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── alarm: start when pending orders exist, stop when none ── */
  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
    isAlarmingRef.current = false;
  }, []);

  const startAlarm = useCallback(() => {
    if (isAlarmingRef.current) return;
    isAlarmingRef.current = true;

    const tick = () => {
      const s = notifSettingsRef.current;
      if (!s.enabled) { stopAlarm(); return; }
      try {
        const ctx = getAlarmAudioCtx();
        if (ctx.state === "suspended") { ctx.resume().catch(() => {}); return; }
        playSound(s.sound || "classic", ctx, getEffectiveVolume(s));
      } catch {}
    };

    tick(); // play immediately on first trigger
    alarmIntervalRef.current = setInterval(tick, 2000);
  }, [stopAlarm]);

  useEffect(() => {
    if (pendingOrders.length > 0 && notifSettings.enabled) startAlarm();
    else stopAlarm();
  }, [pendingOrders.length, notifSettings.enabled, startAlarm, stopAlarm]);

  /* cleanup on unmount */
  useEffect(() => () => stopAlarm(), [stopAlarm]);

  /* ── browser notification ── */
  const sendBrowserNotification = (order) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const notif = new Notification("🔔 New Order!", {
        body:              `${order.customerName || "Customer"} · ฿${fmtMoney(order.grandTotal ?? order.subtotal)}`,
        tag:               "lk-new-order",
        requireInteraction: true,
      });
      notif.onclick = () => window.focus();
    } catch {}
  };

  /* ── store toggle ── */
  const toggleStore = async () => {
    const next = !isOpen;
    setIsOpen(next);
    try { await updateDoc(doc(db, "stores", STORE_ID), { isOpen: next }); }
    catch { setIsOpen(!next); }
  };

  /* ── popup actions ── */
  const popupAccept = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: "accepted" });
  };
  const popupReject = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: "cancelled" });
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const currentPopup = pendingOrders[0] || null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 flex flex-col w-64 bg-white border-r border-gray-100 shadow-sm transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-900 truncate">{storeName}</p>
            <p className="text-xs text-gray-400 font-medium">Store Portal</p>
          </div>
          <button className="md:hidden text-gray-400 hover:text-gray-700 p-1" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Store open/close */}
        <div className="mx-4 my-3 p-4 rounded-2xl bg-gray-50 border border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Store Status</p>
              <p className={`text-sm font-black mt-0.5 ${isOpen ? "text-primary" : "text-gray-400"}`}>
                {isOpen ? "Open for orders" : "Closed"}
              </p>
            </div>
            <button
              onClick={toggleStore}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${isOpen ? "bg-primary" : "bg-gray-300"}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isOpen ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ icon: Icon, label, path }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-colors group
                ${isActive ? "bg-primary-light text-primary" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} className={isActive ? "text-primary flex-shrink-0" : "text-gray-400 group-hover:text-gray-600 flex-shrink-0"} />
                  <span className="flex-1 text-sm">{label}</span>
                  {label === "Orders" && pendingOrders.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {pendingOrders.length > 9 ? "9+" : pendingOrders.length}
                    </span>
                  )}
                  {isActive && pendingOrders.length === 0 && <ChevronRight size={15} className="text-primary" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-400 font-medium mb-3 truncate">
            {profile?.name || profile?.email || "Store Manager"}
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3">
          <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <LiveClock />

          {/* Flashing "NEW ORDER" alert when pending */}
          {pendingOrders.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-black text-red-600 uppercase tracking-wide hidden sm:block">
                {pendingOrders.length} New Order{pendingOrders.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs font-black text-red-600 sm:hidden">{pendingOrders.length}</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Status pill */}
          <button
            onClick={toggleStore}
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full transition-colors
              ${isOpen ? "bg-primary-light text-primary hover:bg-primary/20" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-primary animate-pulse" : "bg-gray-400"}`} />
            {isOpen ? "Open" : "Closed"}
          </button>

          {/* Notification bell */}
          <button
            onClick={() => navigate("/store/v2/orders")}
            className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Pending orders"
          >
            <Bell size={20} className={pendingOrders.length > 0 ? "text-red-500" : ""} />
            {pendingOrders.length > 0 && (
              <>
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {pendingOrders.length > 9 ? "9+" : pendingOrders.length}
                </span>
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-400 rounded-full animate-ping opacity-75" />
              </>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* New Order Popup — rendered at layout level so it persists across page navigation */}
      {currentPopup && (
        <NewOrderPopup
          order={currentPopup}
          onAccept={popupAccept}
          onReject={popupReject}
          queueLength={pendingOrders.length}
        />
      )}
    </div>
  );
}
