import { CheckCircle2, Coins, Route, Clock, Banknote, Receipt, Wallet } from "lucide-react";
import { Card } from "../components/ui/Card";

// Rider delivery-completion summary. All values come from real order fields (additive,
// default 0 when the store/back-office hasn't set them) — no mock data.
//   Income   = deliveryFee + riderBonus   (gross earnings)
//   Tax      = riderTax                    (deduction)
//   Net      = Income − Tax + riderCredits
//   Distance / Time / Coins are informational (Time = acceptedAt → deliveredAt).
const money = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
const toMs = (ts) => (ts?.toMillis ? ts.toMillis() : ts ? new Date(ts).getTime() : 0);

const fmtDuration = (order) => {
  if (Number(order.deliveryDurationMin)) return `${Math.round(order.deliveryDurationMin)}′`;
  const start = toMs(order.acceptedAt ?? order.pickedUpAt);
  const end = toMs(order.deliveredAt ?? order.completedAt);
  if (start && end && end > start) return `${Math.max(1, Math.round((end - start) / 60000))}′`;
  return "—";
};
const fmtKm = (order) => {
  const k = order.distanceKm ?? order.distance ?? order.deliveryDistance;
  return typeof k === "number" && Number.isFinite(k) ? `${k.toFixed(1)} km` : "—";
};

const Stat = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col items-center gap-1 py-3">
    <Icon size={18} className="text-primary" />
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
    <span className="text-sm font-black text-gray-900">{value}</span>
  </div>
);

const Row = ({ icon: Icon, label, value, tone = "" }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
      {Icon && <Icon size={14} className="text-gray-400" />} {label}
    </span>
    <span className={`text-sm font-bold ${tone || "text-gray-900"}`}>{value}</span>
  </div>
);

export const RiderDeliverySummary = ({ order, t }) => {
  const bonus = Number(order.riderBonus || 0);
  const income = Number(order.deliveryFee || 0) + bonus;
  const tax = Number(order.riderTax || 0);
  const credits = Number(order.riderCredits || 0);
  const coins = Number(order.riderCoins || 0);
  const net = income - tax + credits;

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-14 h-14 rounded-full bg-primary-light text-primary flex items-center justify-center mb-2">
          <CheckCircle2 size={30} />
        </div>
        <p className="text-lg font-black text-gray-900">{t("ro.summary.title")}</p>
        <p className="text-xs font-bold text-gray-400 mt-0.5">{order.orderNo || order.id?.slice(0, 8)}</p>
      </div>

      {/* info stats — distance / time / coins */}
      <div className="grid grid-cols-3 rounded-2xl bg-gray-50 divide-x divide-gray-100 mb-3">
        <Stat icon={Route} label={t("ro.summary.distance")} value={fmtKm(order)} />
        <Stat icon={Clock} label={t("ro.summary.time")} value={fmtDuration(order)} />
        <Stat icon={Coins} label={t("ro.summary.coins")} value={coins} />
      </div>

      {/* money breakdown — income / (bonus / credits) / tax */}
      <div className="rounded-2xl bg-gray-50 px-4 py-2">
        <Row icon={Banknote} label={t("ro.summary.income")} value={money(income)} />
        {bonus > 0 && <Row label={t("ro.summary.bonus")} value={`+ ${money(bonus)}`} tone="text-primary" />}
        {credits > 0 && <Row label={t("ro.summary.credits")} value={`+ ${money(credits)}`} tone="text-primary" />}
        <Row icon={Receipt} label={t("ro.summary.tax")} value={`− ${money(tax)}`} tone={tax ? "text-secondary" : ""} />
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <span className="flex items-center gap-1.5 text-sm font-black text-gray-700">
          <Wallet size={16} className="text-primary" /> {t("ro.summary.net")}
        </span>
        <span className="text-2xl font-black text-primary">{money(net)}</span>
      </div>
    </Card>
  );
};
