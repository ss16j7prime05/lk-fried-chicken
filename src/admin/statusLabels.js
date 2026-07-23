// ── Admin UI status labels (Thai) — centralized display mapping (SSOT) ───────────────────────
// Firestore keeps the ENGLISH enum values (dropdowns still carry value="completed" etc.); these
// maps are DISPLAY-ONLY. Never render a raw enum to the admin — always go through these helpers,
// so the same Thai wording is used everywhere (table, selects, detail dialog, filters, reports).
export const ORDER_STATUS_LABELS = {
  pending: "รอร้านรับออเดอร์",
  accepted: "ร้านรับออเดอร์แล้ว",
  cooking: "กำลังเตรียมอาหาร",
  ready_for_delivery: "พร้อมให้ไรเดอร์รับ",
  picked_up: "ไรเดอร์รับสินค้าแล้ว",
  delivering: "กำลังจัดส่ง",
  completed: "จัดส่งสำเร็จ",
  cancelled: "ยกเลิกออเดอร์",
};

export const REFUND_STATUS_LABELS = {
  none: "ไม่มีการคืนเงิน",
  pending: "รอดำเนินการคืนเงิน",
  refunded: "คืนเงินแล้ว",
};

// "All" labels for the filter dropdowns.
export const ALL_ORDER_STATUS_LABEL = "ทุกสถานะ";
export const ALL_REFUND_STATUS_LABEL = "ทุกสถานะการคืนเงิน";

// Never surface a raw enum: an unknown/empty value falls back to a neutral dash.
export const orderStatusLabel = (status) => ORDER_STATUS_LABELS[status] ?? "-";
export const refundStatusLabel = (status) => REFUND_STATUS_LABELS[status ?? "none"] ?? "-";
