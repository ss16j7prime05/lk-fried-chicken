import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { useRiderOrders } from "./useRiderOrders";
import { completedWithDate, bucketFor, addPeriods, recentPeriods } from "./riderMetrics";
import { Card } from "../components/ui/Card";
import { Loading } from "../components/ui/Loading";

const money = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const GRANS = ["day", "week", "month"];
const CHIP_COUNT = 5;

// Income Summary — Daily / Weekly / Monthly tabs. Each period shows total income, completed
// order count, and the difference vs the previous period. All from the rider's real
// completed orders (no mock); empty periods read ฿0.00.
export default function RiderIncomeSummary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = usePreferences();
  const { orders, loading } = useRiderOrders(user?.uid);
  const [mountTime] = useState(() => Date.now());
  const [gran, setGran] = useState("day");
  const [offset, setOffset] = useState(0); // 0 = current period, 1 = previous, ...

  const locale = language === "th" ? "th-TH-u-ca-buddhist" : "en-US";
  const fmt = (d, opts) => new Intl.DateTimeFormat(locale, opts).format(d);

  const chipLabel = (start) => {
    if (gran === "month") return { top: fmt(start, { month: "long" }), bottom: fmt(start, { year: "numeric" }) };
    if (gran === "week") {
      const end = addPeriods(start, "week", 1);
      const last = new Date(end.getTime() - 86400000);
      return { top: `${fmt(start, { day: "numeric" })} - ${fmt(last, { day: "numeric" })}`, bottom: fmt(last, { month: "short" }) };
    }
    return { top: fmt(start, { weekday: "short" }), bottom: fmt(start, { day: "numeric", month: "short" }) };
  };

  const now = new Date(mountTime);
  const completed = completedWithDate(orders);
  const periods = recentPeriods(now, gran, CHIP_COUNT); // oldest → newest
  const selectedStart = periods[periods.length - 1 - offset];
  const bucket = bucketFor(completed, selectedStart, gran);
  const prev = bucketFor(completed, addPeriods(selectedStart, gran, -1), gran);
  const diff = bucket.income - prev.income;

  const switchGran = (g) => { setGran(g); setOffset(0); };

  const totalLabel = gran === "day" ? t("ro.income.net") : t("ro.income.total");
  const prevLabel = t(`ro.income.prev.${gran}`);
  const DiffIcon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
  const diffTone = diff > 0 ? "text-primary bg-primary-light" : diff < 0 ? "text-secondary bg-secondary/10" : "text-gray-400 bg-gray-100";

  if (loading) return <Loading text={t("ro.loading.settings")} />;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={() => navigate("/rider/settings")} className="flex items-center gap-2 text-lg font-black text-gray-900 hover:text-primary">
        <ArrowLeft size={20} /> {t("ro.menu.income")}
      </button>

      {/* tabs */}
      <div className="flex border-b border-gray-100">
        {GRANS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => switchGran(g)}
            className={`flex-1 pb-2.5 text-sm font-black border-b-2 -mb-px transition-colors ${
              gran === g ? "border-primary text-primary" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t(`ro.income.tab.${g}`)}
          </button>
        ))}
      </div>

      {/* period chips (newest on the right) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {periods.map((start, i) => {
          const off = periods.length - 1 - i;
          const { top, bottom } = chipLabel(start);
          const active = off === offset;
          return (
            <button
              key={start.getTime()}
              type="button"
              onClick={() => setOffset(off)}
              className={`shrink-0 min-w-[86px] px-3 py-2 rounded-2xl border text-center transition-all ${
                active ? "bg-primary-light border-primary text-primary" : "bg-white border-gray-100 text-gray-500 hover:border-primary"
              }`}
            >
              <span className="block text-sm font-black leading-tight">{top}</span>
              <span className="block text-[11px] font-bold opacity-70">{bottom}</span>
            </button>
          );
        })}
      </div>

      {/* selected period total */}
      <Card className="p-6 text-center">
        <p className="text-sm font-bold text-gray-500">{totalLabel}</p>
        <p className="text-4xl font-black text-primary mt-1">{money(bucket.income)}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={`inline-flex items-center gap-1 text-xs font-black px-2 py-0.5 rounded-full ${diffTone}`}>
            <DiffIcon size={12} /> {money(Math.abs(diff))}
          </span>
          <span className="text-xs font-medium text-gray-400">{prevLabel}</span>
        </div>
      </Card>

      {/* completed order count */}
      <Card className="p-5">
        <p className="text-lg font-black text-gray-900">{t("ro.income.completedCount", { count: bucket.orders })}</p>
        <p className="text-xs font-medium text-gray-400 mt-0.5">{t(`ro.income.scope.${gran}`)}</p>
      </Card>

      <p className="text-right text-xs font-medium text-gray-400">
        {t("ro.income.updated", { at: fmt(now, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) })}
      </p>
    </div>
  );
}
