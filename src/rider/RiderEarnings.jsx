import { useMemo } from "react";
import {
  Bike,
  CalendarDays,
  CalendarRange,
  Route,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { useRiderIncome } from "./useRiderIncome";
import { byNewest, normalizeStatus } from "../store/orderStatus";
import { summarizeIncome, completedWithDate, orderNet, orderDistanceKm, fmtTHB0 } from "./riderIncome";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { RiderCardGridSkeleton } from "../components/ui/Skeleton";
import { SectionTitle, StatCard } from "./riderUi";

const RECENT_LIMIT = 10;

const formatDate = (d) => (d ? d.toLocaleString("th-TH") : "-");
const fmtMoney = fmtTHB0;
const fmtKm = (n) => `${Number(n || 0).toFixed(1)} km`;
const avgPer = (total, count) => (count > 0 ? total / count : 0);

const RecentDeliveryCard = ({ order, t }) => {
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
          <p className="font-black text-primary">{fmtMoney(orderNet(order))}</p>
          <p className="text-xs font-medium text-gray-400 mt-0.5">{fmtKm(orderDistanceKm(order))}</p>
          <div className="mt-1.5">
            <Badge color="green">{t(`ro.status.${status}`)}</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};

// รายได้ไรเดอร์: สรุปวันนี้/สัปดาห์นี้/เดือนนี้/ทั้งหมด จากออเดอร์จริงที่ riderId == uid
export default function RiderEarnings() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const { orders, loading } = useRiderIncome(user?.uid);

  // Every figure comes from the SSOT (summarizeIncome / orderNet) so Finance matches Home,
  // Income Summary and Work Summary exactly. Net = fee + bonus − tax − adjustment.
  const { today, week, month, lifetime, recent } = useMemo(() => {
    const inc = summarizeIncome(orders, new Date());
    const recentList = completedWithDate(orders)
      .sort(byNewest((o) => o.when))
      .slice(0, RECENT_LIMIT);
    return { today: inc.today, week: inc.week, month: inc.month, lifetime: inc.lifetime, recent: recentList };
  }, [orders]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-gray-900">{t("ro.earnings.title")}</h1>
        <RiderCardGridSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">{t("ro.earnings.title")}</h1>

      {/* Analytics — daily/weekly/monthly/lifetime overview from the same buckets */}
      <div className="space-y-3">
        <SectionTitle>{t("ro.analytics")}</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-50">
                <th className="p-4 font-bold">{t("ro.period")}</th>
                <th className="p-4 font-bold text-right">{t("ro.deliveries")}</th>
                <th className="p-4 font-bold text-right">{t("ro.earningsCol")}</th>
                <th className="p-4 font-bold text-right">{t("ro.distance")}</th>
                <th className="p-4 font-bold text-right whitespace-nowrap">{t("ro.avgPerDelivery")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: t("ro.today"), data: today },
                { label: t("ro.thisWeek"), data: week },
                { label: t("ro.thisMonth"), data: month },
                { label: t("ro.lifetime"), data: lifetime },
              ].map((p) => (
                <tr key={p.label} className="border-b border-gray-50 last:border-0">
                  <td className="p-4 font-bold text-gray-900 whitespace-nowrap">{p.label}</td>
                  <td className="p-4 text-right font-medium text-gray-700">{p.data.orders}</td>
                  <td className="p-4 text-right font-medium text-gray-700 whitespace-nowrap">
                    {fmtMoney(p.data.net)}
                  </td>
                  <td className="p-4 text-right font-medium text-gray-700 whitespace-nowrap">
                    {fmtKm(p.data.distanceKm)}
                  </td>
                  <td className="p-4 text-right font-black text-primary whitespace-nowrap">
                    {fmtMoney(avgPer(p.data.net, p.data.orders))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Today */}
      <div className="space-y-3">
        <SectionTitle>{t("ro.today")}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Bike} label={t("ro.completedOrders")} value={today.orders} />
          <StatCard icon={Wallet} label={t("ro.earningsCol")} value={fmtMoney(today.net)} />
          <StatCard icon={Route} label={t("ro.distance")} value={fmtKm(today.distanceKm)} />
        </div>
      </div>

      {/* This Week */}
      <div className="space-y-3">
        <SectionTitle>{t("ro.thisWeek")}</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={CalendarDays} label={t("ro.orders")} value={week.orders} />
          <StatCard icon={Wallet} label={t("ro.earningsCol")} value={fmtMoney(week.net)} />
        </div>
      </div>

      {/* This Month */}
      <div className="space-y-3">
        <SectionTitle>{t("ro.thisMonth")}</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={CalendarRange} label={t("ro.orders")} value={month.orders} />
          <StatCard icon={Wallet} label={t("ro.earningsCol")} value={fmtMoney(month.net)} />
        </div>
      </div>

      {/* Lifetime */}
      <div className="space-y-3">
        <SectionTitle>{t("ro.lifetime")}</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={TrendingUp} label={t("ro.totalOrders")} value={lifetime.orders} />
          <StatCard icon={Wallet} label={t("ro.totalEarnings")} value={fmtMoney(lifetime.net)} />
        </div>
      </div>

      {/* Recent completed deliveries */}
      <div className="space-y-3">
        <SectionTitle>{t("ro.recentCompleted")}</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState
            icon="🛵"
            title={t("ro.earnings.emptyTitle")}
            description={t("ro.earnings.emptyDesc")}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recent.map((order) => (
              <RecentDeliveryCard key={order.id} order={order} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
