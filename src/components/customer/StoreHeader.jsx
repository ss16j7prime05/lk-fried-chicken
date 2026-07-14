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
      {/* Cover + overlapping logo. The wrapper is NOT clipped so the logo can hang
          below the cover; only the cover itself clips its image/gradient. */}
      <div className="relative">
        {/* Premium cover image with a dark gradient for text readability */}
        <div className="relative h-28 sm:h-36 md:h-44 rounded-3xl overflow-hidden bg-gray-100">
          {store?.storeBanner ? (
            <img src={store.storeBanner} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        </div>

        {/* Circular logo — overlaps the cover Facebook/LINE-style: exactly half of it
            (translate-y-1/2) extends below the cover edge, layered above it (z-20),
            with a 4px white border and a soft shadow. Never clipped. */}
        <div className="absolute left-4 bottom-0 translate-y-1/2 z-20">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden">
            {store?.storeLogo ? (
              <img src={store.storeLogo} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">🍗</div>
            )}
          </div>
        </div>
      </div>

      {/* Name + status, sitting below the overlapping logo (spacer clears the hang) */}
      <div className="mt-12 sm:mt-14">
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

        {/* Compact info row: rating (if real) · ETA · delivery fee · distance (if real) */}
        <div className="mt-2 flex flex-wrap items-center gap-y-1 text-xs font-bold text-gray-500">
          {infoItems.map((item, i) => (
            <span key={item.key} className="flex items-center">
              {i > 0 && <span className="mx-2 text-gray-300">•</span>}
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
