import { MapPin } from "lucide-react";
import MapButton from "../location/MapButton.jsx";
import { Button } from "../components/ui/Button";
import { jobActionFor } from "./riderJobFlow";

// Sticky bottom action bar for the rider job flow. Pure presentation over the EXISTING
// order state — it renders the right buttons per state and calls the handlers; the
// handlers (in RiderJobDetails) drive the existing orderStateMachine transitions.
// The Navigate → Arrived at Store → Confirm Pickup granularity within picked_up is a
// UI-only sub-step (arrivedStore) — no backend state is added.
export const RiderJobActionBar = ({
  status, arrivedStore, busy, storeLocation, dest,
  onArrivedStore, onAccept, onPickup, onDeliver, onNextJob, t,
}) => {
  const action = jobActionFor(status);
  if (action.kind === "none") return null;

  return (
    <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4 z-30">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-premium border border-gray-100 p-3 space-y-2">
        {action.kind === "accept" && (
          <Button className="w-full h-14 text-base" loading={busy} onClick={onAccept}>{t("ro.action.accept")}</Button>
        )}

        {action.kind === "pickup" && !arrivedStore && (
          <>
            <MapButton lat={storeLocation.lat} lng={storeLocation.lng} address={storeLocation.name} mode="navigate" label={`🧭 ${t("ro.action.goToStore")}`} style={{ width: "100%", textAlign: "center", display: "block" }} />
            <Button variant="outline" className="w-full h-14 text-base" onClick={onArrivedStore}>{t("ro.action.arrivedStore")}</Button>
          </>
        )}
        {action.kind === "pickup" && arrivedStore && (
          <Button className="w-full h-14 text-base" loading={busy} onClick={onPickup}>{t("ro.action.confirmPickup")}</Button>
        )}

        {action.kind === "deliver" && (
          <>
            {dest.lat != null && <MapButton lat={dest.lat} lng={dest.lng} address={dest.address} mode="navigate" label={`🧭 ${t("ro.action.goToCustomer")}`} style={{ width: "100%", textAlign: "center", display: "block" }} />}
            <Button className="w-full h-14 text-base" loading={busy} onClick={onDeliver}>{t("ro.action.delivered")}</Button>
          </>
        )}

        {action.kind === "done" && (
          <Button className="w-full h-14 text-base" onClick={onNextJob}><MapPin size={18} /> {t("ro.action.nextJob")}</Button>
        )}
      </div>
    </div>
  );
};
