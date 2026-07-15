// Notification Center — Single Source of Truth (Phase 3.7G).
// The ONE writer/reader helper for the `notifications` Firestore collection.
// Recipient key (`userId`) is heterogeneous, matching how each role is already
// identified elsewhere in the app:
//   customer -> phone   (orders are matched by phone, not uid)
//   rider    -> uid     (orders.riderId == uid)
//   store    -> ""      (single store: role-broadcast)
//   admin    -> ""      (role-broadcast)
// No component re-implements create/read/delete — everything routes through here.

import {
  collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export const NOTIF_COLLECTION = "notifications";

export const ROLE = { CUSTOMER: "customer", STORE: "store", RIDER: "rider", ADMIN: "admin" };

export const PRIORITY = { HIGH: "high", NORMAL: "normal", LOW: "low" };

// Canonical notification types (SSOT). Grouped by audience for readability.
export const NOTIF_TYPE = {
  // customer
  STORE_ACCEPTED: "store_accepted",
  COOKING: "cooking",
  COOKED: "cooked",
  RIDER_ASSIGNED: "rider_assigned",
  RIDER_ARRIVED: "rider_arrived",
  RIDER_DELIVERING: "rider_delivering",
  DELIVERED: "delivered",
  ORDER_EDITED: "order_edited",
  AMOUNT_CHANGED: "amount_changed",
  ADDITIONAL_PAYMENT: "additional_payment",
  PARTIAL_REFUND: "partial_refund",
  SLIP_APPROVED: "slip_approved",
  SLIP_REJECTED: "slip_rejected",
  PAY_REMIND_5M: "pay_remind_5m",
  PAY_REMIND_1M: "pay_remind_1m",
  PAY_EXPIRED: "pay_expired",
  ORDER_CANCELLED: "order_cancelled",
  PROMOTION: "promotion",
  NEWS: "news",
  // แชท (ใช้ได้ทั้งฝั่งลูกค้าและไรเดอร์ — คู่สนทนามีแค่สองฝั่ง จึงใช้ type เดียวกัน)
  NEW_MESSAGE: "new_message",
  // store
  NEW_ORDER: "new_order",
  SLIP_UPLOADED: "slip_uploaded",
  SLIP_REUPLOADED: "slip_reuploaded",
  DIFF_PAID: "diff_paid",
  CUSTOMER_CANCELLED: "customer_cancelled",
  RIDER_DELIVERED: "rider_delivered",
  LOW_STOCK: "low_stock",
  // rider
  NEW_JOB: "new_job",
  FOOD_READY: "food_ready",
  CUSTOMER_EDITED: "customer_edited",
  ADDRESS_CHANGED: "address_changed",
  JOB_CANCELLED: "job_cancelled",
  JOB_EXPIRED: "job_expired",
  // admin
  STORE_SIGNUP: "store_signup",
  RIDER_SIGNUP: "rider_signup",
  PAYMENT_ERROR: "payment_error",
  REPORT: "report",
  SYSTEM_ERROR: "system_error",
  SECURITY_ALERT: "security_alert",
};

const HIGH = [
  "new_order", "pay_expired", "order_edited", "payment_error", "additional_payment",
  "pay_remind_1m", "slip_rejected", "security_alert", "new_job", "job_cancelled", "job_expired",
];
const LOW = ["promotion", "news", "system_error"];

// HIGH / LOW are explicit; everything else is NORMAL.
export const priorityForType = (type) =>
  HIGH.includes(type) ? PRIORITY.HIGH : LOW.includes(type) ? PRIORITY.LOW : PRIORITY.NORMAL;

// The ONLY writer. Fails soft (returns null) on missing role/type so a broken
// emit never throws inside an order/payment transaction.
export async function createNotification({
  userId = "", role, type, title = "", message = "", orderId = "", actionUrl = "", priority,
} = {}) {
  if (!role || !type) return null;
  try {
    return await addDoc(collection(db, NOTIF_COLLECTION), {
      userId, role, type, title, message, orderId, actionUrl,
      priority: priority || priorityForType(type),
      read: false,
      readAt: null,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("createNotification failed:", e);
    return null;
  }
}

// Role-targeted convenience wrappers (still route through createNotification).
export const notifyCustomer = (phone, args) =>
  createNotification({ ...args, role: ROLE.CUSTOMER, userId: phone || "" });
export const notifyRider = (uid, args) =>
  createNotification({ ...args, role: ROLE.RIDER, userId: uid || "" });
export const notifyStore = (args) =>
  createNotification({ ...args, role: ROLE.STORE, userId: "" });

// แชท: แจ้ง "อีกฝั่ง" ว่ามีข้อความใหม่ (ไม่งั้นต้องเปิดหน้าแชทค้างไว้ถึงจะเห็น)
// อยู่ที่นี่เพราะเป็น emitter เหมือน notifyCustomer/notifyRider — Chat.jsx ไม่ต้องรู้ว่าใครคือปลายทาง
// ต้องมีข้อมูลออเดอร์ถึงจะรู้ปลายทาง (เบอร์ลูกค้า / uid ไรเดอร์) — ไม่มีก็ข้ามไปเงียบ ๆ
export function notifyChatMessage(order, sender) {
  if (!order?.id) return null;
  const no = order.orderNo || order.id;
  // ต้องมีปลายทางที่เจาะจงเท่านั้น: userId ว่าง = "broadcast ทั้ง role" ตาม firestore.rules
  // (isMine() ยอมให้ userId == "") ถ้าปล่อยไป ข้อความแชทจะไปโผล่ที่ลูกค้า "ทุกคน"
  if (sender === "rider" && order.phone) {
    return notifyCustomer(order.phone, {
      type: NOTIF_TYPE.NEW_MESSAGE,
      orderId: order.id,
      actionUrl: `/shop/orders/${order.id}`,
      message: `ไรเดอร์ส่งข้อความถึงคุณ (ออเดอร์ ${no})`,
    });
  }
  if (sender === "customer" && order.riderId) {
    return notifyRider(order.riderId, {
      type: NOTIF_TYPE.NEW_MESSAGE,
      orderId: order.id,
      actionUrl: "/rider",
      message: `ลูกค้าส่งข้อความ (ออเดอร์ ${no})`,
    });
  }
  return null;
}
export const notifyAdmin = (args) =>
  createNotification({ ...args, role: ROLE.ADMIN, userId: "" });

export const markRead = (id) =>
  updateDoc(doc(db, NOTIF_COLLECTION, id), { read: true, readAt: serverTimestamp() });

export async function markAllRead(ids = []) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, NOTIF_COLLECTION, id), { read: true, readAt: serverTimestamp() }));
  await batch.commit();
}

export const deleteNotification = (id) => deleteDoc(doc(db, NOTIF_COLLECTION, id));

export async function deleteAll(ids = []) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, NOTIF_COLLECTION, id)));
  await batch.commit();
}

export const badgeCount = (items = []) => items.reduce((c, n) => (n.read ? c : c + 1), 0);
