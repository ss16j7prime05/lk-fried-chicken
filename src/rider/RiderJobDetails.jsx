import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import {
  ArrowLeft, Store, User, Phone, MessageCircle, Navigation, Package,
  ChevronDown, ChevronUp, StickyNote, X,
} from "lucide-react";
import { db } from "../firebase";
import { STORE_ID, STORE_PHONE } from "../config";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { transition } from "../store/orderStateMachine";
import { acceptOrder } from "./riderAcceptReject";
import { DELIVERING_STATUS, DELIVERED_STATUS } from "./riderStatus";
import { getDestination } from "./riderLocationService";
import { telHref } from "../telUtils";
import { logError } from "../errorCenter";
import DeliveryMap from "../location/DeliveryMap.jsx";
import MapButton from "../location/MapButton.jsx";
import Chat from "../Chat.jsx";
import { Card } from "../components/ui/Card";
import { Loading } from "../components/ui/Loading";
import { EmptyState } from "../components/ui/EmptyState";
import { RiderTimeline } from "./RiderTimeline";
import { RiderPaymentCard } from "./RiderPaymentCard";
import { RiderJobActionBar } from "./RiderJobActionBar";

const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

const optionLabel = (v) => (!v ? "" : typeof v === "object" ? v.name || "" : v);
const itemOptions = (item) =>
  [item.top_chicken, item.spicy, item.Sauce, item.sauce, item.powder, item.tableCheese].map(optionLabel).filter(Boolean);
const km = (n) => (typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)} km` : null);

// Round action button, circular icon action (call / chat / navigate) — 48px target.
const RoundAction = ({ icon: Icon, label, onClick, href, tone = "primary" }) => {
  const cls = tone === "primary" ? "bg-primary-light text-primary" : "bg-gray-100 text-gray-500";
  const common = `flex items-center justify-center w-12 h-12 rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${cls}`;
  if (href) return <a href={href} aria-label={label} className={common}><Icon size={20} /></a>;
  return <button type="button" onClick={onClick} aria-label={label} className={common}><Icon size={20} /></button>;
};

// A stop (pickup=store / drop-off=customer): numbered node, name, address, map preview,
// distance chip, and call / chat / navigate actions.
const StopCard = ({ index, kind, title, name, address, lat, lng, storeLocation, distanceKm, phone, onChat, t }) => {
  const tel = telHref(phone);
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
          {onChat && <RoundAction icon={MessageCircle} label={t("ro.nav.notifications")} onClick={onChat} />}
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

export default function RiderJobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = usePreferences();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // UI-only sub-step within the picked_up state (no backend state): Navigate to Store →
  // Arrived at Store → Confirm Food Pickup. Does not persist — a convenience affordance.
  const [arrivedStore, setArrivedStore] = useState(false);
  const [storeLocation, setStoreLocation] = useState({ lat: FALLBACK_STORE_LAT, lng: FALLBACK_STORE_LNG, name: "LK Fried Chicken" });

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, "orders", id),
      (snap) => {
        if (!snap.exists()) { setOrder(null); setNotFound(true); }
        else { setOrder({ id: snap.id, ...snap.data() }); setNotFound(false); }
        setLoading(false);
      },
      (err) => { logError(err, "RiderJobDetails.order"); setLoading(false); setNotFound(true); }
    );
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStoreLocation({ lat: d.lat ?? FALLBACK_STORE_LAT, lng: d.lng ?? FALLBACK_STORE_LNG, name: d.storeName || "LK Fried Chicken" });
      }
    }, (err) => logError(err, "RiderJobDetails.store"));
    return () => unsub();
  }, []);

  const dest = useMemo(() => (order ? getDestination(order) : { lat: null, lng: null, address: "" }), [order]);

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { logError(e, "RiderJobDetails.action"); } finally { setBusy(false); }
  };
  const riderIdentity = () => ({ uid: user.uid, name: profile?.name || profile?.riderName || user?.email || "ไรเดอร์", phone: profile?.phone || "" });

  const doAccept = () => run(async () => { await acceptOrder(order, riderIdentity()); });
  const doPickup = () => run(() => transition(order, DELIVERING_STATUS, { by: user.uid }));
  const doDeliver = () => run(() => transition(order, DELIVERED_STATUS, { by: user.uid }));

  if (loading) return <Loading text={t("ro.loading.deliveries")} />;
  if (notFound || !order) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate(-1)} aria-label={t("ro.jobDetails.title")} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-primary">
          <ArrowLeft size={18} /> {t("ro.jobDetails.title")}
        </button>
        <EmptyState icon="🛵" title={t("ro.jobDetails.loadErr")} description={t("ro.history.emptyDesc")} />
      </div>
    );
  }

  const income = Number(order.deliveryFee || 0);
  const items = order.items || [];

  return (
    <div className="space-y-5 pb-4">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} aria-label={t("ro.jobDetails.title")} className="flex items-center gap-2 text-lg font-black text-gray-900 hover:text-primary">
          <ArrowLeft size={20} /> {t("ro.jobDetails.title")}
        </button>
        <span className="text-xs font-bold text-gray-400">{order.orderNo || order.id?.slice(0, 8)}</span>
      </div>

      {/* timeline + key figures */}
      <Card className="p-5 space-y-4">
        <RiderTimeline status={order.status} t={t} />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t("ro.earningsCol")}</p>
            <p className="text-lg font-black text-primary">฿{income.toLocaleString("th-TH")}</p>
          </div>
          <div className="text-center border-x border-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t("ro.distance")}</p>
            <p className="text-lg font-black text-gray-900">{km(order.distanceKm ?? order.distance) || "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase">ETA</p>
            <p className="text-lg font-black text-gray-900">{order.estimatedDeliveryMinutes ? `${order.estimatedDeliveryMinutes}′` : "—"}</p>
          </div>
        </div>
      </Card>

      {/* stops */}
      <StopCard
        index={1} kind="store" title={t("ro.pickup")} name={storeLocation.name}
        address={order.storeAddress || ""} lat={storeLocation.lat} lng={storeLocation.lng}
        storeLocation={storeLocation} distanceKm={order.distanceKm ?? order.distance} phone={STORE_PHONE} t={t}
      />
      <StopCard
        index={2} kind="customer" title={t("ro.dropoff")} name={order.customerName}
        address={dest.address} lat={dest.lat} lng={dest.lng} storeLocation={storeLocation}
        distanceKm={order.distanceKm ?? order.distance} phone={order.phone}
        onChat={() => setShowChat((v) => !v)} t={t}
      />

      {/* notes / special instructions */}
      {order.note && (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-black text-gray-700 mb-2"><StickyNote size={16} className="text-gray-400" /> {t("ro.notes")}</p>
          <p className="text-sm text-gray-600 font-medium bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{order.note}</p>
        </Card>
      )}

      {/* payment */}
      <RiderPaymentCard order={order} t={t} />

      {/* items (collapsible) */}
      <Card className="p-5">
        <button type="button" onClick={() => setShowItems((v) => !v)} className="w-full flex items-center justify-between gap-3 focus-visible:outline-none">
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

      {/* live chat with customer (existing shared component) */}
      {showChat && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="flex items-center gap-2 text-sm font-black text-gray-700"><MessageCircle size={16} className="text-gray-400" /> {order.customerName || "-"}</p>
            <button type="button" onClick={() => setShowChat(false)} aria-label={t("common.close")} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <Chat orderId={order.id} sender="rider" order={order} />
        </Card>
      )}

      {/* sticky action bar — reflects the existing state, drives existing transitions */}
      <RiderJobActionBar
        status={order.status}
        arrivedStore={arrivedStore}
        busy={busy}
        storeLocation={storeLocation}
        dest={dest}
        onArrivedStore={() => setArrivedStore(true)}
        onAccept={doAccept}
        onPickup={doPickup}
        onDeliver={doDeliver}
        onNextJob={() => navigate("/rider")}
        t={t}
      />
    </div>
  );
}
