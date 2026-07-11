// Store order editing + versioning (Phase 3.7F). Writes stay on the existing
// orders/{id} document — the version history is an array field, not a new
// collection. Recalculation reuses ../store/orderTotals; the additional-payment
// countdown reuses ../payment/paymentUtils.

import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { recalcOrder, orderTotal } from "./orderTotals";
import { PAYMENT_STATUS, paymentExpireTimestamp } from "../payment/paymentUtils";
import { notifyCustomer, NOTIF_TYPE } from "../notifications/notificationUtils";

// Reasons a store may edit an order (i18n keys resolve via oe.reason.*).
export const EDIT_REASONS = ["out_of_stock", "customer_add", "customer_reduce", "promotion", "other"];

// Refund methods a store can pick when the new total is lower (no automation yet).
export const REFUND_METHODS = ["cash", "transfer", "promptpay"];

// Item shape used across Customer/Store/Rider (matches Checkout's legacyItems).
export const blankItemFromMenu = (menu) => ({
  id: menu.id,
  name: menu.name || "",
  price: Number(menu.price || 0),
  image: menu.image || menu.imageUrl || "",
  category: menu.category || "",
  top_chicken: "", spicy: "", Sauce: "", sauce: "", powder: "", tableCheese: "",
  note: "",
  qty: 1,
});

// Persist a store edit: recompute totals, bump order.version, append the previous
// snapshot to editHistory, and route the difference to additional payment / refund.
export async function saveOrderEdit(order, { items, reason, reasonNote, refundMethod, editedBy }) {
  const totals = recalcOrder(items, order);
  const oldTotal = orderTotal(order);
  const diff = totals.grandTotal - oldTotal;
  const currentVersion = order.version ?? 1;

  // Snapshot of the version being replaced (Admin reads editHistory for full history).
  // No serverTimestamp() inside arrayUnion — use already-resolved timestamps.
  const snapshot = {
    version: currentVersion,
    items: order.items || [],
    subtotal: Number(order.subtotal ?? 0),
    grandTotal: oldTotal,
    editedAt: order.editedAt ?? order.createdAt ?? null,
    editedBy: order.editedBy ?? null,
    reason: order.editReason ?? null,
  };

  const patch = {
    items,
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    grandTotal: totals.grandTotal,
    version: currentVersion + 1,
    editedAt: serverTimestamp(),
    editedBy: editedBy || null,
    editReason: reason || null,
    editReasonNote: reasonNote || "",
    editHistory: arrayUnion(snapshot),
  };

  if (diff > 0) {
    // New total higher → customer pays the difference (fresh 10-min countdown).
    patch["payment.status"] = PAYMENT_STATUS.ADDITIONAL_PAYMENT;
    patch["payment.additionalAmount"] = diff;
    patch["payment.expireAt"] = paymentExpireTimestamp();
    patch["payment.updatedAt"] = serverTimestamp();
    patch.refundAmount = 0;
  } else if (diff < 0) {
    // New total lower → store owes a refund (manual for now, no automation).
    patch.refundAmount = -diff;
    patch.refundMethod = refundMethod || "cash";
    patch.refundStatus = "pending";
  } else {
    patch.refundAmount = 0;
  }

  await updateDoc(doc(db, "orders", order.id), patch);

  // Notify the customer: the edit itself + the money outcome (Phase 3.7G).
  const orderNo = order.orderNo || order.id;
  const actionUrl = `/shop/orders/${order.id}`;
  notifyCustomer(order.phone, {
    type: NOTIF_TYPE.ORDER_EDITED, orderId: order.id, actionUrl,
    message: `ร้านแก้ไขออเดอร์ ${orderNo}`,
  });
  if (diff > 0) {
    notifyCustomer(order.phone, {
      type: NOTIF_TYPE.ADDITIONAL_PAYMENT, orderId: order.id, actionUrl,
      message: `ออเดอร์ ${orderNo} ต้องชำระเพิ่ม ฿${diff}`,
    });
  } else if (diff < 0) {
    notifyCustomer(order.phone, {
      type: NOTIF_TYPE.PARTIAL_REFUND, orderId: order.id, actionUrl,
      message: `ออเดอร์ ${orderNo} คืนเงินบางส่วน ฿${-diff}`,
    });
  }

  return { diff, totals };
}
