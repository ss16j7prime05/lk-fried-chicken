// Shared Payment Service — Single Source of Truth for payment actions (Phase 3.9).
// Every role routes payment operations through here. It REUSES the existing code,
// no new architecture / collection / duplicated logic:
//   order write + notification -> ./paymentUtils (which emits via notificationUtils)
//   timeline + audit trail      -> ../store/orderEngine (recordEvent)
// Payment constants/helpers are re-exported so callers can import everything from
// this one module.

import {
  approvePayment as _approve,
  rejectPayment as _reject,
  submitSlip as _submitSlip,
  expireOrderPayment as _expire,
} from "./paymentUtils";
import { recordEvent } from "../store/orderEngine";

export {
  PAYMENT_STATUS, CANCEL_REASON, PAYMENT_WINDOW_MS, requiresCountdown,
  paymentExpireTimestamp, toMillis, countdownFrom, uploadSlip, isCashOrder,
  isPaymentSettled, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_COLOR,
} from "./paymentUtils";

const oid = (order) => order?.id || order;

// Store approves a slip -> PAID.
export async function approve(order, reviewer) {
  await _approve(oid(order), reviewer, order);
  await recordEvent(oid(order), "payment:approved", reviewer);
}

// Store rejects a slip -> REJECTED (customer can re-upload).
export async function reject(order, reviewer, reason) {
  await _reject(oid(order), reviewer, reason, order);
  await recordEvent(oid(order), "payment:rejected", reviewer);
}

// Customer submits / re-uploads a slip -> PENDING_REVIEW.
export async function submitSlip(order, slipUrl) {
  await _submitSlip(oid(order), slipUrl, order);
  await recordEvent(oid(order), "payment:slip_submitted", order?.phone || "");
}

// Payment window elapsed -> EXPIRED + order cancelled (idempotent inside paymentUtils).
export async function expire(order) {
  await _expire(order);
  await recordEvent(oid(order), "payment:expired");
}
