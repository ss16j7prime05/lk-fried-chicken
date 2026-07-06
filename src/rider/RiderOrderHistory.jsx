import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, LogOut, MapPin, Package, Settings, User, Wallet } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { useRiderOrders } from "./useRiderOrders";
import { byNewest, normalizeStatus, STATUS_LABEL } from "../store/orderStatus";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Loading } from "../components/ui/Loading";

const PAGE_SIZE = 20;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE_COLOR = { completed: "green", cancelled: "orange" };

const formatDate = (createdAt) => {
  if (!createdAt) return "-";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

const itemCount = (order) => (order.items || []).reduce((s, i) => s + (i.qty || 1), 0);

// แถวประวัติ 1 ออเดอร์: แบบย่อ อ่านอย่างเดียว (งานที่ยังทำอยู่ไปจัดการที่หน้า Jobs)
const HistoryCard = ({ order }) => {
  const status = normalizeStatus(order.status);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-gray-900 truncate">{order.orderNo || order.id}</p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
        </div>
        <Badge color={STATUS_BADGE_COLOR[status] ?? "blue"}>
          {STATUS_LABEL[status] || status}
        </Badge>
      </div>

      <div className="space-y-1 mt-3 text-sm">
        <p className="flex items-center gap-1.5 text-gray-700 font-medium">
          <User size={14} className="text-gray-400 shrink-0" />
          <span className="truncate">{order.customerName || "-"}</span>
        </p>
        <p className="flex items-start gap-1.5 text-gray-500">
          <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
          <span className="line-clamp-2">
            {order.deliveryLocation?.address || order.deliveryAddress || order.address || "-"}
          </span>
        </p>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        <p className="text-xs font-medium text-gray-400">
          {itemCount(order)} item{itemCount(order) === 1 ? "" : "s"}
        </p>
        <p className="font-black text-primary">฿{order.grandTotal ?? order.subtotal ?? 0}</p>
      </div>
    </Card>
  );
};

// ประวัติงานส่งของไรเดอร์: ทุกออเดอร์ที่ riderId == uid เรียงใหม่->เก่า พร้อมฟิลเตอร์สถานะ
export default function RiderOrderHistory() {
  const { user, logout } = useAuth();
  const { orders, loading } = useRiderOrders(user?.uid);
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
    return <Loading text="Loading order history..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        {/* header — same pattern as the other rider pages */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900">Order History</h1>
          <div className="flex gap-2">
            <Link to="/rider">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Package size={16} />
                Jobs
              </Button>
            </Link>
            <Link to="/rider/profile">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <User size={16} />
                Profile
              </Button>
            </Link>
            <Link to="/rider/earnings">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Wallet size={16} />
                Earnings
              </Button>
            </Link>
            <Link to="/rider/notifications">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Bell size={16} />
                Notifications
              </Button>
            </Link>
            <Link to="/rider/settings">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Settings size={16} />
                Settings
              </Button>
            </Link>
            <Button
              variant="outline"
              className="!px-4 !py-2 text-sm text-secondary border-secondary/30 hover:border-secondary"
              onClick={logout}
            >
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>

        {/* status filter tabs — same style as the dashboard tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => selectFilter(key)}
              className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
                filter === key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-500 border-gray-100 hover:border-primary"
              }`}
            >
              {label} ({countFor(key)})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="🛵"
            title="No orders yet"
            description={
              filter === "all"
                ? "Deliveries you take will show up here."
                : `No ${filter} deliveries yet.`
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((order) => (
                <HistoryCard key={order.id} order={order} />
              ))}
            </div>
            {hasMore && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Show More ({filtered.length - visibleCount} remaining)
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
