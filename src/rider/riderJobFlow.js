// Rider job flow — pure presentation mapping over the EXISTING order states.
// No new backend states: we only translate the current status into a timeline step
// and an action-button config. State transitions still go through the existing
// orderStateMachine (ready_for_delivery → picked_up → delivering → completed).
import { normalizeStatus } from "../store/orderStatus";
import {
  READY_STATUS, PICKED_UP_STATUS, DELIVERING_STATUS, DELIVERED_STATUS, isReadyForDelivery,
} from "./riderStatus";

// Timeline steps for an accepted job (label keys → ro.step.*).
export const FLOW_STEPS = ["accepted", "atStore", "delivering", "delivered"];

// Index of the CURRENT step from the order status (0..3). Steps < index are done,
// == index is current, > index are pending.
export function flowStepIndex(status) {
  const s = normalizeStatus(status);
  if (s === DELIVERED_STATUS) return 3;   // completed → delivered
  if (s === DELIVERING_STATUS) return 2;  // en route to customer
  if (s === PICKED_UP_STATUS) return 1;   // accepted, heading to / at store
  return 0;                               // ready_for_delivery (not yet accepted)
}

// Action kind for the current status. RiderJobActionBar renders the buttons per kind
// and owns the labels; the transitions themselves are hardcoded in RiderJobDetails.
export function jobActionFor(status) {
  const s = normalizeStatus(status);
  if (s === PICKED_UP_STATUS) return { kind: "pickup" };
  if (s === DELIVERING_STATUS) return { kind: "deliver" };
  if (s === DELIVERED_STATUS) return { kind: "done" };
  if (s === READY_STATUS || isReadyForDelivery(s)) return { kind: "accept" };
  return { kind: "none" };
}
