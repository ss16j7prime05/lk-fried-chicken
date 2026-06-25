import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { adminNormalizeStatus } from "./adminUtils";

const card = {
  background: "#1e1e1e",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
};

// ข้อมูลร้าน + เปิด/ปิดร้าน + สถิติร้าน (รองรับหลายร้านในอนาคตผ่าน users.role==="store")
export default function StoresPanel({ stores, isOpen, orders }) {
  const toggleOpen = async () => {
    await setDoc(doc(db, "stores", STORE_ID), { isOpen: !isOpen }, { merge: true });
  };

  const completed = orders.filter((o) => adminNormalizeStatus(o.status) === "completed");
  const totalSales = completed.reduce((s, o) => s + (o.grandTotal || 0), 0);

  return (
    <div>
      <div style={{ ...card, marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: "16px" }}>🏪 LK Fried Chicken</div>
            <div style={{ color: "#999", fontSize: "13px" }}>Store ID: {STORE_ID}</div>
          </div>
          <button
            onClick={toggleOpen}
            style={{
              padding: "10px 18px", borderRadius: "20px", border: "none",
              background: isOpen ? "#22c55e" : "#e53935", color: "#fff",
              fontWeight: "bold", cursor: "pointer",
            }}
          >
            {isOpen ? "✅ ร้านเปิด (กดเพื่อปิด)" : "❌ ร้านปิด (กดเพื่อเปิด)"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div style={card}>
          <div style={{ color: "#999", fontSize: "13px" }}>ออเดอร์ทั้งหมด</div>
          <div style={{ fontSize: "22px", fontWeight: "bold" }}>{orders.length}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#999", fontSize: "13px" }}>ออเดอร์เสร็จสิ้น</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#22c55e" }}>{completed.length}</div>
        </div>
        <div style={card}>
          <div style={{ color: "#999", fontSize: "13px" }}>ยอดขายรวม</div>
          <div style={{ fontSize: "22px", fontWeight: "bold", color: "#ff8c00" }}>{totalSales} ฿</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ color: "#999", fontSize: "14px", marginBottom: "8px" }}>
          🏪 รายชื่อร้านในระบบ
        </div>
        {stores.length === 0 && <div style={{ color: "#777" }}>ยังไม่มีร้านค้าสมัครในระบบ (users.role === "store")</div>}
        {stores.map((s) => (
          <div key={s.id} style={{ borderTop: "1px solid #333", padding: "8px 0", fontSize: "13px" }}>
            <div style={{ fontWeight: "bold" }}>{s.storeName || s.name || "-"}</div>
            <div style={{ color: "#999" }}>{s.phone || "-"} | {s.email || "-"}</div>
            <div style={{ color: "#999" }}>{s.address || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
