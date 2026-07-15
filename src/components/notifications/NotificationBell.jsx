import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, X, Search, CheckCheck, Trash2, Volume2, VolumeX,
  ShoppingBag, CheckCircle2, ChefHat, Bike, Truck, PackageCheck, PackageX,
  CreditCard, Receipt, Clock, XCircle, PartyPopper, Newspaper, UserPlus,
  AlertTriangle, ShieldAlert, FileText, MapPin, Coins, MessageCircle,
} from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";
import { toDate } from "../../store/orderStatus";
import { useNotifications } from "../../hooks/useNotifications";
import { ensurePushPermission, pushNew } from "../../notifications/pushNotifications";
import { getAlarmAudioCtx, playSound } from "../../store/alarmSounds";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

const PAGE = 15;
const SOUND_KEY = "lkfc_notif_sound"; // reuse existing alarm system; on/off only

// type -> icon (fallback Bell). Kept here (JSX) — util stays logic-only.
const ICON = {
  new_order: ShoppingBag, store_accepted: CheckCircle2,
  cooking: ChefHat, cooked: ChefHat, food_ready: ChefHat,
  rider_assigned: Bike, rider_arrived: MapPin, rider_delivering: Truck,
  new_job: Bike, delivered: PackageCheck, rider_delivered: PackageCheck,
  additional_payment: CreditCard, amount_changed: Coins, partial_refund: Coins, diff_paid: CreditCard,
  slip_uploaded: Receipt, slip_reuploaded: Receipt, slip_approved: CheckCircle2, slip_rejected: XCircle,
  pay_remind_5m: Clock, pay_remind_1m: Clock, pay_expired: Clock,
  order_edited: FileText, customer_edited: FileText, address_changed: MapPin, report: FileText,
  order_cancelled: XCircle, customer_cancelled: XCircle, job_cancelled: XCircle, job_expired: Clock,
  promotion: PartyPopper, news: Newspaper,
  store_signup: UserPlus, rider_signup: UserPlus,
  payment_error: AlertTriangle, system_error: AlertTriangle, security_alert: ShieldAlert,
  low_stock: PackageX,
  new_message: MessageCircle,
};

const PRIORITY_TONE = {
  high: "bg-red-100 text-red-600",
  normal: "bg-primary-light text-primary",
  low: "bg-gray-100 text-gray-500",
};

const PRIORITY_BADGE = { high: "orange", normal: "green", low: "blue" };

const loadSound = () => {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
};

function NotificationCard({ n, t, language, onOpen, onDelete }) {
  const Icon = ICON[n.type] || Bell;
  const d = toDate(n.createdAt);
  const when = d
    ? d.toLocaleString(language === "th" ? "th-TH" : "en-GB",
        { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "-";
  return (
    <div
      onClick={() => onOpen(n)}
      className={`cursor-pointer p-4 flex gap-3 rounded-2xl border transition-colors ${
        n.read ? "border-gray-50 bg-white" : "border-primary/10 bg-primary-light/30"
      }`}
    >
      <div className={`p-2.5 rounded-2xl shrink-0 h-fit ${n.read ? "bg-gray-50 text-gray-400" : PRIORITY_TONE[n.priority] || PRIORITY_TONE.normal}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-gray-900 text-sm truncate">
            {n.title || t(`nc.type.${n.type}`)}
          </h3>
          {!n.read && <Badge color={PRIORITY_BADGE[n.priority] || "green"}>{t("nc.new")}</Badge>}
        </div>
        <p className="text-sm text-gray-500 mt-0.5 break-words">{n.message}</p>
        <p className="text-xs text-gray-400 font-bold mt-1.5">{when}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        aria-label={t("nc.delete")}
        className="self-start min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// Notification Center bell — mount once per role layout. Reuses the shared
// useNotifications() SSOT hook, the existing UI primitives, and the existing
// alarm sound system. No new Firestore listener beyond the shared hook.
export function NotificationBell({ className = "" }) {
  const { t, language } = usePreferences();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | high | normal | low
  const [visible, setVisible] = useState(PAGE);
  const [soundOn, setSoundOn] = useState(loadSound);
  const sentinelRef = useRef(null);

  // Ask once for OS push permission (Phase 6.0A); gated internally, safe to repeat.
  useEffect(() => { ensurePushPermission(); }, []);

  // On genuinely-new notifications (after first load): existing alarm + native push.
  const handleNew = (added) => {
    if (!added.length) return;
    if (loadSound()) {
      try { playSound("lineman", getAlarmAudioCtx(), 0.6); } catch { /* autoplay blocked */ }
    }
    pushNew(added); // native OS/browser push — FeatureFlags-gated inside
  };
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } =
    useNotifications({ onNew: handleNew });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notifications.filter((n) => {
      if (filter !== "all" && n.priority !== filter) return false;
      if (!needle) return true;
      return `${n.title || ""} ${n.message || ""} ${n.type}`.toLowerCase().includes(needle);
    });
  }, [notifications, q, filter]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(PAGE);
  }, [q, filter, open]);

  useEffect(() => {
    if (!open || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es[0]?.isIntersecting) setVisible((v) => v + PAGE);
    }, { rootMargin: "160px" });
    io.observe(el);
    return () => io.disconnect();
  }, [open, hasMore]);

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      try { localStorage.setItem(SOUND_KEY, next ? "on" : "off"); } catch { /* ignore */ }
      return next;
    });
  };

  const openItem = (n) => {
    if (!n.read) markRead(n.id);
    if (n.actionUrl) { setOpen(false); navigate(n.actionUrl); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nc.title")}
        className={`relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-2xl text-gray-500 hover:bg-gray-100 transition-colors ${className}`}
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md h-full bg-gray-50 shadow-2xl flex flex-col animate-in slide-in-from-right">
            {/* header */}
            <div className="p-4 bg-white border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-gray-900">{t("nc.title")}</h2>
                  {unreadCount > 0 && <Badge color="orange">{unreadCount}</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={toggleSound} aria-label={t("nc.sound")}
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100">
                    {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} aria-label={t("nc.close")}
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("nc.search")}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {/* filter + bulk actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {["all", "high", "normal", "low"].map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      filter === f ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-500 border-gray-100 hover:border-primary"
                    }`}>
                    {t(`nc.filter.${f}`)}
                  </button>
                ))}
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={markAllRead} aria-label={t("nc.markAllRead")}
                    disabled={unreadCount === 0}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                    <CheckCheck size={17} />
                  </button>
                  <button type="button" onClick={clearAll} aria-label={t("nc.clearAll")}
                    disabled={notifications.length === 0}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-30">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {notifications.length === 0 ? (
                <EmptyState icon="🔔" title={t("nc.emptyTitle")} description={t("nc.emptyDesc")} />
              ) : filtered.length === 0 ? (
                <EmptyState icon="🔍" title={t("nc.noMatchTitle")} description={t("nc.noMatchDesc")} />
              ) : (
                <>
                  {shown.map((n) => (
                    <NotificationCard key={n.id} n={n} t={t} language={language}
                      onOpen={openItem} onDelete={remove} />
                  ))}
                  {hasMore && (
                    <div ref={sentinelRef} className="pt-1">
                      <Button variant="outline" className="!w-full !rounded-xl !py-2.5 text-sm"
                        onClick={() => setVisible((v) => v + PAGE)}>
                        {t("nc.loadMore")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
