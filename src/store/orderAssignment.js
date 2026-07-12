// Shared Order Assignment (SSOT, Phase 5.1) — real-time dispatch of ready orders to
// riders. Reuses the orderEngine SSOT (assignRider: ready_for_delivery -> picked_up +
// rider identity + notifications) for the write, routeEngine.getDistance (-> mapsService)
// for nearest-rider selection, and rider live location (Phase 5.0B currentLocation).
// Operates on the orders/riders arrays the dashboards already subscribe to — no new
// Firestore query/listener/collection. Additive; the rider self-assign path is unchanged.
import { useCallback } from "react";
import { assignRider } from "./orderEngine";
import { normalizeStatus } from "./orderStatus";
import { getDistance } from "../location/routeEngine";

const READY = "ready_for_delivery";

// Orders still needing a rider (ready + no rider yet).
export const isUnassigned = (o) => normalizeStatus(o?.status) === READY && !o?.riderId;

// Riders eligible to receive a job: online with a known live location.
export function findAvailableRiders(riders = []) {
  return (riders || []).filter(
    (r) => r && r.role === "rider" && r.riderStatus === "online" && r.currentLocation?.lat != null
  );
}

// Nearest available rider to a point (e.g. the store). Reuses routeEngine distance.
export function findNearestRider(fromLocation, riders = []) {
  if (!fromLocation?.lat) return null;
  let best = null;
  let bestKm = Infinity;
  for (const r of findAvailableRiders(riders)) {
    const km = getDistance(fromLocation, r.currentLocation);
    if (km != null && km < bestKm) { bestKm = km; best = r; }
  }
  return best;
}

// Assign an order to a specific rider. Reuses the orderEngine SSOT — no duplicate
// write, transition, or notification logic.
export function assignOrder(order, rider) {
  if (!order?.id || !rider) return Promise.resolve(null);
  return assignRider(order, {
    uid: rider.id || rider.uid || "",
    name: rider.name || rider.riderName || "",
    phone: rider.phone || "",
  });
}

// Auto-assign an order to the nearest available rider (no-op if none available).
export function autoAssignOrder(order, riders, fromLocation) {
  const rider = findNearestRider(fromLocation, riders);
  return rider ? assignOrder(order, rider) : Promise.resolve(null);
}

// Hook: assignment callbacks bound to the store location. Data (orders/riders) comes
// from the caller's existing subscriptions — no duplicate listener. Manual + auto keep
// dispatch explicit (a single dispatcher triggers it), avoiding multi-client races.
export function useOrderAssignment(storeLocation) {
  const assign = useCallback((order, rider) => assignOrder(order, rider), []);
  const autoAssign = useCallback(
    (order, riders) => autoAssignOrder(order, riders, storeLocation),
    [storeLocation]
  );
  return { assign, autoAssign, findNearestRider, findAvailableRiders, isUnassigned };
}
