import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import DeliveryMap from "../location/DeliveryMap.jsx";
import MapButton from "../location/MapButton.jsx";
import PaymentStatusBadge from "../payment/PaymentStatusBadge.jsx";
import { adminNormalizeStatus, formatDateTime, toDate } from "./adminUtils";
import { input, thA as th, tdA as td } from "./adminStyles";

const STATUS_OPTIONS = [
  "",
  "pending",
  "accepted",
  "cooking",
  "ready_for_delivery",
  "picked_up",
  "delivering",
  "completed",
  "cancelled",
];
const EDITABLE_STATUSES = STATUS_OPTIONS.filter(Boolean);
const REFUND_OPTIONS = ["none", "pending", "refunded"];

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

// ตารางออเดอร์แบบ realtime พร้อมค้นหา/กรอง/ดูรายละเอียด/ยกเลิก/สถานะคืนเงิน
export default function OrdersPanel({ orders }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = orders.filter((o) => {
    if (statusFilter && adminNormalizeStatus(o.status) !== statusFilter) return false;
    if (dateFilter) {
      const d = toDate(o.createdAt);
      if (!d) return false;
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dStr !== dateFilter) return false;
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const haystack = `${o.orderNo || ""} ${o.customerName || ""} ${o.phone || ""}`.toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  const cancelOrder = async (orderId) => {
    if (!window.confirm("ยกเลิกออเดอร์นี้ใช่ไหม?")) return;
    await updateDoc(doc(db, "orders", orderId), { status: "cancelled" });
  };

  const setRefundStatus = async (orderId, refundStatus) => {
    await updateDoc(doc(db, "orders", orderId), { refundStatus });
  };

  const setOrderStatus = async (orderId, status) => {
    await updateDoc(doc(db, "orders", orderId), { status });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
        <input
          placeholder="ค้นหา: เลขออเดอร์ / ชื่อ / เบอร์โทร"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...input, flex: 1, minWidth: "220px" }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={input}>
          <option value="">ทุกสถานะ</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={input}
        />
        {(search || statusFilter || dateFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setDateFilter(""); }}
            style={{ ...input, cursor: "pointer", background: "#444" }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              <th style={th}>เลขออเดอร์</th>
              <th style={th}>ลูกค้า</th>
              <th style={th}>โทร</th>
              <th style={th}>สถานะ</th>
              <th style={th}>ยอดรวม</th>
              <th style={th}>เวลา</th>
              <th style={th}>คืนเงิน</th>
              <th style={th}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
                <td style={td}>{o.orderNo || o.id}</td>
                <td style={td}>{o.customerName || "-"}</td>
                <td style={td}>{o.phone || "-"}</td>
                <td style={td}>
                  <select
                    value={EDITABLE_STATUSES.includes(o.status) ? o.status : adminNormalizeStatus(o.status)}
                    onChange={(e) => setOrderStatus(o.id, e.target.value)}
                    style={{ ...input, padding: "4px 6px", fontSize: "12px" }}
                  >
                    {EDITABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td style={td}>{o.grandTotal ?? 0} ฿</td>
                <td style={td}>{formatDateTime(o.createdAt)}</td>
                <td style={td}>
                  <select
                    value={o.refundStatus || "none"}
                    onChange={(e) => setRefundStatus(o.id, e.target.value)}
                    style={{ ...input, padding: "4px 6px", fontSize: "12px" }}
                  >
                    {REFUND_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => setSelected(o)}
                      style={{ padding: "6px 10px", borderRadius: "8px", border: "none", background: "#4fc3f7", color: "#000", cursor: "pointer", fontSize: "12px" }}
                    >
                      ดูรายละเอียด
                    </button>
                    {adminNormalizeStatus(o.status) !== "completed" &&
                      adminNormalizeStatus(o.status) !== "cancelled" && (
                        <button
                          onClick={() => cancelOrder(o.id)}
                          style={{ padding: "6px 10px", borderRadius: "8px", border: "none", background: "#e53935", color: "#fff", cursor: "pointer", fontSize: "12px" }}
                        >
                          ยกเลิก
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={8}>
                  <span style={{ color: "#888" }}>ไม่พบออเดอร์ที่ตรงกับตัวกรอง</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal รายละเอียดออเดอร์ */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 4000, padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#1e1e1e", borderRadius: "16px", padding: "20px", width: "100%", maxWidth: "480px", maxHeight: "85vh", overflowY: "auto" }}
          >
            <h3 style={{ marginTop: 0 }}>🧾 {selected.orderNo || selected.id}</h3>
            <p>👤 {selected.customerName} — 📞 {selected.phone}</p>
            <p>🏠 {selected.deliveryAddress || selected.address || "-"}</p>
            <p>💳 {selected.paymentMethod || "-"} | สถานะ: {adminNormalizeStatus(selected.status)}</p>
            {selected.payment && (
              <p style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <PaymentStatusBadge status={selected.payment.status} />
                {selected.payment.slipUrl && (
                  <a href={selected.payment.slipUrl} target="_blank" rel="noreferrer">
                    <img src={selected.payment.slipUrl} alt="สลิป" style={{ width: "50px", borderRadius: "8px" }} />
                  </a>
                )}
              </p>
            )}
            <p>🛵 ไรเดอร์: {selected.riderName || "-"} ({selected.riderPhone || "-"})</p>
            {(() => {
              const dLat = selected.deliveryLocation?.lat ?? selected.lat ?? selected.latitude;
              const dLng = selected.deliveryLocation?.lng ?? selected.lng ?? selected.longitude;
              const dAddress = selected.deliveryLocation?.address || selected.deliveryAddress;
              if (dLat == null || dLng == null) return null;
              return (
                <div style={{ marginBottom: "10px" }}>
                  <DeliveryMap lat={dLat} lng={dLng} address={dAddress} height="180px" />
                  <div style={{ marginTop: "8px" }}>
                    <MapButton lat={dLat} lng={dLng} mode="view" style={{ padding: "6px 12px", fontSize: "13px" }} />
                  </div>
                </div>
              );
            })()}
            <div style={{ marginTop: "10px" }}>
              {(selected.items || []).map((item, i) => (
                <div key={i} style={{ borderTop: "1px dashed #444", paddingTop: "6px", marginTop: "6px", fontSize: "13px" }}>
                  🍗 {item.name} ×{item.qty || 1} = {item.price} บาท
                  {optionLabel(item.top_chicken) ? ` | ${optionLabel(item.top_chicken)}` : ""}
                </div>
              ))}
            </div>
            <h3 style={{ color: "#ff9800", marginTop: "12px" }}>
              💰 รวม {selected.grandTotal ?? 0} บาท
            </h3>

            {/* Edit version history (Phase 3.7F) — Admin sees every version */}
            {Array.isArray(selected.editHistory) && selected.editHistory.length > 0 && (
              <div style={{ marginTop: "12px", borderTop: "1px solid #444", paddingTop: "10px" }}>
                <p style={{ fontWeight: 700, marginBottom: "6px" }}>
                  📝 ประวัติการแก้ไข (v{selected.version ?? 1})
                </p>
                {selected.editHistory.map((h, i) => (
                  <div key={i} style={{ fontSize: "12px", color: "#bbb", borderTop: "1px dashed #444", paddingTop: "6px", marginTop: "6px" }}>
                    v{h.version}: {(h.items || []).map((it) => `${it.qty || 1}×${it.name}`).join(", ") || "-"}
                    <br />รวม {h.grandTotal ?? 0} บาท{h.reason ? ` · ${h.reason}` : ""}{h.editedBy ? ` · ${h.editedBy}` : ""}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setSelected(null)}
              style={{ width: "100%", padding: "10px", marginTop: "10px", borderRadius: "10px", border: "none", background: "#444", color: "#fff", cursor: "pointer" }}
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
