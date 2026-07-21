import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, Star, ThumbsUp, XCircle, Package, Route, Wallet } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { useRiderOrders } from "./useRiderOrders";
import { performanceRates } from "./riderMetrics";
import { summarizeIncome, fmtTHB0 } from "./riderIncome";
import { logError } from "../errorCenter";
import { Card } from "../components/ui/Card";
import { StatCard } from "./riderUi";

const money = fmtTHB0;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;
const km = (n) => `${Number(n || 0).toFixed(1)} km`;

const RateCard = ({ icon: Icon, label, value, tone }) => (
  <Card className="p-4">
    <p className={`text-2xl font-black ${tone}`}>{value}</p>
    <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mt-1">
      <Icon size={14} className="text-gray-400" /> {label}
    </p>
  </Card>
);

// Work Summary — rating, acceptance & cancellation rates, income summary, and working
// statistics, all from the rider's real orders (completed = delivered) and real reviews.
export default function RiderWorkSummary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = usePreferences();
  const { orders } = useRiderOrders(user?.uid);
  const [reviews, setReviews] = useState([]);
  const [mountTime] = useState(() => Date.now());

  useEffect(() => {
    if (!user?.uid) return undefined;
    const rq = query(collection(db, "reviews"), where("riderId", "==", user.uid));
    const unsub = onSnapshot(
      rq,
      (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => logError(err, "RiderWorkSummary.reviews")
    );
    return () => unsub();
  }, [user?.uid]);

  const rates = performanceRates(orders);
  // Income figures come from the SSOT (summarizeIncome) so they match every other page exactly.
  const inc = summarizeIncome(orders, new Date(mountTime));
  const todayIncome = inc.today.net;
  const weekIncome = inc.week.net;
  const monthIncome = inc.month.net;
  const lifetimeIncome = inc.lifetime.net;
  const lifetimeDistance = inc.lifetime.distanceKm;
  const rating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(2) : "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate("/rider/settings")} className="flex items-center gap-2 text-lg font-black text-gray-900 hover:text-primary">
        <ArrowLeft size={20} /> {t("ro.menu.workSummary")}
      </button>

      {/* rating */}
      <Card className="p-6">
        <p className="text-sm font-black text-gray-700 mb-3">{t("ro.work.satisfaction")}</p>
        <div className="flex items-center gap-2">
          <span className="text-4xl font-black text-gray-900">{rating}</span>
          <Star size={26} className="fill-amber-400 text-amber-400" />
        </div>
        <p className="text-xs font-medium text-gray-400 mt-2">
          {t("ro.work.ratingDesc", { count: reviews.length })}
        </p>
      </Card>

      {/* rates */}
      <div>
        <p className="text-sm font-black text-gray-700 mb-2">{t("ro.work.rates")}</p>
        <div className="grid grid-cols-2 gap-4">
          <RateCard icon={ThumbsUp} label={t("ro.work.acceptance")} value={pct(rates.acceptanceRate)} tone="text-primary" />
          <RateCard icon={XCircle} label={t("ro.work.cancellation")} value={pct(rates.cancellationRate)} tone="text-secondary" />
        </div>
      </div>

      {/* income summary */}
      <div>
        <p className="text-sm font-black text-gray-700 mb-2">{t("ro.work.incomeSummary")}</p>
        <Card className="p-5 grid grid-cols-3 divide-x divide-gray-100">
          {[
            [t("ro.work.today"), todayIncome],
            [t("ro.work.thisWeek"), weekIncome],
            [t("ro.work.thisMonth"), monthIncome],
          ].map(([label, val]) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-1 text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase">{label}</span>
              <span className="text-base font-black text-primary">{money(val)}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* working statistics */}
      <div>
        <p className="text-sm font-black text-gray-700 mb-2">{t("ro.work.statistics")}</p>
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Package} label={t("ro.work.completed")} value={rates.completed} />
          <StatCard icon={Route} label={t("ro.distance")} value={km(lifetimeDistance)} />
          <StatCard icon={Wallet} label={t("ro.work.lifetime")} value={money(lifetimeIncome)} />
        </div>
      </div>
    </div>
  );
}
