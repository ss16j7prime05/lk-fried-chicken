// Shared Auto Dispatch (SSOT, Phase 5.2) — automatically assigns unassigned ready
// orders to the nearest available rider. Reuses the Phase 5.1 assignment SSOT
// (assignOrder/findNearestRider/isUnassigned -> orderEngine write) and the FeatureFlags
// gate (enableAutoDispatch, OFF by default = backward compatible). Operates on the
// orders/riders arrays the caller already subscribes to — no new query/listener/
// collection. Intended for a single dispatcher; guards prevent re-dispatch within a tick.
import { useEffect, useRef } from "react";
import { assignOrder, findNearestRider, isUnassigned } from "./orderAssignment";
import { useFeatureFlags } from "../featureFlags";

// Dispatch each unassigned ready order to a distinct nearest rider (a rider picked for
// one order is excluded for the rest of the pass). Returns [{ orderId, riderId }].
export async function dispatchOrders(orders = [], riders = [], fromLocation) {
  const pending = (orders || []).filter(isUnassigned);
  const used = new Set();
  const results = [];
  for (const order of pending) {
    const rider = findNearestRider(fromLocation, (riders || []).filter((r) => !used.has(r.id)));
    if (!rider) continue; // none available -> leave for the next tick
    used.add(rider.id);
    await assignOrder(order, rider); // reuse 5.1 -> orderEngine SSOT
    results.push({ orderId: order.id, riderId: rider.id });
  }
  return results;
}

// Hook: auto-dispatch on every orders/riders change. Gated by enableAutoDispatch (or an
// explicit `enabled` override). A busy flag serializes ticks; an in-flight set prevents
// re-dispatching an order whose assignment is still resolving. No state, no new listener.
export function useAutoDispatch(orders, riders, storeLocation, { enabled } = {}) {
  const flags = useFeatureFlags();
  const active = enabled ?? Boolean(flags.enableAutoDispatch);
  const inFlight = useRef(new Set());
  const busy = useRef(false);

  useEffect(() => {
    if (!active || busy.current) return;
    const pending = (orders || []).filter((o) => isUnassigned(o) && !inFlight.current.has(o.id));
    if (!pending.length) return;
    busy.current = true;
    pending.forEach((o) => inFlight.current.add(o.id));
    dispatchOrders(pending, riders, storeLocation).finally(() => {
      pending.forEach((o) => inFlight.current.delete(o.id));
      busy.current = false;
    });
  }, [active, orders, riders, storeLocation]);

  return { active };
}
