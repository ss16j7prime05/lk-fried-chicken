import { useMemo, useState } from "react";
import { Store, User, Package, Calendar, Navigation, CreditCard, WifiOff } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { PROMPTPAY_ACCOUNT_NAME } from "../config";
import { useRiderOrderHistory, HISTORY_PAGE_SIZE } from "./useRiderOrderHistory";
import { formatDate } from "./riderFormat";
import { orderNet, fmtTHB0 } from "./riderIncome";
import { byNewest, normalizeStatus } from "../store/orderStatus";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { RiderCardGridSkeleton } from "../components/ui/Skeleton";

// Single-store app — the "restaurant" on every delivery is the store itself.
const STORE_NAME = PROMPTPAY_ACCOUNT_NAME;

const FILTERS = [
  { key: "all", labelKey: "ro.filter.all" },
  { key: "completed", labelKey: "ro.filter.completed" },
  { key: "cancelled", labelKey: "ro.filter.cancelled" },
];

// Consistent status styling across the whole history list — one accent + pill per
// normalized status (green = done, red = cancelled, blue = in-progress, amber = early).
const STATUS_STYLE = {
  completed: { accent: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-600" },
  cancelled: { accent: "bg-rose-500", pill: "bg-rose-50 text-rose-600" },
  delivering: { accent: "bg-blue-500", pill: "bg-blue-50 text-blue-600" },
  picked_up: { accent: "bg-blue-500", pill: "bg-blue-50 text-blue-600" },
  ready_for_delivery: { accent: "bg-sky-500", pill: "bg-sky-50 text-sky-600" },
  cooking: { accent: "bg-amber-500", pill: "bg-amber-50 text-amber-600" },
  accepted: { accent: "bg-amber-500", pill: "bg-amber-50 text-amber-600" },
  pending: { accent: "bg-gray-400", pill: "bg-gray-100 text-gray-500" },
};
const styleFor = (status) => STATUS_STYLE[status] || STATUS_STYLE.pending;

// Payment-method pill colour — matches the Store/checkout method colours (cash green,
// promptpay blue, transfer orange).
const PAYMENT_PILL = {
  cash: "bg-emerald-50 text-emerald-600",
  promptpay: "bg-blue-50 text-blue-600",
  transfer: "bg-orange-50 text-orange-600",
};

const itemCount = (order) => (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);
const orderIncome = orderNet; // SSOT: fee + bonus − tax − adjustment (matches every income page)
const orderDistanceKm = (order) => {
  const km = order.distanceKm ?? order.distance ?? order.deliveryDistance;
  return typeof km === "number" && Number.isFinite(km) ? km : null;
};
const fmtMoney = fmtTHB0;

// One history row. Hierarchy per spec: income is the hero, status second, restaurant
// third, then customer / distance / payment / date — all aligned to a single grid.
const HistoryCard = ({ order, t }) => {
  const status = normalizeStatus(order.status);
  const s = styleFor(status);
  const km = orderDistanceKm(order);
  const method = order.paymentMethod;

  return (
    <Card className="p-0 flex">
      {/* status accent rail — instant colour cue */}
      <div className={`w-1.5 shrink-0 ${s.accent}`} aria-hidden="true" />
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        {/* order id + date  ·  status (second most important) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-400 truncate">{order.orderNo || order.id}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 mt-0.5">
              <Calendar size={11} className="shrink-0" />
              {formatDate(order.createdAt)}
            </p>
          </div>
          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${s.pill}`}>
            {t(`ro.status.${status}`)}
          </span>
        </div>

        {/* income — the hero number */}
        <div className="flex items-end justify-between gap-3 mt-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t("ro.earningsCol")}</p>
            <p className="text-2xl font-black text-primary leading-tight">{fmtMoney(orderIncome(order))}</p>
          </div>
          {km != null && (
            <p className="flex items-center gap-1 text-xs font-bold text-gray-500 shrink-0 pb-1">
              <Navigation size={13} className="text-gray-400 shrink-0" />
              {km.toFixed(1)} km
            </p>
          )}
        </div>

        {/* restaurant (third) + customer */}
        <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-50 text-sm">
          <p className="flex items-center gap-2 text-gray-700 font-bold">
            <Store size={14} className="text-gray-400 shrink-0" />
            <span className="truncate">{STORE_NAME}</span>
          </p>
          <p className="flex items-center gap-2 text-gray-500 font-medium">
            <User size={14} className="text-gray-400 shrink-0" />
            <span className="truncate">{order.customerName || "-"}</span>
          </p>
        </div>

        {/* payment + item count */}
        <div className="flex items-center justify-between gap-3 mt-3">
          {method ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${PAYMENT_PILL[method] || "bg-gray-100 text-gray-500"}`}>
              <CreditCard size={12} className="shrink-0" />
              {t(`payment.${method}`)}
            </span>
          ) : <span />}
          <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
            <Package size={13} className="shrink-0" />
            {t("ro.items", { count: itemCount(order) })}
          </p>
        </div>
      </div>
    </Card>
  );
};

// ประวัติงานส่งของไรเดอร์: ทุกออเดอร์ที่ riderId == uid เรียงใหม่->เก่า พร้อมฟิลเตอร์สถานะ
// อ่านแบบแบ่งหน้า (server pagination) — โหลดทีละหน้า ไม่ดึงทั้ง collection (useRiderOrderHistory)
export default function RiderOrderHistory() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const { orders, loading, loadingMore, error, hasMore, loadMore } = useRiderOrderHistory(user?.uid);
  const [filter, setFilter] = useState("all");

  // Orders arrive newest-first from the query; re-sort defensively so the display order is
  // stable even across appended pages. Counts/filters run over the pages loaded so far.
  const sorted = useMemo(() => [...orders].sort(byNewest()), [orders]);

  const countFor = (key) =>
    key === "all"
      ? sorted.length
      : sorted.filter((o) => normalizeStatus(o.status) === key).length;

  const filtered =
    filter === "all" ? sorted : sorted.filter((o) => normalizeStatus(o.status) === filter);

  const selectFilter = (key) => setFilter(key);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("ro.history.title")}</h1>

      {/* status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => selectFilter(key)}
            className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              filter === key
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            {t(labelKey)} ({countFor(key)})
          </button>
        ))}
      </div>

      {/* feed พัง = ไม่มีข้อมูลให้เชื่อถือ ต้องบอกตรง ๆ แทนที่จะหมุน Loading ค้าง (R-06) */}
      {error && (
        <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
          <WifiOff size={20} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-black text-sm">{t("ro.history.loadErrTitle")}</p>
            <p className="text-xs font-medium text-red-500 mt-0.5">{t("ro.history.loadErrDesc")}</p>
          </div>
        </div>
      )}

      {loading ? (
        <RiderCardGridSkeleton />
      ) : error ? null : (
        <>
          {/* Counts + filters run over the pages loaded so far; "Load More" stays available
              whenever the server has another page, so a filter with no match yet can still
              pull older pages instead of dead-ending on the empty state. */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="🛵"
              title={t("ro.history.emptyTitle")}
              description={filter === "all" ? t("ro.history.emptyDesc") : t("ro.history.emptyDescFiltered")}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((order) => (
                <HistoryCard key={order.id} order={order} t={t} />
              ))}
            </div>
          )}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              loading={loadingMore}
              onClick={loadMore}
            >
              {t("ro.showMore", { count: HISTORY_PAGE_SIZE })}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
