// Rider job flow — pure presentation mapping over the EXISTING order states.
// No new backend states: we only translate the current status into a timeline step
// and an action-button config. State transitions still go through the existing
// orderStateMachine (ready_for_delivery → picked_up → delivering → completed).
// Rider timeline steps — pure presentation over the order status. The granular action
// flow now lives in riderStage.js (riderStageAction); this only feeds RiderTimeline.
import { normalizeStatus } from "../store/orderStatus";
import { PICKED_UP_STATUS, DELIVERING_STATUS, DELIVERED_STATUS } from "./riderStatus";

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
