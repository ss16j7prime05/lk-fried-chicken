import { createPortal } from "react-dom";
import { ArrowLeft, Store, User, Package, StickyNote, Navigation } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { getDestination } from "./riderLocationService";
import { haversineKm } from "../location/locationUtils";
import DeliveryMap from "../location/DeliveryMap.jsx";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { RiderPaymentCard } from "./RiderPaymentCard";

const optionLabel = (v) => (!v ? "" : typeof v === "object" ? v.name || "" : v);
const itemOptions = (item) =>
  [item.top_chicken, item.spicy, item.Sauce, item.sauce, item.powder, item.tableCheese].map(optionLabel).filter(Boolean);
const km = (n) => (typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)} km` : null);

// Full-screen order detail for a NOT-yet-accepted incoming order (opened from the popup's
// "View Details"). Read-only preview of store / customer / map / items + payment: cash
// tells the rider to collect COD, e-payment tells them it is already paid. "Back" returns
// to the incoming popup; "Accept Order" claims the job. No status change happens here.
export default function RiderOrderDetailSheet({ order, storeLocation, busy, onAccept, onBack }) {
  const { t } = usePreferences();
  if (!order) return null;

  const dest = getDestination(order);
  const items = order.items || [];
  const distanceKm =
    dest.lat != null && dest.lng != null && storeLocation
      ? haversineKm(storeLocation.lat, storeLocation.lng, dest.lat, dest.lng)
      : (order.distanceKm ?? order.distance ?? null);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-gray-50 overflow-y-auto">
      {/* sticky header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} aria-label={t("common.back")} className="flex items-center gap-2 text-base font-black text-gray-900 hover:text-primary">
          <ArrowLeft size={20} /> {t("ro.detail.title")}
        </button>
        <span className="text-xs font-bold text-gray-400">{order.orderNo || order.id?.slice(0, 8)}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-28">
        {/* payment intent (cash = collect / e-payment = already paid) */}
        <RiderPaymentCard order={order} t={t} />

        {/* store */}
        <Card className="p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t("ro.pickup")}</p>
          <p className="flex items-center gap-1.5 font-black text-gray-900 mt-0.5">
            <Store size={15} className="text-primary shrink-0" /> {storeLocation?.name || "LK Fried Chicken"}
          </p>
          {order.storeAddress && <p className="text-sm text-gray-500 font-medium mt-1">{order.storeAddress}</p>}
        </Card>

        {/* customer + drop-off map */}
        <Card className="p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t("ro.dropoff")}</p>
          <p className="flex items-center gap-1.5 font-black text-gray-900 mt-0.5">
            <User size={15} className="text-primary shrink-0" /> {order.customerName || "-"}
          </p>
          {dest.address && <p className="text-sm text-gray-500 font-medium mt-1 line-clamp-2">{dest.address}</p>}
          {dest.lat != null && dest.lng != null && (
            <div className="mt-3">
              <DeliveryMap lat={dest.lat} lng={dest.lng} address={dest.address} storeLocation={storeLocation} height="180px" />
              {km(distanceKm) && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 mt-2">
                  <Navigation size={13} className="text-gray-400" /> {km(distanceKm)}
                </span>
              )}
            </div>
          )}
        </Card>

        {/* note */}
        {order.note && (
          <Card className="p-5">
            <p className="flex items-center gap-2 text-sm font-black text-gray-700 mb-2"><StickyNote size={16} className="text-gray-400" /> {t("ro.notes")}</p>
            <p className="text-sm text-gray-600 font-medium bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{order.note}</p>
          </Card>
        )}

        {/* items */}
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-black text-gray-700 mb-2">
            <Package size={16} className="text-gray-400" /> {t("ro.items", { count: items.reduce((s, i) => s + (i.qty || 1), 0) })}
          </p>
          <div className="divide-y divide-gray-50">
            {items.map((item, i) => {
              const opts = itemOptions(item);
              return (
                <div key={i} className="flex justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-700 font-medium">{item.qty || 1}× {item.name}</p>
                    {opts.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{opts.join(" • ")}</p>}
                  </div>
                  <span className="text-gray-500 whitespace-nowrap">฿{(item.price || 0) * (item.qty || 1)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* sticky actions */}
      <div className="fixed bottom-0 inset-x-0 z-10 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex gap-3">
          <Button variant="outline" className="flex-1 !py-3.5" onClick={onBack}>
            <ArrowLeft size={18} /> {t("common.back")}
          </Button>
          <Button className="flex-[1.6] !py-3.5" loading={busy} onClick={() => onAccept(order)}>
            <Package size={18} /> {t("ro.detail.acceptOrder")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
