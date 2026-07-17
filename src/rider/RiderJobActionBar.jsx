import { MapPin } from "lucide-react";
import MapButton from "../location/MapButton.jsx";
import { Button } from "../components/ui/Button";
import { riderStageAction, withinGeofence } from "./riderStage";

// Sticky bottom action bar for the granular rider workflow. The stage (order.riderStage)
// drives which buttons show; the handlers (in RiderJobDetails) advance riderStage and, at
// the pickup/delivery boundaries, the existing status machine too. Arrival buttons are
// geofence-gated (enabled within GEOFENCE_KM of the target) but fail open when GPS is
// unavailable so a location problem can never block a real delivery.
export const RiderJobActionBar = ({
  order, busy, storeLocation, dest, storeDistanceKm, customerDistanceKm,
  onAccept, onArriveRestaurant, onConfirmPickup, onArriveCustomer, onConfirmDelivery, onNextJob, t,
}) => {
  const action = riderStageAction(order);
  if (action.kind === "none") return null;

  const atStore = withinGeofence(storeDistanceKm);
  const atCustomer = withinGeofence(customerDistanceKm);
  const fullBtn = { width: "100%", textAlign: "center", display: "block" };

  return (
    <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4 z-30">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-premium border border-gray-100 p-3 space-y-2">
        {action.kind === "accept" && (
          <Button className="w-full h-14 text-base" loading={busy} onClick={onAccept}>{t("ro.action.accept")}</Button>
        )}

        {action.kind === "arrive_restaurant" && (
          <>
            <MapButton lat={storeLocation.lat} lng={storeLocation.lng} address={storeLocation.name} mode="navigate" label={`🧭 ${t("ro.action.goToStore")}`} style={fullBtn} />
            {!atStore && storeDistanceKm != null && (
              <p className="text-center text-xs font-bold text-gray-400">{t("ro.action.farFromStore", { km: storeDistanceKm.toFixed(1) })}</p>
            )}
            <Button className="w-full h-14 text-base" disabled={!atStore} loading={busy} onClick={onArriveRestaurant}>
              {t("ro.action.confirmArriveRestaurant")}
            </Button>
          </>
        )}

        {action.kind === "confirm_pickup" && (
          <Button className="w-full h-14 text-base" loading={busy} onClick={onConfirmPickup}>{t("ro.action.confirmPickup")}</Button>
        )}

        {action.kind === "arrive_customer" && (
          <>
            {dest.lat != null && <MapButton lat={dest.lat} lng={dest.lng} address={dest.address} mode="navigate" label={`🧭 ${t("ro.action.goToCustomer")}`} style={fullBtn} />}
            {!atCustomer && customerDistanceKm != null && (
              <p className="text-center text-xs font-bold text-gray-400">{t("ro.action.farFromCustomer", { km: customerDistanceKm.toFixed(1) })}</p>
            )}
            <Button className="w-full h-14 text-base" disabled={!atCustomer} loading={busy} onClick={onArriveCustomer}>
              {t("ro.action.confirmArriveCustomer")}
            </Button>
          </>
        )}

        {action.kind === "confirm_delivery" && (
          <Button className="w-full h-14 text-base" loading={busy} onClick={onConfirmDelivery}>{t("ro.action.confirmDelivery")}</Button>
        )}

        {action.kind === "done" && (
          <Button className="w-full h-14 text-base" onClick={onNextJob}><MapPin size={18} /> {t("ro.action.nextJob")}</Button>
        )}
      </div>
    </div>
  );
};
