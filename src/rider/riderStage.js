// Granular rider delivery stage — an ADDITIVE order field (order.riderStage) layered on
// top of the existing status machine. The `status` field is left exactly as it is
// (accepted → picked_up → delivering → completed) so Store/Admin/queries/firestore.rules
// keep working unchanged; riderStage only adds finer steps within picked_up / delivering.
//
// Backward compatibility: old orders have no riderStage. Every reader here derives a
// sensible stage/status from `status` alone when riderStage is absent, so existing orders
// and users keep working with no migration write required.
import { normalizeStatus } from "../store/orderStatus.js";

export const RIDER_STAGE = {
  HEADING_TO_RESTAURANT: "heading_to_restaurant", // accepted, en route to store   (status: picked_up)
  ARRIVED_AT_RESTAURANT: "arrived_at_restaurant", // at store, before food pickup   (status: picked_up)
  HEADING_TO_CUSTOMER: "heading_to_customer",     // food picked up, en route        (status: delivering)
  ARRIVED_AT_CUSTOMER: "arrived_at_customer",     // at customer, before hand-off    (status: delivering)
  DELIVERED: "delivered",                         // handed off                      (status: completed)
};

// Customer-facing real-time status (the 10 steps the customer sees). Derived only — not
// a stored field — from status + riderStage + nearPressed.
export const CUSTOMER_STATUS = {
  PENDING: "pending",
  STORE_ACCEPTED: "store_accepted",
  STORE_PREPARING: "store_preparing",
  RIDER_ACCEPTED: "rider_accepted",
  HEADING_TO_RESTAURANT: "heading_to_restaurant",
  ARRIVED_AT_RESTAURANT: "arrived_at_restaurant",
  HEADING_TO_CUSTOMER: "heading_to_customer",
  NEARBY: "nearby",
  ARRIVED: "arrived",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// Ordered progression for the customer stepper (completed steps light up to here).
export const CUSTOMER_STATUS_ORDER = [
  CUSTOMER_STATUS.STORE_ACCEPTED,
  CUSTOMER_STATUS.STORE_PREPARING,
  CUSTOMER_STATUS.RIDER_ACCEPTED,
  CUSTOMER_STATUS.HEADING_TO_RESTAURANT,
  CUSTOMER_STATUS.ARRIVED_AT_RESTAURANT,
  CUSTOMER_STATUS.HEADING_TO_CUSTOMER,
  CUSTOMER_STATUS.NEARBY,
  CUSTOMER_STATUS.ARRIVED,
  CUSTOMER_STATUS.COMPLETED,
];

// The real-time status the customer should see, derived from the order document.
export function deriveCustomerStatus(order) {
  const s = normalizeStatus(order?.status);
  if (s === "completed") return CUSTOMER_STATUS.COMPLETED;
  if (s === "cancelled") return CUSTOMER_STATUS.CANCELLED;

  const stage = order?.riderStage;
  // en route to / at the customer
  if (s === "delivering" || stage === RIDER_STAGE.HEADING_TO_CUSTOMER || stage === RIDER_STAGE.ARRIVED_AT_CUSTOMER) {
    if (stage === RIDER_STAGE.ARRIVED_AT_CUSTOMER) return CUSTOMER_STATUS.ARRIVED;
    if (order?.nearPressed) return CUSTOMER_STATUS.NEARBY;
    return CUSTOMER_STATUS.HEADING_TO_CUSTOMER;
  }
  // rider assigned, going to / at the restaurant
  if (s === "picked_up") {
    if (stage === RIDER_STAGE.ARRIVED_AT_RESTAURANT) return CUSTOMER_STATUS.ARRIVED_AT_RESTAURANT;
    if (stage === RIDER_STAGE.HEADING_TO_RESTAURANT) return CUSTOMER_STATUS.HEADING_TO_RESTAURANT;
    return CUSTOMER_STATUS.RIDER_ACCEPTED; // just accepted (or legacy order with no stage)
  }
  if (s === "cooking" || s === "ready_for_delivery") return CUSTOMER_STATUS.STORE_PREPARING;
  if (s === "accepted") return CUSTOMER_STATUS.STORE_ACCEPTED;
  return CUSTOMER_STATUS.PENDING;
}

export const customerStatusIndex = (cs) => CUSTOMER_STATUS_ORDER.indexOf(cs);

// Rider-facing workflow milestones for the active-job timeline (5 clean steps that fit
// mobile). Derived from status + riderStage — no new stored field. Label keys → ro.step.*
export const RIDER_FLOW_STEPS = ["toStore", "atStore", "toCustomer", "atCustomer", "done"];

// Index of the CURRENT rider milestone (0..4). < index = done, == current, > = pending.
export function riderFlowStepIndex(order) {
  const s = normalizeStatus(order?.status);
  const stage = order?.riderStage;
  if (s === "completed") return 4;
  if (s === "delivering") return stage === RIDER_STAGE.ARRIVED_AT_CUSTOMER ? 3 : 2;
  if (s === "picked_up") return stage === RIDER_STAGE.ARRIVED_AT_RESTAURANT ? 1 : 0;
  return 0; // ready_for_delivery / just accepted
}

// The rider's next action for the current order (stage-aware). Drives the action bar.
// kinds: accept | arrive_restaurant | confirm_pickup | arrive_customer | confirm_delivery | done | none
export function riderStageAction(order) {
  const s = normalizeStatus(order?.status);
  const stage = order?.riderStage;
  if (s === "completed") return { kind: "done" };
  if (s === "delivering") {
    return stage === RIDER_STAGE.ARRIVED_AT_CUSTOMER ? { kind: "confirm_delivery" } : { kind: "arrive_customer" };
  }
  if (s === "picked_up") {
    return stage === RIDER_STAGE.ARRIVED_AT_RESTAURANT ? { kind: "confirm_pickup" } : { kind: "arrive_restaurant" };
  }
  if (s === "ready_for_delivery" || s === "กำลังจัดส่ง" || s === "ส่งให้ไรเดอร์") return { kind: "accept" };
  return { kind: "none" };
}

// Is the rider physically at the target (geofence)? Fail-open: with no location we return
// true so a GPS problem can never block a real delivery. distanceKm is haversine km.
export const GEOFENCE_KM = 0.2; // 200 m
export const withinGeofence = (distanceKm) =>
  distanceKm == null || Number(distanceKm) <= GEOFENCE_KM;
