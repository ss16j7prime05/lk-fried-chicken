// Shared Admin Fleet Map (SSOT, Phase 5.0F) — one place for the admin-wide live fleet:
// all stores, all riders (with live currentLocation from Phase 5.0B), and all orders.
// Reuses the same collection listeners Admin already subscribes to (users / stores /
// orders — no new query/collection), the Analytics SSOT for metrics, and the
// FeatureFlags gate. routeEngine/mapsService/storeLiveMap/customerTracking draw routes
// and per-order detail on the consumer side. Read-only: no writes. Backward compatible.
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { getAnalytics } from "../analytics";
import { useFeatureFlags } from "../featureFlags";
import { logError } from "../errorCenter";

const riderLoc = (u) => (u?.currentLocation?.lat != null
  ? { lat: u.currentLocation.lat, lng: u.currentLocation.lng }
  : null);

// Existing collection listeners (same collections Admin already uses) — no new query.
export function subscribeRiders(cb) {
  return onSnapshot(collection(db, "users"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "rider"));
  }, (e) => logError(e, "subscribeRiders"));
}

export function subscribeStores(cb) {
  return onSnapshot(collection(db, "stores"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (e) => logError(e, "subscribeStores"));
}

export function subscribeOrders(cb) {
  return onSnapshot(collection(db, "orders"), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (e) => logError(e, "subscribeOrders"));
}

// Combine all three into one fleet subscription. Returns a cleanup that stops all.
export function subscribeFleet(cb) {
  const fleet = { stores: [], riders: [], orders: [] };
  const emit = () => cb({ ...fleet });
  const u1 = subscribeStores((stores) => { fleet.stores = stores; emit(); });
  const u2 = subscribeRiders((riders) => { fleet.riders = riders; emit(); });
  const u3 = subscribeOrders((orders) => { fleet.orders = orders; emit(); });
  return () => { u1(); u2(); u3(); };
}

// Pure view model for the fleet map. Reuses Analytics for metrics (no duplicate aggregation).
export function getFleetSnapshot({ stores = [], riders = [], orders = [] } = {}) {
  const { dashboardMetrics } = getAnalytics({ orders, riders });
  const online = riders.filter((r) => r.riderStatus === "online").length;
  return {
    stores: stores.map((s) => ({
      id: s.id,
      name: s.storeName || s.name || s.id,
      location: s.lat != null ? { lat: s.lat, lng: s.lng } : null,
      isOpen: s.isOpen ?? null,
    })),
    riders: riders.map((r) => ({
      id: r.id,
      name: r.name || r.riderName || r.id,
      status: r.riderStatus || "offline",
      location: riderLoc(r),
      updatedAt: r.updatedAt || null,
    })),
    metrics: dashboardMetrics,
    counts: { stores: stores.length, riders: riders.length, online, orders: orders.length },
    generatedAt: Date.now(),
  };
}

// Hook: live admin fleet map. One listener per collection via subscribeFleet; snapshot
// recomputes on any change. Cleans up all listeners on unmount. Gated by the flag.
export function useAdminFleetMap() {
  const flags = useFeatureFlags();
  const [fleet, setFleet] = useState({ stores: [], riders: [], orders: [] });

  useEffect(() => {
    if (!flags.enableRealtimeTracking) return undefined;
    return subscribeFleet(setFleet);
  }, [flags.enableRealtimeTracking]);

  const snapshot = useMemo(() => getFleetSnapshot(fleet), [fleet]);
  return { ...fleet, snapshot };
}
