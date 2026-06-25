import { formatDateTime } from "./adminUtils";
import PaymentStatusBadge from "../payment/PaymentStatusBadge.jsx";

const th = { textAlign: "left", padding: "8px", color: "#999", fontSize: "12px", whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: "13px", verticalAlign: "top" };

// ประวัติการชำระเงินทั้งหมด (เฉพาะออเดอร์ที่มีข้อมูล payment) เรียงล่าสุดก่อน
export default function PaymentsPanel({ orders }) {
  const payments = orders
    .filter((o) => o.payment)
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={th}>เลขออเดอร์</th>
            <th style={th}>ลูกค้า</th>
            <th style={th}>วิธีชำระเงิน</th>
            <th style={th}>ยอดเงิน</th>
            <th style={th}>สถานะ</th>
            <th style={th}>สลิป</th>
            <th style={th}>เวลาชำระเงิน</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
              <td style={td}>{o.orderNo || o.id}</td>
              <td style={td}>{o.customerName || "-"}</td>
              <td style={td}>{o.payment.method || "-"}</td>
              <td style={td}>{o.grandTotal ?? 0} ฿</td>
              <td style={td}><PaymentStatusBadge status={o.payment.status} /></td>
              <td style={td}>
                {o.payment.slipUrl ? (
                  <a href={o.payment.slipUrl} target="_blank" rel="noreferrer">
                    <img src={o.payment.slipUrl} alt="สลิป" style={{ width: "60px", borderRadius: "8px" }} />
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td style={td}>{o.payment.paidAt ? formatDateTime(o.payment.paidAt) : "-"}</td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr><td style={td} colSpan={7}><span style={{ color: "#888" }}>ยังไม่มีข้อมูลการชำระเงิน</span></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
