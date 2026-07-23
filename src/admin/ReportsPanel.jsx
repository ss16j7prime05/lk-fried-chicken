import { exportToExcel, formatDateTime, adminNormalizeStatus } from "./adminUtils";
import { orderStatusLabel, refundStatusLabel } from "./statusLabels";

const btn = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "none",
  background: "#22c55e",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

// ปุ่ม export ออเดอร์ / ลูกค้า / ไรเดอร์ เป็นไฟล์ Excel (.xls)
export default function ReportsPanel({ orders, customers, riders }) {
  const exportOrders = () =>
    exportToExcel(
      orders.map((o) => ({
        orderNo: o.orderNo || o.id,
        customerName: o.customerName || "",
        phone: o.phone || "",
        status: orderStatusLabel(adminNormalizeStatus(o.status)),
        paymentMethod: o.paymentMethod || "",
        refundStatus: refundStatusLabel(o.refundStatus),
        grandTotal: o.grandTotal || 0,
        riderName: o.riderName || "",
        createdAt: formatDateTime(o.createdAt),
      })),
      "orders.xls"
    );

  const exportCustomers = () =>
    exportToExcel(
      customers.map((c) => ({
        name: c.name || "",
        phone: c.phone || "",
        email: c.email || "",
      })),
      "customers.xls"
    );

  const exportRiders = () =>
    exportToExcel(
      riders.map((r) => ({
        name: r.name || r.riderName || "",
        phone: r.phone || "",
      })),
      "riders.xls"
    );

  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      <button onClick={exportOrders} style={btn}>⬇️ Export ออเดอร์ (Excel)</button>
      <button onClick={exportCustomers} style={{ ...btn, background: "#4fc3f7", color: "#000" }}>⬇️ Export ลูกค้า</button>
      <button onClick={exportRiders} style={{ ...btn, background: "#ff8c00" }}>⬇️ Export ไรเดอร์</button>
    </div>
  );
}
