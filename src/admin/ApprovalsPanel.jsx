import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const card = {
  background: "#1e1e1e",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
};
const actionBtn = {
  flex: 1,
  padding: "10px",
  borderRadius: "10px",
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};
const docLink = {
  display: "inline-block",
  marginRight: "8px",
  marginBottom: "8px",
};
const docImg = { width: "70px", height: "70px", objectFit: "cover", borderRadius: "8px" };

function DocThumb({ url, label }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" style={docLink}>
      <img src={url} alt={label} style={docImg} />
      <div style={{ fontSize: "11px", color: "#999", textAlign: "center" }}>{label}</div>
    </a>
  );
}

// รายการคำขออนุมัติ (role=store หรือ rider, status=pending) พร้อมปุ่ม Approve/Reject + เอกสารแนบ
function PendingList({ items, role, onDecide }) {
  if (items.length === 0) {
    return <p style={{ color: "#888" }}>ไม่มีคำขอที่รอการอนุมัติ</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
      {items.map((u) => (
        <div key={u.id} style={card}>
          {role === "store" ? (
            <>
              <h3 style={{ margin: "0 0 6px" }}>🏪 {u.storeName || "-"}</h3>
              <p style={{ margin: "4px 0" }}>เจ้าของร้าน: {u.ownerName || "-"}</p>
              <p style={{ margin: "4px 0" }}>📞 {u.phone || "-"} · ✉️ {u.email || "-"}</p>
              <p style={{ margin: "4px 0" }}>🏠 {u.address || "-"}</p>
              <p style={{ margin: "4px 0" }}>
                ⏰ {u.openTime || "-"} - {u.closeTime || "-"} · พร้อมเพย์ {u.promptpayNumber || "-"}
              </p>
              <div style={{ marginTop: "8px" }}>
                <DocThumb url={u.logoUrl} label="โลโก้" />
                <DocThumb url={u.coverUrl} label="ภาพหน้าปก" />
                <DocThumb url={u.idCardUrl} label="บัตรประชาชน" />
                <DocThumb url={u.storePhotoUrl} label="รูปหน้าร้าน" />
              </div>
            </>
          ) : (
            <>
              <h3 style={{ margin: "0 0 6px" }}>🛵 {u.name || u.riderName || "-"}</h3>
              <p style={{ margin: "4px 0" }}>📞 {u.phone || "-"} · ✉️ {u.email || "-"}</p>
              <p style={{ margin: "4px 0" }}>
                {u.vehicleType || "-"} {u.vehicleBrand || ""} {u.vehicleModel || ""} ({u.vehicleColor || "-"}) · ทะเบียน {u.licensePlate || "-"}
              </p>
              <p style={{ margin: "4px 0" }}>
                🏦 {u.bankName || "-"} {u.accountNumber || "-"} ({u.accountName || "-"})
              </p>
              <div style={{ marginTop: "8px" }}>
                <DocThumb url={u.idCardUrl} label="บัตรประชาชน" />
                <DocThumb url={u.driverLicenseUrl} label="ใบขับขี่" />
                <DocThumb url={u.vehiclePhotoUrl} label="รูปรถ" />
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button onClick={() => onDecide(u.id, true)} style={{ ...actionBtn, background: "#22c55e" }}>
              ✅ อนุมัติ (Approve)
            </button>
            <button onClick={() => onDecide(u.id, false)} style={{ ...actionBtn, background: "#e53935" }}>
              ❌ ปฏิเสธ (Reject)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// แท็บคำขออนุมัติร้านค้า/ไรเดอร์ใหม่ ใช้ users ที่ดึงมาจาก AdminControlCenter อยู่แล้ว (realtime)
export default function ApprovalsPanel({ users }) {
  const [subTab, setSubTab] = useState("stores");

  const pendingStores = users.filter((u) => u.role === "store" && u.status === "pending");
  const pendingRiders = users.filter((u) => u.role === "rider" && u.status === "pending");

  const decide = async (uid, approved) => {
    await updateDoc(doc(db, "users", uid), {
      status: approved ? "approved" : "rejected",
    });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          onClick={() => setSubTab("stores")}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subTab === "stores" ? "#ff9800" : "#2a2a2a",
            color: "#fff",
          }}
        >
          🏪 ร้านค้ารออนุมัติ ({pendingStores.length})
        </button>
        <button
          onClick={() => setSubTab("riders")}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: subTab === "riders" ? "#ff9800" : "#2a2a2a",
            color: "#fff",
          }}
        >
          🛵 ไรเดอร์รออนุมัติ ({pendingRiders.length})
        </button>
      </div>

      {subTab === "stores" ? (
        <PendingList items={pendingStores} role="store" onDecide={decide} />
      ) : (
        <PendingList items={pendingRiders} role="rider" onDecide={decide} />
      )}
    </div>
  );
}
