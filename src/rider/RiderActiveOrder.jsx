import { useEffect, useMemo, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  Store, User, Phone, MessageCircle, Navigation, Package,
  ChevronDown, ChevronUp, StickyNote, X, ArrowLeft, AlertCircle,
} from "lucide-react";
import { db } from "../firebase";
import { STORE_PHONE } from "../config";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { transition } from "../store/orderStateMachine";
import { DELIVERING_STATUS, DELIVERED_STATUS } from "./riderStatus";
import { RIDER_STAGE } from "./riderStage";
import { getDestination } from "./riderLocationService";
import { watchLocation, stopWatching } from "../location/mapsService";
import { haversineKm } from "../location/locationUtils";
import { telHref } from "../telUtils";
import { logError } from "../errorCenter";
import DeliveryMap from "../location/DeliveryMap.jsx";
import MapButton from "../location/MapButton.jsx";
import Chat from "../Chat.jsx";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { RiderTimeline } from "./RiderTimeline";
import { RiderPaymentCard } from "./RiderPaymentCard";
import { RiderJobActionBar } from "./RiderJobActionBar";
import { RiderDeliverySummary } from "./RiderDeliverySummary";

const optionLabel = (v) => (!v ? "" : typeof v === "object" ? v.name || "" : v);
const itemOptions = (item) =>
  [item.top_chicken, item.spicy, item.Sauce, item.sauce, item.powder, item.tableCheese].map(optionLabel).filter(Boolean);
const km = (n) => (typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)} km` : null);

// Round action button, circular icon action (call / chat / navigate) — 48px target.
const RoundAction = ({ icon: Icon, label, onClick, href }) => {
  const common = "flex items-center justify-center w-12 h-12 rounded-full bg-primary-light text-primary transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
  if (href) return <a href={href} aria-label={label} className={common}><Icon size={20} /></a>;
  return <button type="button" onClick={onClick} aria-label={label} className={common}><Icon size={20} /></button>;
};

// A stop (pickup=store / drop-off=customer): numbered node, name, address, map preview,
// distance chip, and call / chat / navigate actions. Call/chat disabled once terminal.
const StopCard = ({ index, kind, title, name, address, lat, lng, storeLocation, distanceKm, phone, onChat, actionsEnabled, t }) => {
  const tel = actionsEnabled ? telHref(phone) : null;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center mt-0.5">{index}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="flex items-center gap-1.5 font-black text-gray-900 truncate">
            {kind === "store" ? <Store size={15} className="text-primary shrink-0" /> : <User size={15} className="text-primary shrink-0" />}
            <span className="truncate">{name || "-"}</span>
          </p>
          {address && <p className="text-sm text-gray-500 font-medium mt-1 line-clamp-2">{address}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tel && <RoundAction icon={Phone} label={t("ro.callCustomer")} href={tel} />}
          {onChat && actionsEnabled && <RoundAction icon={MessageCircle} label={t("ro.chat")} onClick={onChat} />}
        </div>
      </div>

      {lat != null && lng != null && (
        <div className="mt-3">
          <DeliveryMap lat={lat} lng={lng} address={address} storeLocation={kind === "customer" ? storeLocation : null} height="150px" />
          <div className="flex items-center justify-between gap-3 mt-2">
            {km(distanceKm) && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500">
                <Navigation size={13} className="text-gray-400" /> {km(distanceKm)}
              </span>
            )}
            <MapButton lat={lat} lng={lng} address={address} mode="navigate" label={t("ro.navigate")} style={{ marginLeft: "auto" }} />
          </div>
        </div>
      )}
    </Card>
  );
};

// The single active-job workflow, driven purely by the `order` prop (Firestore SSOT). Used
// both inline in the dashboard (the rider's ONE active job) and by the /rider/job/:id route.
// Stages advance via the additive riderStage + the existing status machine — heading to
// store → arrived → pickup → heading to customer → arrived → delivery → completed. Chat and
// call auto-disable once the order is completed/cancelled. onBack (optional) shows a back
// header; onDone fires when the rider taps Done on the completion summary.
export default function RiderActiveOrder({ order, storeLocation, onDone, onBack }) {
  const { user } = useAuth();
  const { t } = usePreferences();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showItems, setShowItems] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [confirmDeliveryOpen, setConfirmDeliveryOpen] = useState(false);
  const [riderLoc, setRiderLoc] = useState(null); // live GPS, for geofencing the arrival buttons

  const dest = useMemo(() => getDestination(order), [order]);
  const terminal = order.status === "completed" || order.status === "cancelled";

  // Watch the rider's location only while the job is active (picked_up / delivering) —
  // used to geofence the arrival buttons. Stops as soon as the job leaves active state.
  const activeStatus = order.status === "picked_up" || order.status === "delivering";
  useEffect(() => {
    if (!activeStatus) return undefined;
    const id2 = watchLocation(
      (c) => setRiderLoc({ lat: c.lat, lng: c.lng }),
      (err) => logError(err, "RiderActiveOrder.watch")
    );
    return () => stopWatching(id2);
  }, [activeStatus]);

  const storeDistanceKm = riderLoc ? haversineKm(riderLoc.lat, riderLoc.lng, storeLocation.lat, storeLocation.lng) : null;
  const customerDistanceKm =
    riderLoc && dest.lat != null ? haversineKm(riderLoc.lat, riderLoc.lng, dest.lat, dest.lng) : null;

  // ทุก action ผ่านตัวนี้ — ล็อกกันกดซ้ำ + จับ error แล้วแจ้งไรเดอร์ (เดิมล้มเหลวเงียบ)
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try { await fn(); } catch (e) { logError(e, "RiderActiveOrder.action"); setActionError(t("ro.actionFailed")); } finally { setBusy(false); }
  };
  const patchStage = (patch) => updateDoc(doc(db, "orders", order.id), patch);

  // Arrival at restaurant / customer: additive riderStage + timestamp (status unchanged).
  const doArriveRestaurant = () => run(() => patchStage({ riderStage: RIDER_STAGE.ARRIVED_AT_RESTAURANT, arrivedRestaurantAt: serverTimestamp() }));
  const doArriveCustomer = () => run(() => patchStage({ riderStage: RIDER_STAGE.ARRIVED_AT_CUSTOMER, arrivedCustomerAt: serverTimestamp() }));
  // Pickup / delivery boundaries: advance the existing status machine, then stamp the stage.
  // ถ้า transition ถูกปฏิเสธ (ออเดอร์ถูกยกเลิก/สถานะไม่ตรง) ต้องแจ้งไรเดอร์ ไม่ใช่กดแล้วเงียบ
  const doConfirmPickup = () => run(async () => {
    const { ok } = await transition(order, DELIVERING_STATUS, { by: user.uid });
    if (ok) await patchStage({ riderStage: RIDER_STAGE.HEADING_TO_CUSTOMER });
    else setActionError(t("ro.actionFailed"));
  });
  const doConfirmDelivery = () => run(async () => {
    setConfirmDeliveryOpen(false);
    const { ok } = await transition(order, DELIVERED_STATUS, { by: user.uid });
    if (ok) await patchStage({ riderStage: RIDER_STAGE.DELIVERED });
    else setActionError(t("ro.actionFailed"));
  });

  const items = order.items || [];

  return (
    <div className="space-y-5 pb-4">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button onClick={onBack} aria-label={t("ro.jobDetails.title")} className="flex items-center gap-2 text-lg font-black text-gray-900 hover:text-primary">
            <ArrowLeft size={20} /> {t("ro.jobDetails.title")}
          </button>
        ) : (
          <h1 className="text-lg font-black text-gray-900">{t("ro.jobDetails.title")}</h1>
        )}
        <span className="text-xs font-bold text-gray-400">{order.orderNo || order.id?.slice(0, 8)}</span>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-bold min-w-0 flex-1">{actionError}</p>
          <button type="button" onClick={() => setActionError("")} className="text-xs font-black text-red-400 hover:text-red-600 shrink-0">{t("ro.dismiss")}</button>
        </div>
      )}

      {/* completion summary (income / distance / time / coins / tax / net) */}
      {order.status === "completed" && <RiderDeliverySummary order={order} t={t} />}

      {/* timeline */}
      <Card className="p-5">
        <RiderTimeline order={order} t={t} />
      </Card>

      {/* stops */}
      <StopCard
        index={1} kind="store" title={t("ro.pickup")} name={storeLocation.name}
        address={order.storeAddress || ""} lat={storeLocation.lat} lng={storeLocation.lng}
        storeLocation={storeLocation} distanceKm={order.distanceKm ?? order.distance} phone={STORE_PHONE}
        actionsEnabled={!terminal} t={t}
      />
      <StopCard
        index={2} kind="customer" title={t("ro.dropoff")} name={order.customerName}
        address={dest.address} lat={dest.lat} lng={dest.lng} storeLocation={storeLocation}
        distanceKm={order.distanceKm ?? order.distance} phone={order.phone}
        onChat={() => setShowChat((v) => !v)} actionsEnabled={!terminal} t={t}
      />

      {/* notes / special instructions */}
      {order.note && (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-black text-gray-700 mb-2"><StickyNote size={16} className="text-gray-400" /> {t("ro.notes")}</p>
          <p className="text-sm text-gray-600 font-medium bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{order.note}</p>
        </Card>
      )}

      {/* payment (cash = collect COD, e-payment = already paid) */}
      <RiderPaymentCard order={order} t={t} />

      {/* items (collapsible) */}
      <Card className="p-5">
        <button type="button" onClick={() => setShowItems((v) => !v)} aria-expanded={showItems} className="w-full flex items-center justify-between gap-3 focus-visible:outline-none">
          <span className="flex items-center gap-2 text-sm font-black text-gray-700"><Package size={16} className="text-gray-400" /> {t("ro.items", { count: items.reduce((s, i) => s + (i.qty || 1), 0) })}</span>
          <span className="text-xs font-bold text-primary flex items-center gap-1">{showItems ? t("ro.hideItems") : t("ro.viewItems")}{showItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        </button>
        {showItems && (
          <div className="mt-3 divide-y divide-gray-50">
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
        )}
      </Card>

      {/* live chat with customer — hidden entirely once the order is completed/cancelled */}
      {showChat && !terminal && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-2 text-sm font-black text-gray-700"><MessageCircle size={16} className="text-gray-400" /> {order.customerName || "-"}</p>
            <button type="button" onClick={() => setShowChat(false)} aria-label={t("common.close")} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <Chat orderId={order.id} sender="rider" order={order} />
        </Card>
      )}

      {/* sticky action bar — stage-driven; arrival buttons geofence-gated (fail-open) */}
      <RiderJobActionBar
        order={order}
        busy={busy}
        storeLocation={storeLocation}
        dest={dest}
        storeDistanceKm={storeDistanceKm}
        customerDistanceKm={customerDistanceKm}
        onArriveRestaurant={doArriveRestaurant}
        onConfirmPickup={doConfirmPickup}
        onArriveCustomer={doArriveCustomer}
        onConfirmDelivery={() => setConfirmDeliveryOpen(true)}
        onNextJob={onDone}
        t={t}
      />

      <ConfirmDialog
        open={confirmDeliveryOpen}
        title={t("ro.confirmDeliveryTitle")}
        message={t("ro.confirmDeliveryMsg")}
        confirmText={t("ro.action.confirmDelivery")}
        cancelText={t("common.close")}
        onConfirm={doConfirmDelivery}
        onCancel={() => setConfirmDeliveryOpen(false)}
      />
    </div>
  );
}
