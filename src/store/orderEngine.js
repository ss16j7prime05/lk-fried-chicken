// Shared Order Engine — Single Source of Truth for order state transitions
// (Phase 3.8). Every role (Customer/Store/Rider/Admin) routes lifecycle changes
// through here instead of calling updateDoc() on orders directly. It REUSES the
// existing utils — no duplicated logic, no new collection:
//   money      -> ./orderTotals (recalcOrder) + ./orderEdit (saveOrderEdit)
//   payment    -> ../payment/paymentUtils (approve/reject/submit/expire)
//   notify     -> ../notifications/notificationUtils (SSOT emitters)
//   status map -> ./orderStatus (normalizeStatus)
// timeline/audit are additive array fields on the existing order doc (arrayUnion),
// exactly like editHistory in orderEdit — not a new Firestore collection.

import { doc, updateDoc, runTransaction, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../errorCenter";
import { normalizeStatus } from "./orderStatus";
import { recalcOrder } from "./orderTotals";
import { saveOrderEdit } from "./orderEdit";
import {
  notifyCustomer, notifyStore, notifyRider, NOTIF_TYPE,
} from "../notifications/notificationUtils";
import { sendOrderFlex } from "../notifications/flexMessage";

// Canonical status enum (maps onto the existing order.status / payment.status —
// the data model is unchanged). Delivery-lifecycle values drive transitions;
// payment-dimension values are handled via paymentService.
export const ORDER_STATUS = {
  NEW: "pending",
  WAITING_PAYMENT: "waiting_payment",
  PENDING_REVIEW: "pending_verification",
  PAID: "approved",
  ACCEPTED: "accepted",
  COOKING: "cooking",
  READY_FOR_DELIVERY: "ready_for_delivery",
  ASSIGNED: "picked_up",
  PICKED_UP: "picked_up",
  DELIVERING: "delivering",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  EXPIRED: "expired",
};

// Allowed delivery-lifecycle transitions (cancel is allowed from any live state,
// handled in cancelOrder). normalizeStatus() folds legacy Thai statuses in.
const TRANSITIONS = {
  pending: ["accepted", "cancelled"],
  accepted: ["cooking", "cancelled"],
  cooking: ["ready_for_delivery", "cancelled"],
  ready_for_delivery: ["picked_up", "cancelled"],
  picked_up: ["delivering", "cancelled"],
  delivering: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const validateTransition = (from, to) => {
  const f = normalizeStatus(from);
  return f === to || (TRANSITIONS[f] || []).includes(to);
};

// timeline/audit entry builders (arrayUnion cannot hold serverTimestamp()).
export const timelineTrigger = (status, by = "") => ({ status, by, at: Date.now() });
export const auditTrigger = (action, by = "", meta = null) => ({ action, by, at: Date.now(), meta });

const stampFor = (to) => {
  const now = serverTimestamp();
  switch (to) {
    case "accepted": return { acceptedAt: now };
    case "picked_up": return { pickedUpAt: now };
    case "completed": return { deliveredAt: now };
    case "cancelled": return { cancelledAt: now };
    default: return {};
  }
};

// The ONLY place order.status changes for the delivery lifecycle. One write
// carries status + milestone timestamp + timeline + audit; notifications fire after.
//
// ATOMIC (transaction): เดิมตรวจ `order.status` จาก snapshot ในเครื่องผู้เรียกแล้ว updateDoc ทับลงไปตรง ๆ
// ซึ่งเป็น read-modify-write ที่ไม่มีการกันชน — สองบทบาทกดพร้อมกันเขียนทับกันเงียบ ๆ ได้ เช่น
// ร้านกดยกเลิกตอนไรเดอร์กด "ส่งสำเร็จ" หรือ list ในเครื่องล้าหลังอยู่ 1 step แล้วกดปุ่ม
// = สถานะ "เดินถอยหลัง" (ready_for_delivery -> cooking) ทั้งที่กราฟไม่อนุญาต
// ตอนนี้ re-read เอกสารใน transaction แล้วตรวจกับสถานะ "สด" จาก server ก่อนเขียนเสมอ
//
// คืน { ok, reason } เหมือน riderAcceptReject/orderStateMachine (ไม่ throw) — ผู้เรียกเดิม
// ไม่มีใคร try/catch อยู่แล้ว ของเดิม error จึงกลายเป็น unhandled rejection; ตอนนี้ลง ErrorCenter
export async function updateOrderStatus(order, to, { by = "", patch = {}, event = to, force = false } = {}) {
  if (!order?.id || !to) return { ok: false, reason: "invalid" };
  const ref = doc(db, "orders", order.id);
  try {
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok: false, reason: "not_found" };
      const current = snap.data();
      // ตรวจกับสถานะสดเสมอ (force = ข้ามกราฟ เช่น admin/bulk ของร้าน — พฤติกรรมเดิมคงไว้)
      if (!force && !validateTransition(current.status, to)) {
        return { ok: false, reason: "invalid_transition", from: current.status, to };
      }
      tx.update(ref, {
        status: to,
        ...stampFor(to),
        ...patch,
        timeline: arrayUnion(timelineTrigger(to, by)),
        audit: arrayUnion(auditTrigger(`status:${to}`, by)),
      });
      return { ok: true, current };
    });
    // แจ้งเตือนเฉพาะเมื่อเขียนสำเร็จจริง และใช้ข้อมูลสดจาก server เติมให้ด้วย —
    // ผู้เรียกบางที่ส่งมาแค่ { id } (StoreLayout/Kitchen ตอนหาในลิสต์ไม่เจอ) ซึ่งเดิมทำให้
    // notifyCustomer(order.phone = undefined) = ลูกค้าไม่ได้รับแจ้งเลย
    if (outcome.ok) {
      notificationTrigger({ ...order, ...outcome.current, id: order.id, status: to }, event);
      return { ok: true };
    }
    return outcome;
  } catch (e) {
    logError(e, "updateOrderStatus");
    return { ok: false, reason: "error" };
  }
}

// Rider takes a ready job: ready_for_delivery -> picked_up (+ rider identity).
export async function assignRider(order, rider = {}) {
  if (!order?.id || !validateTransition(order.status, "picked_up")) return;
  await updateDoc(doc(db, "orders", order.id), {
    riderId: rider.uid || "",
    riderName: rider.name || "",
    riderPhone: rider.phone || "",
    status: "picked_up",
    acceptedAt: serverTimestamp(),
    pickedUpAt: serverTimestamp(),
    timeline: arrayUnion(timelineTrigger("picked_up", rider.uid || "")),
    audit: arrayUnion(auditTrigger("assign_rider", rider.uid || "")),
  });
  notificationTrigger({ ...order, status: "picked_up" }, "assigned");
}

export const completeOrder = (order, by = "") =>
  updateOrderStatus(order, "completed", { by, event: "completed" });

// Cancel is reachable from any live state (skips the linear graph).
export async function cancelOrder(order, { by = "", reason = "" } = {}) {
  if (!order?.id) return;
  await updateDoc(doc(db, "orders", order.id), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    cancelledBy: by,
    cancelReason: reason || null,
    timeline: arrayUnion(timelineTrigger("cancelled", by)),
    audit: arrayUnion(auditTrigger("cancel", by, { reason })),
  });
  notificationTrigger({ ...order, status: "cancelled" }, "cancelled");
}

// Append a timeline + audit entry for a non-status event (e.g. a payment action).
// Reused by paymentService so payment events feed the same timeline/audit trail.
export async function recordEvent(orderId, action, by = "", label = null) {
  if (!orderId) return;
  await updateDoc(doc(db, "orders", orderId), {
    timeline: arrayUnion(timelineTrigger(label || action, by)),
    audit: arrayUnion(auditTrigger(action, by)),
  });
}

// Money math (reuse). calculateOrder = pure recompute; applyOrderEdit = persist a store edit.
export const calculateOrder = (items, base = {}) => recalcOrder(items, base);
export const applyOrderEdit = (order, edit) => saveOrderEdit(order, edit);

// Central notification dispatch for lifecycle events — the emit logic that used
// to live inline in each role's file now lives here once (SSOT).
export function notificationTrigger(order, event) {
  const id = order.id;
  const no = order.orderNo || id;
  const custUrl = `/shop/orders/${id}`;
  // Additive LINE Flex for the customer lifecycle (Phase 6.0C) — flag-gated + fail-soft
  // inside sendOrderFlex, so with enableLineOA OFF this is a no-op (backward compatible).
  sendOrderFlex({ ...order, actionUrl: custUrl }, event);
  switch (event) {
    case "accepted":
      notifyCustomer(order.phone, { type: NOTIF_TYPE.STORE_ACCEPTED, orderId: id, actionUrl: custUrl, message: `ร้านรับออเดอร์ ${no} แล้ว` });
      break;
    case "cooking":
      notifyCustomer(order.phone, { type: NOTIF_TYPE.COOKING, orderId: id, actionUrl: custUrl, message: `ร้านกำลังทำอาหารออเดอร์ ${no}` });
      break;
    case "ready_for_delivery":
      notifyCustomer(order.phone, { type: NOTIF_TYPE.COOKED, orderId: id, actionUrl: custUrl, message: `ออเดอร์ ${no} ทำอาหารเสร็จแล้ว` });
      notifyRider("", { type: NOTIF_TYPE.NEW_JOB, orderId: id, actionUrl: "/rider", message: `มีงานใหม่ ออเดอร์ ${no} พร้อมจัดส่ง` });
      break;
    case "assigned":
      notifyCustomer(order.phone, { type: NOTIF_TYPE.RIDER_ASSIGNED, orderId: id, actionUrl: custUrl, message: `ไรเดอร์รับงานออเดอร์ ${no} แล้ว` });
      notifyStore({ type: NOTIF_TYPE.RIDER_ASSIGNED, orderId: id, actionUrl: "/store/orders", message: `ไรเดอร์รับงานออเดอร์ ${no}` });
      break;
    case "delivering":
      notifyCustomer(order.phone, { type: NOTIF_TYPE.RIDER_DELIVERING, orderId: id, actionUrl: custUrl, message: `ไรเดอร์กำลังจัดส่งออเดอร์ ${no}` });
      break;
    case "completed":
      notifyCustomer(order.phone, { type: NOTIF_TYPE.DELIVERED, orderId: id, actionUrl: custUrl, message: `ออเดอร์ ${no} จัดส่งสำเร็จ` });
      notifyStore({ type: NOTIF_TYPE.RIDER_DELIVERED, orderId: id, actionUrl: "/store/orders", message: `ไรเดอร์ส่งออเดอร์ ${no} สำเร็จ` });
      break;
    case "cancelled":
      notifyCustomer(order.phone, { type: NOTIF_TYPE.ORDER_CANCELLED, orderId: id, actionUrl: custUrl, message: `ออเดอร์ ${no} ถูกยกเลิก` });
      if (order.riderId) notifyRider(order.riderId, { type: NOTIF_TYPE.JOB_CANCELLED, orderId: id, actionUrl: "/rider", message: `งานออเดอร์ ${no} ถูกยกเลิก` });
      break;
    default:
      break;
  }
}
