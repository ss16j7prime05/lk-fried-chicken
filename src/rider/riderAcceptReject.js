// Shared Rider Accept / Reject (SSOT, Phase 5.3) — atomic claim of a ready order.
// Uses a Firestore transaction to PREVENT DOUBLE ACCEPT and handle the accept race:
// the order doc is re-read inside the transaction and only claimed if still ready and
// unassigned (respecting an unexpired offer window for timeout handling). Reuses the
// orderEngine SSOT builders (timelineTrigger/auditTrigger/notificationTrigger) for the
// same timeline/audit/notification writes as assignRider — no duplicate logic — and the
// ErrorCenter SSOT for failures. Additive fields only (rejectedBy); no new collection.
import { doc, runTransaction, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeStatus } from "../store/orderStatus";
import { timelineTrigger, auditTrigger, notificationTrigger } from "../store/orderEngine";
import { logError } from "../errorCenter";

const READY = "ready_for_delivery";

// An order offered to another rider is off-limits until its offer window expires.
const offeredToOther = (o, riderId) =>
  o.offeredTo && o.offeredTo !== riderId && o.offerExpiresAt && o.offerExpiresAt > Date.now();

// Atomically accept (claim) a ready order. Returns { ok, reason }. Idempotent for the
// same rider; second rider gets { ok:false, reason:"already_taken" }.
export async function acceptOrder(order, rider) {
  const orderId = order?.id;
  if (!orderId || !rider?.uid) return { ok: false, reason: "invalid" };
  const ref = doc(db, "orders", orderId);
  try {
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok: false, reason: "not_found" };
      const o = snap.data();
      if (o.riderId && o.riderId !== rider.uid) return { ok: false, reason: "already_taken" };
      if (o.riderId !== rider.uid && normalizeStatus(o.status) !== READY) return { ok: false, reason: "not_ready" };
      if (offeredToOther(o, rider.uid)) return { ok: false, reason: "offered_to_other" };
      tx.update(ref, {
        riderId: rider.uid,
        riderName: rider.name || "",
        riderPhone: rider.phone || "",
        status: "picked_up",
        // Granular workflow stage (additive) — rider just accepted, heading to the store.
        riderStage: "heading_to_restaurant",
        acceptedAt: serverTimestamp(),
        pickedUpAt: serverTimestamp(),
        // Claimed -> leave the dispatch queue cleanly (clear any live offer state).
        offeredTo: "",
        offerExpiresAt: 0,
        offerCycleRejects: [],
        dispatchPausedUntil: 0,
        timeline: arrayUnion(timelineTrigger("picked_up", rider.uid)),
        audit: arrayUnion(auditTrigger("accept", rider.uid)),
      });
      return { ok: true };
    });
    if (outcome.ok) {
      notificationTrigger({ ...order, id: orderId, status: "picked_up", riderId: rider.uid }, "assigned");
    }
    return outcome;
  } catch (e) {
    logError(e, "acceptOrder");
    return { ok: false, reason: "error" };
  }
}

// Rider declines: record the rejection (additive rejectedBy array) so the order is
// hidden for them and dispatch can skip them. Order stays ready + unassigned. Atomic so
// it never clobbers a concurrent accept. Returns { ok, reason }.
export async function rejectOrder(order, rider) {
  const orderId = order?.id;
  if (!orderId || !rider?.uid) return { ok: false, reason: "invalid" };
  const ref = doc(db, "orders", orderId);
  try {
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok: false, reason: "not_found" };
      if (snap.data().riderId) return { ok: false, reason: "already_taken" };
      tx.update(ref, {
        rejectedBy: arrayUnion(rider.uid),
        audit: arrayUnion(auditTrigger("reject", rider.uid)),
      });
      return { ok: true };
    });
    return outcome;
  } catch (e) {
    logError(e, "rejectOrder");
    return { ok: false, reason: "error" };
  }
}

// Orders a rider has already rejected should be filtered out of their available pool.
export const hasRejected = (order, riderId) =>
  Array.isArray(order?.rejectedBy) && order.rejectedBy.includes(riderId);
