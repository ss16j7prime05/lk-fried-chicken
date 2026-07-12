// Shared Order State Machine (SSOT, Phase 5.4) — the single guarded entry for every
// order transition. Reuses the orderEngine graph (validateTransition) and writers
// (updateOrderStatus / cancelOrder, which already stamp timeline + audit + notification
// via their builders — no duplicated logic), the orderStatus SSOT status list, and
// ErrorCenter. Validates every transition and rejects invalid ones with a structured
// reason. Additive facade: orderEngine remains callable directly; no new collection.
import { validateTransition, updateOrderStatus, cancelOrder } from "./orderEngine";
import { ORDER_STATUSES, normalizeStatus } from "./orderStatus";
import { logError } from "../errorCenter";

// Canonical lifecycle states (+ cancelled terminal). Reuses the orderStatus list.
export const STATES = [...ORDER_STATUSES, "cancelled"];
const TERMINAL = new Set(["completed", "cancelled"]);

export const isTerminal = (status) => TERMINAL.has(normalizeStatus(status));
export const isActive = (status) => !isTerminal(status);

// Reuse the orderEngine transition graph (single source — no duplicate graph).
export const canTransition = (from, to) => validateTransition(from, to);

// Allowed next states from a status, derived via validateTransition (no duplicate graph).
export const nextStates = (status) => {
  const from = normalizeStatus(status);
  return STATES.filter((s) => s !== from && canTransition(from, s));
};

// The ONE guarded transition. Validates, rejects invalid, else routes through the
// orderEngine writer (status + timeline + audit + notification). Returns { ok, reason }.
export async function transition(order, to, opts = {}) {
  if (!order?.id || !to) return { ok: false, reason: "invalid" };
  const from = normalizeStatus(order.status);
  if (isTerminal(from)) return { ok: false, reason: "terminal", from };
  if (to === "cancelled") {
    try {
      await cancelOrder(order, opts);
      return { ok: true };
    } catch (e) {
      logError(e, "transition:cancel");
      return { ok: false, reason: "error" };
    }
  }
  if (!canTransition(from, to)) return { ok: false, reason: "invalid_transition", from, to };
  try {
    await updateOrderStatus(order, to, opts);
    return { ok: true };
  } catch (e) {
    logError(e, "transition");
    return { ok: false, reason: "error" };
  }
}
