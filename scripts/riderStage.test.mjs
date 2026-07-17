// Offline unit tests for the granular rider stage + customer status derivation.
// Run with: npm test
import {
  RIDER_STAGE, CUSTOMER_STATUS, deriveCustomerStatus, riderStageAction, withinGeofence, customerStatusIndex,
} from "../src/rider/riderStage.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const cs = (order) => deriveCustomerStatus(order);
const act = (order) => riderStageAction(order).kind;

// --- customer status derivation (the 10 real-time steps) ---
ok(cs({ status: "pending" }) === CUSTOMER_STATUS.PENDING, "pending");
ok(cs({ status: "accepted" }) === CUSTOMER_STATUS.STORE_ACCEPTED, "store accepted");
ok(cs({ status: "cooking" }) === CUSTOMER_STATUS.STORE_PREPARING, "store preparing");
ok(cs({ status: "ready_for_delivery" }) === CUSTOMER_STATUS.STORE_PREPARING, "ready = preparing");
ok(cs({ status: "picked_up" }) === CUSTOMER_STATUS.RIDER_ACCEPTED, "picked_up no stage = rider accepted (legacy)");
ok(cs({ status: "picked_up", riderStage: RIDER_STAGE.HEADING_TO_RESTAURANT }) === CUSTOMER_STATUS.HEADING_TO_RESTAURANT, "heading to restaurant");
ok(cs({ status: "picked_up", riderStage: RIDER_STAGE.ARRIVED_AT_RESTAURANT }) === CUSTOMER_STATUS.ARRIVED_AT_RESTAURANT, "arrived at restaurant");
ok(cs({ status: "delivering", riderStage: RIDER_STAGE.HEADING_TO_CUSTOMER }) === CUSTOMER_STATUS.HEADING_TO_CUSTOMER, "heading to customer");
ok(cs({ status: "delivering", riderStage: RIDER_STAGE.HEADING_TO_CUSTOMER, nearPressed: true }) === CUSTOMER_STATUS.NEARBY, "nearby (nearPressed)");
ok(cs({ status: "delivering", riderStage: RIDER_STAGE.ARRIVED_AT_CUSTOMER }) === CUSTOMER_STATUS.ARRIVED, "arrived at customer");
ok(cs({ status: "delivering" }) === CUSTOMER_STATUS.HEADING_TO_CUSTOMER, "delivering no stage (legacy) = heading to customer");
ok(cs({ status: "completed" }) === CUSTOMER_STATUS.COMPLETED, "completed");
ok(cs({ status: "cancelled" }) === CUSTOMER_STATUS.CANCELLED, "cancelled");
// legacy Thai status normalizes
ok(cs({ status: "เสร็จสิ้น" }) === CUSTOMER_STATUS.COMPLETED, "legacy thai completed");

// --- stepper ordering (monotonic non-decreasing through the flow) ---
const seq = [
  cs({ status: "accepted" }),
  cs({ status: "cooking" }),
  cs({ status: "picked_up", riderStage: RIDER_STAGE.HEADING_TO_RESTAURANT }),
  cs({ status: "picked_up", riderStage: RIDER_STAGE.ARRIVED_AT_RESTAURANT }),
  cs({ status: "delivering", riderStage: RIDER_STAGE.HEADING_TO_CUSTOMER }),
  cs({ status: "delivering", riderStage: RIDER_STAGE.ARRIVED_AT_CUSTOMER }),
  cs({ status: "completed" }),
].map(customerStatusIndex);
ok(seq.every((v, i) => i === 0 || v >= seq[i - 1]), "customer status index is monotonic through the flow");

// --- rider action mapping ---
ok(act({ status: "ready_for_delivery" }) === "accept", "action: accept");
ok(act({ status: "picked_up", riderStage: RIDER_STAGE.HEADING_TO_RESTAURANT }) === "arrive_restaurant", "action: arrive_restaurant");
ok(act({ status: "picked_up", riderStage: RIDER_STAGE.ARRIVED_AT_RESTAURANT }) === "confirm_pickup", "action: confirm_pickup");
ok(act({ status: "delivering", riderStage: RIDER_STAGE.HEADING_TO_CUSTOMER }) === "arrive_customer", "action: arrive_customer");
ok(act({ status: "delivering", riderStage: RIDER_STAGE.ARRIVED_AT_CUSTOMER }) === "confirm_delivery", "action: confirm_delivery");
ok(act({ status: "completed" }) === "done", "action: done");
ok(act({ status: "picked_up" }) === "arrive_restaurant", "action: legacy picked_up -> arrive_restaurant");

// --- geofence (fail-open) ---
ok(withinGeofence(null) === true, "geofence fail-open when no location");
ok(withinGeofence(0.1) === true, "geofence within 200m");
ok(withinGeofence(1.5) === false, "geofence outside");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
