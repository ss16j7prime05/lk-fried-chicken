import { AlertCircle } from "lucide-react";
import { useStoreStatus } from "../../store/useStoreStatus";
import { usePreferences } from "../../context/PreferencesContext";

// Shown on Home + Checkout when the store isn't accepting delivery orders. Reads the
// same live status (stores/{STORE_ID}) the Store portal writes, so it flips the moment
// the store closes. Renders nothing while the store is open/closing-soon.
export function StoreClosedBanner() {
  const { status, nextOpen, holidayName } = useStoreStatus("delivery");
  const { t, language } = usePreferences();

  if (status !== "closed") return null;

  const opensStr = nextOpen
    ? new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(nextOpen)
    : null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white shadow-soft border border-gray-100">
      <AlertCircle size={20} className="text-secondary shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-black text-sm text-gray-900">{t("store.closedTitle")}</p>
        <p className="text-xs font-medium text-gray-500 mt-0.5">
          {holidayName || t("store.closedOrder")}
        </p>
        {opensStr && (
          <p className="text-xs font-bold text-secondary mt-1">
            {t("store.opensAt", { time: opensStr })}
          </p>
        )}
      </div>
    </div>
  );
}
