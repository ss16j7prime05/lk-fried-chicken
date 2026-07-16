import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { RefreshCw, Layers, LocateFixed, SlidersHorizontal, Package } from "lucide-react";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { usePreferences } from "../context/PreferencesContext";
import { getCurrentLocation } from "../location/mapsService";
import { getDestination } from "./riderLocationService";
import { READY_QUERY_STATUSES, isReadyForDelivery } from "./riderStatus";
import { MAX_DELIVERY_RADIUS_KM } from "../constants/address";
import { logError } from "../errorCenter";

const FALLBACK = { lat: 13.8294079, lng: 100.0529543, name: "LK Fried Chicken" };

const storeIcon = L.divIcon({ className: "", html: '<div style="font-size:26px;line-height:26px">🏪</div>', iconSize: [26, 26], iconAnchor: [13, 26] });
const riderIcon = L.divIcon({ className: "", html: '<div style="width:22px;height:22px;border-radius:50%;background:#00B14F;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,.4)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
const jobIcon = L.divIcon({ className: "", html: '<div style="width:18px;height:18px;border-radius:50%;background:#FF5B22;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.35)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

// Imperatively recenters the map when `target`/`token` change (react-leaflet v5).
function Recenter({ target, token }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [token, target, map]);
  return null;
}

const FloatBtn = ({ icon: Icon, label, onClick, active = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    className={`flex items-center justify-center w-12 h-12 rounded-full shadow-premium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
      active ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-100 hover:text-primary"
    }`}
  >
    <Icon size={20} />
  </button>
);

export default function RiderJobMap() {
  const { t } = usePreferences();
  const navigate = useNavigate();
  const [store, setStore] = useState(FALLBACK);
  const [jobs, setJobs] = useState([]);
  const [rider, setRider] = useState(null);
  const [locating, setLocating] = useState(false);
  const [showZone, setShowZone] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [showLayers, setShowLayers] = useState(false);
  const [center, setCenter] = useState(null);
  const tokenRef = useRef(0);
  const [flyToken, setFlyToken] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setStore({ lat: d.lat ?? FALLBACK.lat, lng: d.lng ?? FALLBACK.lng, name: d.storeName || FALLBACK.name });
      }
    }, (err) => logError(err, "RiderJobMap.store"));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "orders"), where("status", "in", READY_QUERY_STATUSES));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((o) => !o.riderId && isReadyForDelivery(o.status))
        .map((o) => { const dgot = getDestination(o); return { id: o.id, orderNo: o.orderNo, fee: o.deliveryFee, lat: dgot.lat, lng: dgot.lng }; })
        .filter((o) => o.lat != null && o.lng != null);
      setJobs(list);
    }, (err) => logError(err, "RiderJobMap.jobs"));
    return () => unsub();
  }, []);

  const applyLocation = (c) => {
    setRider({ lat: c.lat, lng: c.lng });
    setCenter({ lat: c.lat, lng: c.lng });
    tokenRef.current += 1;
    setFlyToken(tokenRef.current);
  };
  // Manual refresh/locate (event handler — sync setState is fine here).
  const locate = () => {
    setLocating(true);
    getCurrentLocation()
      .then(applyLocation)
      .catch((e) => logError(e, "RiderJobMap.locate"))
      .finally(() => setLocating(false));
  };
  // Locate once on mount — state is only set inside the async callback (no sync setState in effect).
  useEffect(() => {
    let cancelled = false;
    getCurrentLocation()
      .then((c) => { if (!cancelled) applyLocation(c); })
      .catch((e) => logError(e, "RiderJobMap.locate"));
    return () => { cancelled = true; };
  }, []);

  const recenter = () => {
    const tgt = rider || store;
    setCenter({ lat: tgt.lat, lng: tgt.lng });
    tokenRef.current += 1;
    setFlyToken(tokenRef.current);
  };

  const initialCenter = useMemo(() => [store.lat, store.lng], [store.lat, store.lng]);

  return (
    <div className="-m-4 sm:-m-6 md:-m-8">
      <div className="relative w-full h-[calc(100dvh-64px-env(safe-area-inset-bottom))] md:h-[100dvh] overflow-hidden">
        <MapContainer center={initialCenter} zoom={12} scrollWheelZoom zoomControl={false} className="w-full h-full" style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {showZone && (
            <Circle center={initialCenter} radius={MAX_DELIVERY_RADIUS_KM * 1000}
              pathOptions={{ color: "#00B14F", weight: 2, fillColor: "#00B14F", fillOpacity: 0.08 }} />
          )}
          <Marker position={initialCenter} icon={storeIcon}><Popup>{store.name}</Popup></Marker>
          {rider && <Marker position={[rider.lat, rider.lng]} icon={riderIcon}><Popup>{t("ro.jobMap.you")}</Popup></Marker>}
          {showJobs && jobs.map((j) => (
            <Marker key={j.id} position={[j.lat, j.lng]} icon={jobIcon}
              eventHandlers={{ click: () => navigate(`/rider/job/${j.id}`) }}>
              <Popup>{j.orderNo || j.id} · ฿{Number(j.fee || 0)}</Popup>
            </Marker>
          ))}
          <Recenter target={center} token={flyToken} />
        </MapContainer>

        {/* top-left: title + filter card */}
        <div className="absolute top-3 left-3 z-[400] space-y-2">
          <div className="bg-white rounded-2xl shadow-premium border border-gray-100 px-3 py-2">
            <p className="flex items-center gap-2 text-sm font-black text-gray-800"><SlidersHorizontal size={15} className="text-primary" /> {t("ro.jobMap.title")}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 mt-0.5"><Package size={11} /> {t("ro.jobMap.jobsAvailable", { count: jobs.length })}</p>
          </div>
        </div>

        {/* top-right: refresh */}
        <div className="absolute top-3 right-3 z-[400]">
          <FloatBtn icon={RefreshCw} label={t("ro.jobMap.refresh")} onClick={locate} />
        </div>

        {/* bottom-right: layers + locate */}
        <div className="absolute bottom-4 right-3 z-[400] flex flex-col items-end gap-2">
          {showLayers && (
            <div className="bg-white rounded-2xl shadow-premium border border-gray-100 p-2 space-y-1 mb-1">
              <button type="button" onClick={() => setShowZone((v) => !v)} className={`w-full text-left text-xs font-bold px-3 py-2 rounded-xl ${showZone ? "bg-primary-light text-primary" : "text-gray-500"}`}>{t("ro.jobMap.showZone")}</button>
              <button type="button" onClick={() => setShowJobs((v) => !v)} className={`w-full text-left text-xs font-bold px-3 py-2 rounded-xl ${showJobs ? "bg-primary-light text-primary" : "text-gray-500"}`}>{t("ro.jobMap.showJobs")}</button>
            </div>
          )}
          <FloatBtn icon={Layers} label={t("ro.jobMap.layers")} onClick={() => setShowLayers((v) => !v)} active={showLayers} />
          <FloatBtn icon={LocateFixed} label={locating ? t("ro.jobMap.locating") : t("ro.jobMap.myLocation")} onClick={recenter} />
        </div>

        {/* legend */}
        <div className="absolute bottom-4 left-3 z-[400] bg-white rounded-2xl shadow-premium border border-gray-100 px-3 py-2 space-y-1">
          <p className="flex items-center gap-2 text-[11px] font-bold text-gray-600"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> {t("ro.jobMap.you")}</p>
          <p className="flex items-center gap-2 text-[11px] font-bold text-gray-600"><span className="text-sm leading-none">🏪</span> {t("ro.jobMap.store")}</p>
          <p className="flex items-center gap-2 text-[11px] font-bold text-gray-600"><span className="w-3 h-3 rounded-full bg-secondary inline-block" /> {t("ro.jobMap.showJobs")}</p>
        </div>
      </div>
    </div>
  );
}
