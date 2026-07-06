import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Bike,
  CalendarDays,
  CalendarRange,
  History,
  LogOut,
  Package,
  Route,
  Settings,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { useRiderOrders } from "./useRiderOrders";
import { byNewest, normalizeStatus, STATUS_LABEL, toDate } from "../store/orderStatus";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Loading } from "../components/ui/Loading";

const RECENT_LIMIT = 10;

/* ── date helpers ── */
const isSameDay = (d, ref) =>
  d &&
  d.getDate() === ref.getDate() &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();
// สัปดาห์เริ่มวันอาทิตย์ (ตาม Store Dashboard)
const isThisWeek = (d, ref) => {
  if (!d) return false;
  const start = new Date(ref);
  start.setDate(ref.getDate() - ref.getDay());
  start.setHours(0, 0, 0, 0);
  return d >= start;
};
const isThisMonth = (d, ref) =>
  d && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

const formatDate = (d) => (d ? d.toLocaleString("th-TH") : "-");

/* ── earnings derivation ──
   ไม่มีฟิลด์ earnings ใน Firestore: รายได้ไรเดอร์ต่อออเดอร์ = ค่าส่ง (deliveryFee)
   ของออเดอร์ที่ส่งสำเร็จ ระยะทางใช้ฟิลด์ระยะจัดส่งที่ Checkout บันทึกไว้อยู่แล้ว */
const orderEarnings = (o) => Number(o.deliveryFee || 0);
const orderDistanceKm = (o) => {
  const km = o.distanceKm ?? o.distance ?? o.deliveryDistance;
  return typeof km === "number" && Number.isFinite(km) ? km : 0;
};

const fmtMoney = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
const fmtKm = (n) => `${Number(n || 0).toFixed(1)} km`;

const sumBy = (list, fn) => list.reduce((s, o) => s + fn(o), 0);
const avgPer = (total, count) => (count > 0 ? total / count : 0);

/* ── UI bits (same look as RiderProfile stat cards) ── */
const SectionTitle = ({ children }) => (
  <h2 className="text-base font-black text-gray-900">{children}</h2>
);

const StatCard = ({ icon: Icon, label, value }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className="p-3 rounded-2xl bg-primary-light text-primary shrink-0">
      <Icon size={22} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-gray-400 uppercase truncate">{label}</p>
      <p className="text-lg font-black text-gray-900 truncate">{value}</p>
    </div>
  </Card>
);

const RecentDeliveryCard = ({ order }) => {
  const status = normalizeStatus(order.status);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-gray-900 truncate">{order.orderNo || order.id}</p>
          <p className="text-sm text-gray-700 font-medium truncate mt-0.5">
            {order.customerName || "-"}
          </p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">{formatDate(order.when)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-primary">{fmtMoney(orderEarnings(order))}</p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">{fmtKm(orderDistanceKm(order))}</p>
          <div className="mt-1.5">
            <Badge color="green">{STATUS_LABEL[status] || status}</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};

// รายได้ไรเดอร์: สรุปวันนี้/สัปดาห์นี้/เดือนนี้/ทั้งหมด จากออเดอร์จริงที่ riderId == uid
export default function RiderEarnings() {
  const { user, logout } = useAuth();
  const { orders, loading } = useRiderOrders(user?.uid);

  const { today, week, month, lifetime, recent } = useMemo(() => {
    const now = new Date();
    // นับรายได้ตามเวลาที่ส่งสำเร็จ (deliveredAt) fallback เป็น createdAt สำหรับออเดอร์เก่า
    const completed = orders
      .filter((o) => normalizeStatus(o.status) === "completed")
      .map((o) => ({ ...o, when: toDate(o.deliveredAt ?? o.createdAt) }));

    const bucket = (list) => ({
      orders: list.length,
      earnings: sumBy(list, orderEarnings),
      distanceKm: sumBy(list, orderDistanceKm),
    });

    const todayList = completed.filter((o) => isSameDay(o.when, now));
    const weekList = completed.filter((o) => isThisWeek(o.when, now));
    const monthList = completed.filter((o) => isThisMonth(o.when, now));

    return {
      today: bucket(todayList),
      week: bucket(weekList),
      month: bucket(monthList),
      lifetime: bucket(completed),
      recent: [...completed]
        .sort(byNewest((o) => o.when))
        .slice(0, RECENT_LIMIT),
    };
  }, [orders]);

  if (loading) {
    return <Loading text="Loading earnings..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        {/* header — same pattern as the other rider pages */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900">Earnings</h1>
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
            <Link to="/rider/history">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <History size={16} />
                History
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

        {/* Analytics — daily/weekly/monthly/lifetime overview from the same buckets */}
        <div className="space-y-3">
          <SectionTitle>Analytics</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-50">
                  <th className="p-4 font-bold">Period</th>
                  <th className="p-4 font-bold text-right">Deliveries</th>
                  <th className="p-4 font-bold text-right">Earnings</th>
                  <th className="p-4 font-bold text-right">Distance</th>
                  <th className="p-4 font-bold text-right whitespace-nowrap">Avg / Delivery</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Today", data: today },
                  { label: "This Week", data: week },
                  { label: "This Month", data: month },
                  { label: "Lifetime", data: lifetime },
                ].map((p) => (
                  <tr key={p.label} className="border-b border-gray-50 last:border-0">
                    <td className="p-4 font-bold text-gray-900 whitespace-nowrap">{p.label}</td>
                    <td className="p-4 text-right font-medium text-gray-700">{p.data.orders}</td>
                    <td className="p-4 text-right font-medium text-gray-700 whitespace-nowrap">
                      {fmtMoney(p.data.earnings)}
                    </td>
                    <td className="p-4 text-right font-medium text-gray-700 whitespace-nowrap">
                      {fmtKm(p.data.distanceKm)}
                    </td>
                    <td className="p-4 text-right font-black text-primary whitespace-nowrap">
                      {fmtMoney(avgPer(p.data.earnings, p.data.orders))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Today */}
        <div className="space-y-3">
          <SectionTitle>Today</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Bike} label="Completed Orders" value={today.orders} />
            <StatCard icon={Wallet} label="Earnings" value={fmtMoney(today.earnings)} />
            <StatCard icon={Route} label="Distance" value={fmtKm(today.distanceKm)} />
          </div>
        </div>

        {/* This Week */}
        <div className="space-y-3">
          <SectionTitle>This Week</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={CalendarDays} label="Orders" value={week.orders} />
            <StatCard icon={Wallet} label="Earnings" value={fmtMoney(week.earnings)} />
          </div>
        </div>

        {/* This Month */}
        <div className="space-y-3">
          <SectionTitle>This Month</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={CalendarRange} label="Orders" value={month.orders} />
            <StatCard icon={Wallet} label="Earnings" value={fmtMoney(month.earnings)} />
          </div>
        </div>

        {/* Lifetime */}
        <div className="space-y-3">
          <SectionTitle>Lifetime</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={TrendingUp} label="Total Orders" value={lifetime.orders} />
            <StatCard icon={Wallet} label="Total Earnings" value={fmtMoney(lifetime.earnings)} />
          </div>
        </div>

        {/* Recent completed deliveries */}
        <div className="space-y-3">
          <SectionTitle>Recent Completed Deliveries</SectionTitle>
          {recent.length === 0 ? (
            <EmptyState
              icon="🛵"
              title="No completed deliveries yet"
              description="Earnings from deliveries you complete will show up here."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recent.map((order) => (
                <RecentDeliveryCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
