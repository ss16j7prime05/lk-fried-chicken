// Global Timeline (Phase 4.0) — the ONE shared reader of the order.timeline event
// array that orderEngine (updateOrderStatus / recordEvent) and paymentService append
// to via arrayUnion (SSOT). Every role (Customer / Store / Rider / Admin) renders
// order history through this single component, so there is no per-role timeline logic,
// no new Firestore collection, and no new field.
import { normalizeStatus, STATUS_LABEL, toDate } from "../../store/orderStatus";

// Non-status events written by paymentService through recordEvent(action). Status
// events reuse STATUS_LABEL (the same SSOT labels the dashboards use).
const EVENT_LABEL = {
  "payment:slip_submitted": "ลูกค้าแนบสลิป",
  "payment:approved": "ยืนยันการชำระเงิน",
  "payment:rejected": "ปฏิเสธการชำระเงิน",
  "payment:expired": "หมดเวลาชำระเงิน",
  "refund:pending": "กำลังดำเนินการคืนเงิน",
  "refund:refunded": "คืนเงินแล้ว",
  "refund:none": "ยกเลิกการคืนเงิน",
};

const eventLabel = (status) =>
  EVENT_LABEL[status] || STATUS_LABEL[normalizeStatus(status)] || status;

// timeline entries stamp `at` = Date.now() (arrayUnion can't hold serverTimestamp()).
const fmt = (at) => {
  const d = toDate(at);
  return d
    ? d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
};

export default function OrderTimeline({ order, dark = false }) {
  const events = Array.isArray(order?.timeline) ? [...order.timeline] : [];
  if (events.length === 0) {
    return (
      <p className={`text-sm font-medium ${dark ? "text-gray-500" : "text-gray-400"}`}>ยังไม่มีประวัติ</p>
    );
  }
  events.sort((a, b) => (a?.at || 0) - (b?.at || 0));

  const line = dark ? "bg-gray-600" : "bg-gray-200";
  const labelC = dark ? "text-gray-100" : "text-gray-900";
  const metaC = dark ? "text-gray-400" : "text-gray-400";

  return (
    <div className="space-y-0">
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${isLast ? "bg-primary" : line}`} />
              {!isLast && <span className={`w-0.5 flex-1 ${line}`} style={{ minHeight: "18px" }} />}
            </div>
            <div className="pb-3 min-w-0">
              <p className={`text-sm font-bold ${labelC}`}>{eventLabel(e?.status)}</p>
              <p className={`text-[11px] font-medium ${metaC}`}>
                {fmt(e?.at)}{e?.by ? ` · ${e.by}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
