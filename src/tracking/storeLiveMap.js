// Shared Store Live Map (SSOT, Phase 5.0E) — one place for the store's live delivery
// map: assigned orders, their riders' live positions, customer destinations, and
// rider->customer distance. Reuses the existing store orders query (storeId==STORE_ID,
// the same one Store/Orders uses — no additional query), riderLocationService for
// rider positions, customerTracking.calculateRemainingDistance (which reuses mapsService)
// for distance, and the FeatureFlags gate. routeEngine.getPolyline draws the on-map
// route on the consumer side. Read-only: no writes, no new collection, no duplicate
// listeners (one orders listener + one per assigned rider). Backward compatible.
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { normalizeStatus } from "../store/orderStatus";
import { subscribeRiderLocation } from "../rider/riderLocationService";
import { calculateRemainingDistance } from "./customerTracking";
import { useFeatureFlags } from "../featureFlags";

// Rider is actively en route for these statuses.
const ACTIVE = new Set(["picked_up", "delivering"]);
const isAssignedActive = (o) => !!o.riderId && ACTIVE.has(normalizeStatus(o.status));

// Customer destination from the order (existing fields only, new + legacy shapes).
const customerDest = (o) => ({
  lat: o?.deliveryLocation?.lat ?? o?.lat ?? o?.latitude ?? null,
  lng: o?.deliveryLocation?.lng ?? o?.lng ?? o?.longitude ?? null,
  address: o?.deliveryLocation?.address || o?.deliveryAddress || o?.address || null,
});

// Live rider position for an order: per-delivery broadcast (order.riderLocation) first,
// then the rider-doc currentLocation from subscribeAssignedRiders.
const riderPos = (o, riders) => {
  const rl = o.riderLocation;
  if (rl?.lat != null) return { lat: rl.lat, lng: rl.lng };
  return riders?.[o.riderId] || null;
};

// The ONE orders listener — reuses the store's canonical query, filtered to assigned.
export function subscribeAssignedOrders(cb) {
  const q = query(collection(db, "orders"), where("storeId", "==", STORE_ID));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isAssignedActive));
  });
}

// Fan-out to each assigned rider's live location. Reuses riderLocationService
// (no duplicate listener logic). cb receives { riderId: location, ... }.
export function subscribeAssignedRiders(riderIds, cb) {
  const map = {};
  const unsubs = (riderIds || []).filter(Boolean).map((rid) =>
    subscribeRiderLocation(rid, (d) => { map[rid] = d?.currentLocation || null; cb({ ...map }); })
  );
  return () => unsubs.forEach((u) => u && u());
}

// Customer destination for one order (targeted single-order listener).
export function subscribeCustomerLocation(orderId, cb) {
  if (!orderId) return () => {};
  return onSnapshot(doc(db, "orders", orderId), (snap) => {
    cb(snap.exists() ? customerDest(snap.data()) : null);
  });
}

// Pure view model for the map. Reuses customerTracking distance (-> mapsService).
export function getStoreMapSnapshot(orders = [], riders = {}) {
  return (orders || []).filter(isAssignedActive).map((o) => {
    const customer = customerDest(o);
    const location = riderPos(o, riders);
    return {
      orderId: o.id,
      orderNo: o.orderNo || o.id,
      status: normalizeStatus(o.status),
      rider: { id: o.riderId || null, location },
      customer,
      distanceKm: calculateRemainingDistance(location, customer),
    };
  });
}

// Hook: live store map. One orders listener + fan-out rider listeners; snapshot
// recomputes on any rider/customer/order change. Cleans up all listeners on unmount.
export function useStoreLiveMap() {
  const flags = useFeatureFlags();
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState({});

  useEffect(() => {
    if (!flags.enableRealtimeTracking) return undefined;
    return subscribeAssignedOrders(setOrders);
  }, [flags.enableRealtimeTracking]);

  const riderKey = useMemo(
    () => [...new Set(orders.map((o) => o.riderId).filter(Boolean))].join(","),
    [orders]
  );

  useEffect(() => {
    const ids = riderKey ? riderKey.split(",") : [];
    const stop = subscribeAssignedRiders(ids, setRiders);
    return () => { stop(); setRiders({}); };
  }, [riderKey]);

  const snapshot = useMemo(() => getStoreMapSnapshot(orders, riders), [orders, riders]);
  return { orders, riders, snapshot };
}
