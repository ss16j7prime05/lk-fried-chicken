import { Banknote, CreditCard, CheckCircle2 } from "lucide-react";
import { Card } from "../components/ui/Card";

// Premium, scannable payment card. Pure presentation of the order's existing
// paymentMethod + grandTotal — cash = rider collects COD, promptpay/transfer =
// customer already paid online (collect ฿0).
const METHOD = {
  cash: { badgeKey: "ro.pay.codBadge", pill: "bg-emerald-50 text-emerald-600", Icon: Banknote },
  promptpay: { badgeKey: "payment.promptpay", pill: "bg-blue-50 text-blue-600", Icon: CreditCard },
  transfer: { badgeKey: "payment.transfer", pill: "bg-orange-50 text-orange-600", Icon: CreditCard },
};

const money = (n) => `฿${Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;

export const RiderPaymentCard = ({ order, t }) => {
  const method = order.paymentMethod || "cash";
  const m = METHOD[method] || METHOD.cash;
  const isCod = method === "cash";
  const amount = Number(order.grandTotal ?? order.subtotal ?? 0);
  const collect = isCod ? amount : 0;
  const { Icon } = m;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-black text-gray-700">
          <CreditCard size={16} className="text-gray-400" /> {t("ro.pay.title")}
        </span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${m.pill}`}>
          <Icon size={12} className="shrink-0" /> {t(m.badgeKey)}
        </span>
      </div>

      <p className="text-3xl font-black text-gray-900 mt-3 leading-none tabular-nums">{money(collect)}</p>
      <p className={`flex items-center gap-1.5 text-xs font-bold mt-2 ${isCod ? "text-secondary" : "text-primary"}`}>
        {isCod ? <Banknote size={14} className="shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
        {isCod ? t("ro.pay.collect") : t("ro.pay.paidOnline")}
      </p>
      {!isCod && amount > 0 && (
        <p className="text-xs text-gray-400 font-medium mt-1">{t("ro.total")}: {money(amount)}</p>
      )}
    </Card>
  );
};
