import { useMemo, useState } from "react";
import { MapPin, User, Package, Calendar, WifiOff } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { useRiderOrders } from "./useRiderOrders";
import { formatDate } from "./riderFormat";
import { byNewest, normalizeStatus } from "../store/orderStatus";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Loading } from "../components/ui/Loading";

const PAGE_SIZE = 20;

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

const itemCount = (order) => (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);

// แถวประวัติ 1 ออเดอร์: แบบย่อ อ่านอย่างเดียว (งานที่ยังทำอยู่ไปจัดการที่หน้า Jobs)
const HistoryCard = ({ order, t }) => {
  const status = normalizeStatus(order.status);
  const s = styleFor(status);
  const count = itemCount(order);
  return (
    <Card className="p-0 overflow-hidden flex">
      {/* status accent rail — instant colour cue */}
      <div className={`w-1.5 shrink-0 ${s.accent}`} />
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-black text-gray-900 truncate leading-tight">{order.orderNo || order.id}</p>
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mt-1">
              <Calendar size={12} className="shrink-0" />
              {formatDate(order.createdAt)}
            </p>
          </div>
          <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${s.pill}`}>
            {t(`ro.status.${status}`)}
          </span>
        </div>

        <div className="space-y-1.5 mt-3 text-sm">
          <p className="flex items-center gap-2 text-gray-700 font-medium">
            <User size={14} className="text-gray-400 shrink-0" />
            <span className="truncate">{order.customerName || "-"}</span>
          </p>
          <p className="flex items-start gap-2 text-gray-500">
            <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {order.deliveryLocation?.address || order.deliveryAddress || order.address || "-"}
            </span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-50">
          <p className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
            <Package size={13} className="shrink-0" />
            {t("ro.items", { count })}
          </p>
          <p className="font-black text-primary text-base">฿{order.grandTotal ?? order.subtotal ?? 0}</p>
        </div>
      </div>
    </Card>
  );
};

// ประวัติงานส่งของไรเดอร์: ทุกออเดอร์ที่ riderId == uid เรียงใหม่->เก่า พร้อมฟิลเตอร์สถานะ
export default function RiderOrderHistory() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const { orders, loading, error } = useRiderOrders(user?.uid);
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sorted = useMemo(() => [...orders].sort(byNewest()), [orders]);

  const countFor = (key) =>
    key === "all"
      ? sorted.length
      : sorted.filter((o) => normalizeStatus(o.status) === key).length;

  const filtered =
    filter === "all" ? sorted : sorted.filter((o) => normalizeStatus(o.status) === filter);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const selectFilter = (key) => {
    setFilter(key);
    setVisibleCount(PAGE_SIZE);
  };

  if (loading) {
    return <Loading text={t("ro.loading.history")} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("ro.history.title")}</h1>

      {/* status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => selectFilter(key)}
            className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
              filter === key
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            {t(labelKey)} ({countFor(key)})
          </button>
        ))}
      </div>

      {/* feed พัง = ไม่มีข้อมูลให้เชื่อถือ ต้องบอกตรง ๆ แทนที่จะหมุน Loading ค้าง หรือโชว์
          "ยังไม่มีงาน" ทั้งที่จริง ๆ โหลดไม่ขึ้น (R-06 — ใช้แถบ error แบบเดียวกับ Dashboard) */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
          <WifiOff size={20} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-black text-sm">{t("ro.history.loadErrTitle")}</p>
            <p className="text-xs font-medium text-red-500 mt-0.5">{t("ro.history.loadErrDesc")}</p>
          </div>
        </div>
      )}

      {error ? null : filtered.length === 0 ? (
        <EmptyState
          icon="🛵"
          title={t("ro.history.emptyTitle")}
          description={filter === "all" ? t("ro.history.emptyDesc") : t("ro.history.emptyDescFiltered")}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((order) => (
              <HistoryCard key={order.id} order={order} t={t} />
            ))}
          </div>
          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              {t("ro.showMore", { count: filtered.length - visibleCount })}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
