// Shared label + time helpers for the order.timeline / order.audit event arrays
// (Phase 4.0 Global Timeline, Phase 4.1 Audit Log). One place so both read-only
// views render the same events identically — no duplicated logic, no new collection.
import { normalizeStatus, STATUS_LABEL, toDate } from "../../store/orderStatus";

// Non-status events (paymentService.recordEvent) + engine audit actions. Status
// events reuse STATUS_LABEL (the same SSOT labels the dashboards use).
export const EVENT_LABEL = {
  "payment:slip_submitted": "ลูกค้าแนบสลิป",
  "payment:approved": "ยืนยันการชำระเงิน",
  "payment:rejected": "ปฏิเสธการชำระเงิน",
  "payment:expired": "หมดเวลาชำระเงิน",
  "refund:pending": "กำลังดำเนินการคืนเงิน",
  "refund:refunded": "คืนเงินแล้ว",
  "refund:none": "ยกเลิกการคืนเงิน",
  assign_rider: "ไรเดอร์รับงาน",
  cancel: "ยกเลิกออเดอร์",
};

// timeline entry.status OR audit entry.action -> Thai label. Audit actions may be
// prefixed "status:<x>"; strip it and fall back to STATUS_LABEL / the raw value.
export const eventLabel = (key) => {
  if (!key) return "";
  if (EVENT_LABEL[key]) return EVENT_LABEL[key];
  const s = key.startsWith("status:") ? key.slice(7) : key;
  return STATUS_LABEL[normalizeStatus(s)] || EVENT_LABEL[s] || s;
};

// timeline/audit stamp `at` = Date.now() (arrayUnion can't hold serverTimestamp()).
export const fmtEventTime = (at) => {
  const d = toDate(at);
  return d
    ? d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
};
