// Offline unit tests for the dispatch state machine + selection logic (src/rider/dispatchState.js).
// Proves the reqs that are pure decisions: nearest-first (1/2/3 riders), reject→next, cycle-forever,
// timeout→pending, offer freshness, and dispatch-state derivation. Firestore transactions
// (dispatchEngine.js) are integration-tested against the emulator separately.
import {
  DISPATCH, OFFER_TTL_MS, offerActive, offerRemainingMs, dispatchStateOf,
  isDispatchable, sortRidersByDistance, pickNextRider, needsOffer,
} from "../src/rider/dispatchState.js";

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.error(`FAIL: ${msg}`); } };
const eq = (a, b, msg) => ok(a === b, `${msg} — got ${a}, expected ${b}`);

// haversine stub is unnecessary; use a trivial planar distance for deterministic ordering.
const dist = (aLat, aLng, bLat, bLng) => Math.hypot(aLat - bLat, aLng - bLng);
const store = { lat: 0, lng: 0 };

const R = (uid, lat, lng) => ({ uid, location: lat == null ? null : { lat, lng } });
const r1 = R("r1", 1, 0);   // dist 1
const r2 = R("r2", 3, 0);   // dist 3
const r3 = R("r3", 2, 0);   // dist 2
const rNo = R("rNo", null); // unknown location -> sorts last

// ── nearest-first ordering (req 5) ──
const sorted = sortRidersByDistance([r2, rNo, r1, r3], store, dist).map((r) => r.uid);
eq(sorted.join(","), "r1,r3,r2,rNo", "nearest-first: r1(1) < r3(2) < r2(3) < rNo(∞)");

// ── one rider: always picks it; after it rejects, new cycle re-offers the SAME rider (req 4) ──
eq(pickNextRider([r1], []).rider.uid, "r1", "1 rider: offer r1");
const oneAfterReject = pickNextRider([r1], ["r1"]);
eq(oneAfterReject.rider.uid, "r1", "1 rider: all-declined -> new cycle re-offers r1");
ok(oneAfterReject.newCycle === true, "1 rider: re-offer flagged as new cycle");

// ── two/three riders: reject/timeout advances to the next nearest, then cycles back (reqs 5,6) ──
const order3 = sortRidersByDistance([r1, r2, r3], store, dist); // r1,r3,r2
eq(pickNextRider(order3, []).rider.uid, "r1", "3 riders: first offer -> nearest r1");
eq(pickNextRider(order3, ["r1"]).rider.uid, "r3", "r1 declined -> next nearest r3");
eq(pickNextRider(order3, ["r1", "r3"]).rider.uid, "r2", "r1,r3 declined -> r2");
const cycled = pickNextRider(order3, ["r1", "r3", "r2"]);
eq(cycled.rider.uid, "r1", "all declined -> cycle back to first (r1)");
ok(cycled.newCycle === true, "full cycle -> newCycle true");

// ── two riders ──
const order2 = sortRidersByDistance([r1, r2], store, dist);
eq(pickNextRider(order2, ["r1"]).rider.uid, "r2", "2 riders: r1 declined -> r2");
ok(pickNextRider(order2, ["r1", "r2"]).newCycle === true, "2 riders: both declined -> new cycle");

// ── offer freshness / remaining time (survives refresh via offerExpiresAt) ──
const NOW = 1_000_000;
const offered = { status: "ready_for_delivery", offeredTo: "r1", offerExpiresAt: NOW + OFFER_TTL_MS };
ok(offerActive(offered, NOW), "offer with future expiry is active");
ok(!offerActive({ ...offered, offerExpiresAt: NOW - 1 }, NOW), "expired offer is not active");
eq(offerRemainingMs(offered, NOW), OFFER_TTL_MS, "remaining = full TTL at offer time");
eq(offerRemainingMs({ ...offered, offerExpiresAt: NOW - 5 }, NOW), 0, "remaining clamps to 0 when expired");

// ── needsOffer gate ──
ok(needsOffer({ status: "ready_for_delivery", riderId: "" }, NOW), "ready+unassigned+no offer -> needs offer");
ok(!needsOffer(offered, NOW), "live offer -> does not need offer");
ok(!needsOffer({ status: "ready_for_delivery", riderId: "r1" }, NOW), "assigned -> not dispatchable");
ok(!needsOffer({ status: "ready_for_delivery", dispatchPausedUntil: NOW + 1000 }, NOW), "paused -> no offer yet");
ok(!needsOffer({ status: "cooking", riderId: "" }, NOW), "not ready yet -> not dispatchable");

// ── dispatchable / state derivation (req 9) ──
ok(isDispatchable({ status: "ready_for_delivery", riderId: "" }), "ready+unassigned dispatchable");
ok(!isDispatchable({ status: "completed" }), "completed not dispatchable");
eq(dispatchStateOf({ status: "ready_for_delivery", riderId: "" }, NOW), DISPATCH.PENDING, "ready+unassigned = pending");
eq(dispatchStateOf(offered, NOW), DISPATCH.OFFERED, "live offer = offered");
eq(dispatchStateOf({ status: "picked_up", riderId: "r1", riderStage: "heading_to_restaurant" }, NOW), DISPATCH.ACCEPTED, "picked_up+heading = accepted");
eq(dispatchStateOf({ status: "picked_up", riderId: "r1", riderStage: "arrived_at_restaurant" }, NOW), DISPATCH.ARRIVED_STORE, "arrived stage = arrived_store");
eq(dispatchStateOf({ status: "picked_up", riderId: "r1", riderStage: "heading_to_customer" }, NOW), DISPATCH.PICKED_UP, "heading to customer = picked_up");
eq(dispatchStateOf({ status: "delivering", riderId: "r1" }, NOW), DISPATCH.DELIVERING, "delivering");
eq(dispatchStateOf({ status: "completed" }, NOW), DISPATCH.COMPLETED, "completed");
eq(dispatchStateOf({ status: "cancelled" }, NOW), DISPATCH.CANCELLED, "cancelled");
// legacy Thai ready alias still dispatches
eq(dispatchStateOf({ status: "ส่งให้ไรเดอร์", riderId: "" }, NOW), DISPATCH.PENDING, "legacy ready alias = pending");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
