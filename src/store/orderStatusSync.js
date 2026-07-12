// Shared Live Status Sync (SSOT, Phase 5.6) — one derivation + one subscription for an
// order's status, so Customer / Rider / Store / Admin all render the SAME status from
// the SAME source of truth (the order doc). Reuses the orderStateMachine predicates
// (isTerminal/isActive/nextStates), normalizeStatus, and ErrorCenter. The subscription
// emits ONLY when the status changes (dedupe) to prevent duplicate renders/updates.
// Roles that already subscribe to the order can call getOrderState(order) directly —
// no extra listener. Additive; no new collection. Backward compatible.
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeStatus } from "./orderStatus";
import { isTerminal, isActive, nextStates } from "./orderStateMachine";
import { logError } from "../errorCenter";

// Single status view, identical for every role. Reuses orderStateMachine.
export function getOrderState(order) {
  const status = normalizeStatus(order?.status);
  return {
    id: order?.id ?? null,
    status,
    isTerminal: isTerminal(status),
    isActive: isActive(status),
    next: nextStates(status),
    riderId: order?.riderId ?? null,
  };
}

// Subscribe to an order's status. Emits only on status change (dedupe) — no duplicate
// updates. One listener; returns an unsubscribe. Errors route through ErrorCenter.
export function subscribeOrderStatus(orderId, cb) {
  if (!orderId) return () => {};
  let lastStatus;
  return onSnapshot(doc(db, "orders", orderId), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const order = { id: snap.id, ...snap.data() };
    const status = normalizeStatus(order.status);
    if (status === lastStatus) return; // unchanged -> skip
    lastStatus = status;
    cb(getOrderState(order));
  }, (e) => logError(e, "subscribeOrderStatus"));
}

// Hook: live, deduped order status for any role. One listener per order.
export function useOrderStatus(orderId) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!orderId) return undefined;
    return subscribeOrderStatus(orderId, setState);
  }, [orderId]);
  return state;
}
