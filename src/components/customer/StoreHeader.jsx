import { Star, Clock, Bike, MapPin } from "lucide-react";
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
  const rating = store?.rating;     // shown only when a real rating exists
  const distanceKm = store?.distanceKm; // shown only when a real value exists

  // Compact info items — dot-separated, only real data is included.
  const infoItems = [
    rating != null && (
      <span key="rating" className="flex items-center gap-1">
        <Star size={13} className="fill-yellow-400 text-yellow-400" />
        {rating}
      </span>
    ),
    <span key="eta" className="flex items-center gap-1">
      <Clock size={13} className="text-primary" />
      {t("home.etaMins", { min: eta })}
    </span>,
    <span key="fee" className="flex items-center gap-1">
      <Bike size={13} className="text-primary" />
      {t("home.deliveryFrom", { fee: baseFee })}
    </span>,
    distanceKm != null && (
      <span key="distance" className="flex items-center gap-1">
        <MapPin size={13} className="text-primary" />
        {distanceKm.toFixed(1)} km
      </span>
    ),
  ].filter(Boolean);

  return (
    <section>
      {/* Premium cover image with a dark gradient for text readability */}
      <div className="relative h-28 sm:h-36 md:h-44 rounded-3xl overflow-hidden bg-gray-100">
        {store?.storeBanner ? (
          <img src={store.storeBanner} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      </div>

      {/* Circular logo (white border + soft shadow) overlapping the cover */}
      <div className="-mt-8 px-1 flex items-end gap-3">
        <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full border-[3px] border-white bg-white shadow-premium overflow-hidden shrink-0">
          {store?.storeLogo ? (
            <img src={store.storeLogo} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🍗</div>
          )}
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-gray-900 truncate">{name}</h1>
            <span
              className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors ${
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

      {/* Compact info row: rating (if real) · ETA · delivery fee · distance (if real) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-y-1 text-xs font-bold text-gray-500">
        {infoItems.map((item, i) => (
          <span key={item.key} className="flex items-center">
            {i > 0 && <span className="mx-2 text-gray-300">•</span>}
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
