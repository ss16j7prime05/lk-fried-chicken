import { Star, Clock, Bike } from "lucide-react";
import { useStoreStatus } from "../../store/useStoreStatus";
import { usePreferences } from "../../context/PreferencesContext";
import { calcDeliveryFee } from "../../location/locationUtils";
import { EST_PREP_MINUTES } from "../../config";

// GrabFood / LINE MAN-style store header — large cover image with a circular logo
// overlapping it, plus a compact info row. Reads the live stores/{STORE_ID} doc via
// the shared useStoreStatus hook (real-time, no new fetch/schema). Only real data is
// shown: rating renders solely when the store doc actually carries one.
export function StoreHeader() {
  const { store, status } = useStoreStatus("delivery");
  const { t } = usePreferences();

  const name = store?.storeName || "LK Fried Chicken";
  const category = store?.category || "";
  const eta = store?.prepMinutes ?? EST_PREP_MINUTES;
  const baseFee = calcDeliveryFee(0);
  const isOpen = status !== "closed";
  const rating = store?.rating; // shown only when a real rating exists

  return (
    <section>
      {/* Large cover image */}
      <div className="relative h-36 sm:h-44 md:h-52 rounded-3xl overflow-hidden bg-gray-100">
        {store?.storeBanner ? (
          <img src={store.storeBanner} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
      </div>

      {/* Circular logo overlapping the cover + name/status */}
      <div className="-mt-10 px-1 flex items-end gap-3">
        <div className="w-20 h-20 rounded-full border-4 border-white bg-white shadow-soft overflow-hidden shrink-0">
          {store?.storeLogo ? (
            <img src={store.storeLogo} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🍗</div>
          )}
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-gray-900 truncate">{name}</h1>
            <span
              className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isOpen ? "bg-primary-light text-primary" : "bg-gray-100 text-gray-500"
              }`}
            >
              {isOpen ? t("home.open") : t("home.closed")}
            </span>
          </div>
          {category && (
            <p className="text-xs font-medium text-gray-400 truncate mt-0.5">{category}</p>
          )}
        </div>
      </div>

      {/* Compact info row: rating (if real) · ETA · delivery fee */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-gray-500">
        {rating != null && (
          <span className="flex items-center gap-1">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            {rating}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={14} className="text-primary" />
          {t("home.etaMins", { min: eta })}
        </span>
        <span className="flex items-center gap-1">
          <Bike size={14} className="text-primary" />
          {t("home.deliveryFrom", { fee: baseFee })}
        </span>
      </div>
    </section>
  );
}
