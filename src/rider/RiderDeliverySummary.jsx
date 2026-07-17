import { CheckCircle2, Coins } from "lucide-react";
import { Card } from "../components/ui/Card";

// Rider delivery-completion summary. All values come from real order fields (additive,
// default 0 when the store/back-office hasn't set them) — no mock data. Payout =
// earnings + bonus − tax + credits; coins are a separate reward count.
const money = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

const Row = ({ label, value, tone = "" }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
    <span className="text-sm font-medium text-gray-500">{label}</span>
    <span className={`text-sm font-bold ${tone || "text-gray-900"}`}>{value}</span>
  </div>
);

export const RiderDeliverySummary = ({ order, t }) => {
  const earnings = Number(order.deliveryFee || 0);
  const bonus = Number(order.riderBonus || 0);
  const tax = Number(order.riderTax || 0);
  const credits = Number(order.riderCredits || 0);
  const coins = Number(order.riderCoins || 0);
  const total = earnings + bonus - tax + credits;

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-14 h-14 rounded-full bg-primary-light text-primary flex items-center justify-center mb-2">
          <CheckCircle2 size={30} />
        </div>
        <p className="text-lg font-black text-gray-900">{t("ro.summary.title")}</p>
        <p className="text-xs font-bold text-gray-400 mt-0.5">{order.orderNo || order.id?.slice(0, 8)}</p>
      </div>

      <div className="rounded-2xl bg-gray-50 px-4 py-2">
        <Row label={t("ro.summary.earnings")} value={money(earnings)} />
        <Row label={t("ro.summary.bonus")} value={`+ ${money(bonus)}`} tone={bonus ? "text-primary" : ""} />
        <Row label={t("ro.summary.tax")} value={`− ${money(tax)}`} tone={tax ? "text-secondary" : ""} />
        <Row label={t("ro.summary.credits")} value={`+ ${money(credits)}`} tone={credits ? "text-primary" : ""} />
        <Row
          label={<span className="flex items-center gap-1.5"><Coins size={14} className="text-amber-500" /> {t("ro.summary.coins")}</span>}
          value={coins}
        />
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <span className="text-sm font-black text-gray-700">{t("ro.summary.total")}</span>
        <span className="text-2xl font-black text-primary">{money(total)}</span>
      </div>
    </Card>
  );
};
