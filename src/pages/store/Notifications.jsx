import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, ShoppingBag, CheckCircle2, CreditCard, Bike,
  PackageCheck, XCircle, Trash2, CheckCheck,
} from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";
import { normalizeStatus, toDate, fmtMoney } from "../../store/orderStatus";
import { PAYMENT_STATUS } from "../../payment/paymentUtils";
import { useStoreOrders } from "../../store/useStoreOrders";
import { useNotificationInbox } from "../../hooks/useNotificationInbox";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

const STORAGE_KEY = "lkfc_store_notifications";
const PAGE = 15; // lazy-render window: only this many cards mount at a time (grows on scroll)

// One notification per REAL order milestone (emitted only when the underlying
// field/timestamp exists — no fabricated history). id is stable per order+type so
// read/deleted state survives reloads. Covers all 8 required types.
const TYPES = {
  new_order:          { icon: ShoppingBag,  tone: "bg-primary-light text-primary" },
  accepted:           { icon: CheckCircle2, tone: "bg-blue-100 text-blue-600" },
  payment:            { icon: CreditCard,   tone: "bg-primary-light text-primary" },
  rider_assigned:     { icon: Bike,         tone: "bg-indigo-100 text-indigo-600" },
  delivered:          { icon: PackageCheck, tone: "bg-primary-light text-primary" },
  store_cancelled:    { icon: XCircle,      tone: "bg-red-100 text-red-600" },
  customer_cancelled: { icon: XCircle,      tone: "bg-red-100 text-red-600" },
  cancelled:          { icon: XCircle,      tone: "bg-red-100 text-red-600" },
  system:             { icon: Bell,         tone: "bg-gray-100 text-gray-500" },
};

// Filter chips (cancelled groups the store/customer/neutral cancels together).
const FILTERS = ["all", "new_order", "accepted", "payment", "rider_assigned", "delivered", "cancelled", "system"];
const matchesFilter = (type, f) =>
  f === "all" ? true
    : f === "cancelled" ? (type === "store_cancelled" || type === "customer_cancelled" || type === "cancelled")
    : type === f;

const ACCEPTED_STATES = ["accepted", "cooking", "ready_for_delivery", "picked_up", "delivering", "completed"];

function buildNotifications(order) {
  const out = [];
  const st = normalizeStatus(order.status);
  const created = toDate(order.createdAt);
  const add = (type, time) =>
    out.push({
      id: `${order.id}__${type}`,
      type,
      orderId: order.id,
      orderNo: order.orderNo || order.id,
      name: order.customerName || "",
      amount: order.grandTotal ?? order.subtotal ?? 0,
      time: time || created || 0,
    });

  add("new_order", created);
  if (order.acceptedAt || ACCEPTED_STATES.includes(st)) add("accepted", toDate(order.acceptedAt) || created);
  if (order.payment?.status === PAYMENT_STATUS.APPROVED) add("payment", toDate(order.payment?.paidAt) || toDate(order.paidAt) || created);
  if (order.riderId) add("rider_assigned", toDate(order.pickedUpAt) || toDate(order.acceptedAt) || created);
  if (order.deliveredAt || st === "completed") add("delivered", toDate(order.deliveredAt) || created);
  if (st === "cancelled") {
    const by = order.cancelledBy || order.canceledBy;
    const type = by === "store" || by === "shop" ? "store_cancelled" : by === "customer" ? "customer_cancelled" : "cancelled";
    add(type, toDate(order.cancelledAt) || created);
  }
  return out;
}

const CardSkeleton = () => (
  <Card className="p-4 flex gap-4 animate-pulse">
    <div className="w-11 h-11 rounded-2xl bg-gray-100 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-28 bg-gray-100 rounded" />
      <div className="h-3 w-48 bg-gray-100 rounded" />
      <div className="h-3 w-20 bg-gray-100 rounded" />
    </div>
  </Card>
);

function NotificationCard({ n, onOpen, onDelete }) {
  const { t, language } = usePreferences();
  const meta = TYPES[n.type] || TYPES.system;
  const Icon = meta.icon;
  const d = n.time instanceof Date ? n.time : toDate(n.time);
  const when = d
    ? d.toLocaleString(language === "th" ? "th-TH" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "-";
  const message = t(`snotif.msg.${n.type}`, { orderNo: n.orderNo, name: n.name || "-", amount: fmtMoney(n.amount) });

  return (
    <div onClick={() => onOpen(n)} className="cursor-pointer">
      <Card className={`p-4 flex gap-4 hover:shadow-premium transition-shadow ${n.read ? "" : "ring-2 ring-primary/10"}`}>
        <div className={`p-3 rounded-2xl shrink-0 h-fit ${n.read ? "bg-gray-50 text-gray-400" : meta.tone}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-gray-900 truncate">{t(`snotif.type.${n.type}`)}</h3>
            {!n.read && <Badge color="green">{t("snotif.new")}</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-1 break-words">{message}</p>
          <p className="text-xs text-gray-400 font-bold mt-2">{when}</p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
          aria-label={t("snotif.delete")}
          className="self-start min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <Trash2 size={16} />
        </button>
      </Card>
    </div>
  );
}

export function Notifications() {
  const { t } = usePreferences();
  const navigate = useNavigate();
  const { orders, loading } = useStoreOrders();

  const items = useMemo(() => orders.flatMap(buildNotifications), [orders]);
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } = useNotificationInbox(items, STORAGE_KEY);

  const [filter, setFilter] = useState("all");
  const [visible, setVisible] = useState(PAGE);
  const sentinelRef = useRef(null);

  const filtered = useMemo(
    () => notifications.filter((n) => matchesFilter(n.type, filter)),
    [notifications, filter]
  );
  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  // reset the lazy window whenever the filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(PAGE);
  }, [filter]);

  // infinite scroll: grow the render window as the sentinel comes into view
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisible((v) => v + PAGE);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore]);

  const handleOpen = (n) => {
    markRead(n.id);
    navigate("/store/orders");
  };

  return (
    <div className="p-4 md:p-5 lg:p-6 space-y-5 max-w-[820px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-black text-gray-900">{t("snotif.title")}</h1>
            {unreadCount > 0 && <Badge color="green">{t("snotif.unread", { n: unreadCount })}</Badge>}
          </div>
          <p className="text-sm text-gray-400 font-medium mt-0.5">{t("snotif.subtitle")}</p>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" className="!px-4 !py-2 !rounded-xl text-xs" onClick={markAllRead}>
              <CheckCheck size={16} /> {t("snotif.markAllRead")}
            </Button>
            <Button variant="outline" className="!px-4 !py-2 !rounded-xl text-xs" onClick={clearAll}>
              <Trash2 size={16} /> {t("snotif.clearAll")}
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-sm font-bold border whitespace-nowrap transition-all ${
              filter === f
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            {f === "all" ? t("snotif.filterAll") : t(`snotif.type.${f}`)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon="🔔" title={t("snotif.emptyTitle")} description={t("snotif.emptyDesc")} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title={t("snotif.noMatchTitle")} description={t("snotif.noMatchDesc")} />
      ) : (
        <div className="space-y-3">
          {shown.map((n) => (
            <NotificationCard key={n.id} n={n} onOpen={handleOpen} onDelete={remove} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="pt-1">
              {/* Explicit control (always works); the observer above auto-loads on scroll where supported */}
              <Button variant="outline" className="!w-full !rounded-xl !py-3" onClick={() => setVisible((v) => v + PAGE)}>
                {t("snotif.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
