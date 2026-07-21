// ── Rider Dispatch — Firestore engine (transactions) ─────────────────────────────────────────
// The write side of the dispatcher. Every mutation is a Firestore transaction that re-reads the
// order and validates against the live state, so there is NO duplicate assignment and NO race
// even when several online clients tick at once (reqs 10). Decisions come from the pure SSOT in
// dispatchState.js; the timeline/audit builders are reused from orderEngine (no duplicate logic).
//
// Offer fields written on the order doc (additive — schema unchanged):
//   offeredTo (uid) · offerExpiresAt (ms epoch) · offerSeq (n) · offerCycleRejects (uid[]) ·
//   dispatchPausedUntil (ms epoch)
// offerExpiresAt is a client ms timestamp (Date.now()+TTL) so the countdown and needsOffer()
// compare in the same clock the rider's device uses.
import { doc, runTransaction, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { isReadyForDelivery } from "./riderStatus";
import { pickNextRider, OFFER_TTL_MS, REOFFER_GAP_MS } from "./dispatchState";
import { timelineTrigger, auditTrigger } from "../store/orderEngine";
import { logError } from "../errorCenter";

// Offer (or re-offer) an order to the next rider. `ridersNearestFirst` is computed by the caller
// (outside the tx) — the nearest-first roster of eligible online riders. Idempotent & race-safe:
// if the order was claimed, is not ready, already has a live offer, or is paused, it no-ops.
export async function offerNext(orderId, ridersNearestFirst) {
  if (!orderId) return { ok: false, reason: "invalid" };
  const ref = doc(db, "orders", orderId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok: false, reason: "not_found" };
      const o = snap.data();
      if (o.riderId) return { ok: false, reason: "claimed" };
      if (!isReadyForDelivery(o.status)) return { ok: false, reason: "not_ready" };
      const now = Date.now();
      // a live offer to someone is still running — leave it (its owner owns the timeout)
      if (o.offeredTo && Number(o.offerExpiresAt || 0) > now) return { ok: false, reason: "offer_active" };
      // paused for the re-offer gap after a timeout/reject
      if (Number(o.dispatchPausedUntil || 0) > now) return { ok: false, reason: "paused" };

      // reclaim an EXPIRED offer: the rider who timed out silently joins this cycle's rejects,
      // so a disappeared/offline offered-rider can never strand the order (any online tick heals it)
      const cycleRejects = Array.isArray(o.offerCycleRejects) ? o.offerCycleRejects.slice() : [];
      if (o.offeredTo && !cycleRejects.includes(o.offeredTo)) cycleRejects.push(o.offeredTo);

      const { rider, newCycle } = pickNextRider(ridersNearestFirst, cycleRejects);
      if (!rider) return { ok: false, reason: "no_riders" };

      tx.update(ref, {
        offeredTo: rider.uid,
        offerExpiresAt: now + OFFER_TTL_MS,
        offerSeq: (o.offerSeq || 0) + 1,
        offerCycleRejects: newCycle ? [] : cycleRejects, // new cycle wipes the reject set (cycle forever)
        dispatchPausedUntil: 0,
        timeline: arrayUnion(timelineTrigger("offered", rider.uid)),
        audit: arrayUnion(auditTrigger("dispatch:offer", rider.uid)),
      });
      return { ok: true, offeredTo: rider.uid, newCycle };
    });
  } catch (e) {
    logError(e, "dispatch.offerNext");
    return { ok: false, reason: "error" };
  }
}

// The offered rider declines (reject) or their countdown expired (timeout). Returns the order to
// Pending (clears the offer) and records the rider in the cycle-reject set, then pauses briefly so
// the next tick offers the next rider (or, for a single rider, re-offers after the gap). The order
// is NEVER deleted. Only the currently-offered rider may decline their own offer.
export async function declineOffer(orderId, riderId, reason = "timeout") {
  if (!orderId || !riderId) return { ok: false, reason: "invalid" };
  const ref = doc(db, "orders", orderId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok: false, reason: "not_found" };
      const o = snap.data();
      if (o.riderId) return { ok: false, reason: "claimed" };
      if (o.offeredTo !== riderId) return { ok: false, reason: "not_offered" };
      const cycleRejects = Array.isArray(o.offerCycleRejects) ? o.offerCycleRejects.slice() : [];
      if (!cycleRejects.includes(riderId)) cycleRejects.push(riderId);
      tx.update(ref, {
        offeredTo: "",
        offerExpiresAt: 0,
        offerCycleRejects: cycleRejects,
        dispatchPausedUntil: Date.now() + REOFFER_GAP_MS,
        audit: arrayUnion(auditTrigger(`dispatch:${reason}`, riderId)),
      });
      return { ok: true };
    });
  } catch (e) {
    logError(e, "dispatch.declineOffer");
    return { ok: false, reason: "error" };
  }
}
