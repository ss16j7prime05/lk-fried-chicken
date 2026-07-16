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

// Action-bar config for the current status. `to` is the next existing state to
// transition into; `navTarget` is which map point the secondary "Navigate" opens.
export function jobActionFor(status) {
  const s = normalizeStatus(status);
  if (s === PICKED_UP_STATUS)
    return { kind: "pickup", to: DELIVERING_STATUS, labelKey: "ro.action.foodPickedUp", navKey: "ro.action.goToStore", navTarget: "store" };
  if (s === DELIVERING_STATUS)
    return { kind: "deliver", to: DELIVERED_STATUS, labelKey: "ro.action.deliveryComplete", navKey: "ro.action.goToCustomer", navTarget: "customer" };
  if (s === DELIVERED_STATUS) return { kind: "done" };
  if (s === READY_STATUS || isReadyForDelivery(s)) return { kind: "accept" };
  return { kind: "none" };
}
