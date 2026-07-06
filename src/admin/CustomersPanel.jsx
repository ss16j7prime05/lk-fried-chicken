import { useState } from "react";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { formatDateTime } from "./adminUtils";
import { input, thB as th, tdB as td } from "./adminStyles";

// รายชื่อลูกค้า + ค้นหา + บล็อก/ปลดบล็อก + ดูประวัติคำสั่งซื้อ
export default function CustomersPanel({ customers, blocked, orders }) {
  const [search, setSearch] = useState("");
  const [historyPhone, setHistoryPhone] = useState(null);

  const blockedPhones = new Set(blocked.map((b) => b.id));

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return `${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(s);
  });

  const toggleBlock = async (phone) => {
    if (!phone) {
      alert("ลูกค้ารายนี้ไม่มีเบอร์โทรในระบบ");
      return;
    }
    if (blockedPhones.has(phone)) {
      await deleteDoc(doc(db, "blockedCustomers", phone));
    } else {
      await setDoc(doc(db, "blockedCustomers", phone), {
        blocked: true,
        reason: "บล็อกโดยแอดมิน",
        createdAt: serverTimestamp(),
      });
    }
  };

  const historyOrders = historyPhone
    ? orders.filter((o) => o.phone === historyPhone)
    : [];

  return (
    <div>
      <input
        placeholder="ค้นหาลูกค้า: ชื่อ / เบอร์โทร / อีเมล"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...input, width: "100%", maxWidth: "360px", marginBottom: "14px", boxSizing: "border-box" }}
      />

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              <th style={th}>ชื่อ</th>
              <th style={th}>เบอร์โทร</th>
              <th style={th}>อีเมล</th>
              <th style={th}>สถานะ</th>
              <th style={th}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
                <td style={td}>{c.name || "-"}</td>
                <td style={td}>{c.phone || "-"}</td>
                <td style={td}>{c.email || "-"}</td>
                <td style={td}>
                  {blockedPhones.has(c.phone) ? (
                    <span style={{ color: "#e53935", fontWeight: "bold" }}>ถูกบล็อก</span>
                  ) : (
                    <span style={{ color: "#22c55e" }}>ปกติ</span>
                  )}
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => setHistoryPhone(c.phone)}
                      style={{ padding: "6px 10px", borderRadius: "8px", border: "none", background: "#4fc3f7", color: "#000", cursor: "pointer", fontSize: "12px" }}
                    >
                      ประวัติ
                    </button>
                    <button
                      onClick={() => toggleBlock(c.phone)}
                      style={{
                        padding: "6px 10px", borderRadius: "8px", border: "none",
                        background: blockedPhones.has(c.phone) ? "#22c55e" : "#e53935",
                        color: "#fff", cursor: "pointer", fontSize: "12px",
                      }}
                    >
                      {blockedPhones.has(c.phone) ? "ปลดบล็อก" : "บล็อก"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td style={td} colSpan={5}><span style={{ color: "#888" }}>ไม่พบลูกค้า</span></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {historyPhone && (
        <div
          onClick={() => setHistoryPhone(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#1e1e1e", borderRadius: "16px", padding: "20px", width: "100%", maxWidth: "480px", maxHeight: "85vh", overflowY: "auto" }}
          >
            <h3 style={{ marginTop: 0 }}>📜 ประวัติคำสั่งซื้อ: {historyPhone}</h3>
            {historyOrders.length === 0 && <div style={{ color: "#777" }}>ไม่มีประวัติคำสั่งซื้อ</div>}
            {historyOrders.map((o) => (
              <div key={o.id} style={{ borderTop: "1px dashed #444", paddingTop: "8px", marginTop: "8px", fontSize: "13px" }}>
                <div>{o.orderNo || o.id} — {o.status}</div>
                <div style={{ color: "#999" }}>{formatDateTime(o.createdAt)}</div>
                <div style={{ color: "#ff9800" }}>{o.grandTotal ?? 0} บาท</div>
              </div>
            ))}
            <button
              onClick={() => setHistoryPhone(null)}
              style={{ width: "100%", padding: "10px", marginTop: "12px", borderRadius: "10px", border: "none", background: "#444", color: "#fff", cursor: "pointer" }}
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
