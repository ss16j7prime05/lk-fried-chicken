// Audit Log (Phase 4.1) — the ONE shared, read-only reader of the order.audit event
// array that orderEngine (updateOrderStatus / assignRider / cancelOrder / recordEvent)
// and paymentService append to via arrayUnion (SSOT). Same source and helpers as the
// Global Timeline (Phase 4.0); audit adds who/what/why (action + by + meta). Every role
// renders it through this component — no per-role logic, no new collection/field.
import { eventLabel, fmtEventTime } from "./orderEventLabels";

export default function AuditLog({ order, dark = false }) {
  const entries = Array.isArray(order?.audit) ? [...order.audit] : [];
  if (entries.length === 0) {
    return (
      <p className={`text-sm font-medium ${dark ? "text-gray-500" : "text-gray-400"}`}>ยังไม่มีบันทึกการตรวจสอบ</p>
    );
  }
  entries.sort((a, b) => (a?.at || 0) - (b?.at || 0));

  const line = dark ? "bg-gray-600" : "bg-gray-200";
  const labelC = dark ? "text-gray-100" : "text-gray-900";

  return (
    <div className="space-y-0">
      {entries.map((e, i) => {
        const isLast = i === entries.length - 1;
        const reason = e?.meta?.reason;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${isLast ? "bg-primary" : line}`} />
              {!isLast && <span className={`w-0.5 flex-1 ${line}`} style={{ minHeight: "18px" }} />}
            </div>
            <div className="pb-3 min-w-0">
              <p className={`text-sm font-bold ${labelC}`}>{eventLabel(e?.action)}</p>
              <p className="text-[11px] font-medium text-gray-400">
                {fmtEventTime(e?.at)}{e?.by ? ` · ${e.by}` : ""}{reason ? ` · ${reason}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
