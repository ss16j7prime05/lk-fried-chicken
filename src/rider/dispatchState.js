// ── Rider Dispatch — State Machine (SSOT, pure/firebase-free so it is node-testable) ─────────
// The dispatch lifecycle of an order, plus the pure decision logic the coordinator uses to pick
// who to offer next. All authoritative state lives on the ORDER doc (offeredTo / offerExpiresAt /
// offerCycleRejects / dispatchPausedUntil) — no new collection — so dispatch survives refresh,
// offline→online, and multi-tab. The Firestore transactions live in dispatchEngine.js.
//
//   Pending → Offered → Accepted → ArrivedStore → PickedUp → Delivering → Completed
//   Offered --(timeout)--> Pending      (order is NEVER deleted)
//   Offered --(reject)---> Pending
//   any live --(cancel)--> Cancelled
import { normalizeStatus } from "../store/orderStatus.js";
import { isReadyForDelivery } from "./riderStatus.js";

export const DISPATCH = {
  PENDING: "pending",         // ready for delivery, unassigned, not currently offered (or offer expired)
  OFFERED: "offered",         // an offer to a specific rider is live (offerExpiresAt in the future)
  ACCEPTED: "accepted",       // a rider claimed it (heading to store)
  ARRIVED_STORE: "arrived_store",
  PICKED_UP: "picked_up",
  DELIVERING: "delivering",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// How long a single offer stays on one rider before it times out and returns to Pending (req 3).
export const OFFER_TTL_MS = 30_000;
// After a timeout/reject, wait this long before re-offering (the "wait a few seconds" in req 4).
export const REOFFER_GAP_MS = 4_000;

// Is there a live offer on this order right now?
export const offerActive = (order, now = Date.now()) =>
  Boolean(order?.offeredTo) && Number(order?.offerExpiresAt || 0) > now;

// ms left on the current offer (0 if none/expired) — used to drive the countdown so it is
// correct after a refresh instead of restarting from 30s.
export const offerRemainingMs = (order, now = Date.now()) =>
  Math.max(0, Number(order?.offerExpiresAt || 0) - now);

// Derive the dispatch state from the order doc (no separate authoritative field — keeps schema).
// Post-accept granularity reuses the existing status + riderStage instead of new fields.
export function dispatchStateOf(order, now = Date.now()) {
  const s = normalizeStatus(order?.status);
  if (s === "cancelled") return DISPATCH.CANCELLED;
  if (s === "completed") return DISPATCH.COMPLETED;
  if (s === "delivering") return DISPATCH.DELIVERING;
  if (order?.riderId) {
    if (order.riderStage === "arrived_at_restaurant") return DISPATCH.ARRIVED_STORE;
    if (order.riderStage === "heading_to_customer" || order.riderStage === "arrived_at_customer") return DISPATCH.PICKED_UP;
    return DISPATCH.ACCEPTED;
  }
  if (isReadyForDelivery(order?.status)) return offerActive(order, now) ? DISPATCH.OFFERED : DISPATCH.PENDING;
  return DISPATCH.PENDING; // still cooking/etc — not yet in dispatch, treated as pending
}

// An order is dispatchable (needs a rider) when it is ready, unassigned and not terminal.
export const isDispatchable = (order) =>
  Boolean(order) && !order.riderId && isReadyForDelivery(order.status) &&
  normalizeStatus(order.status) !== "cancelled";

// Straight-line distance from a rider (with .location {lat,lng}) to a point; riders without a
// known location sort last (Infinity) so located riders are preferred.
const distanceTo = (rider, point, haversineKm) => {
  const loc = rider?.location;
  if (!loc || loc.lat == null || loc.lng == null || !point || point.lat == null) return Infinity;
  return haversineKm(loc.lat, loc.lng, point.lat, point.lng);
};

// Nearest-first ordering of riders relative to the pickup point (the store) — req 5.
// haversineKm is injected so this stays pure/firebase-free (and unit-testable).
export function sortRidersByDistance(riders, point, haversineKm) {
  return [...(riders || [])].sort((a, b) => distanceTo(a, point, haversineKm) - distanceTo(b, point, haversineKm));
}

// Choose the next rider to offer to. Skips riders who already declined (timeout/reject) THIS
// cycle; when everyone has declined, it starts a NEW cycle (offers the nearest again) so the
// order cycles forever until accepted/cancelled (reqs 4, 5, 6). Returns { rider, newCycle }.
export function pickNextRider(ridersNearestFirst, cycleRejects = []) {
  const list = ridersNearestFirst || [];
  const rejected = new Set(cycleRejects || []);
  const fresh = list.find((r) => !rejected.has(r.uid));
  if (fresh) return { rider: fresh, newCycle: false };
  // everyone declined this cycle → new cycle, offer the nearest again (never abandon the order)
  return { rider: list[0] || null, newCycle: true };
}

// Does this order need a (re)offer right now? True when dispatchable AND there is no live offer
// AND we're past any re-offer pause. This is the gate the coordinator's tick uses.
export function needsOffer(order, now = Date.now()) {
  if (!isDispatchable(order)) return false;
  if (offerActive(order, now)) return false;
  if (Number(order?.dispatchPausedUntil || 0) > now) return false;
  return true;
}
