import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const formatDate = (createdAt) => {
  if (!createdAt) return "";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

const statusLabel = (status) =>
  status === "pending" ? "ออเดอร์ใหม่" : status || "ออเดอร์ใหม่";

// ADMIN = อ่านอย่างเดียว เห็นทุกอย่าง
function Admin() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : new Date(b.createdAt || 0).getTime();
          return tb - ta;
        });
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#121212",
        color: "#fff",
        padding: "16px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px" }}>🛠️ Admin — ภาพรวมทั้งหมด</h1>
        <Link to="/">
          <button
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "none",
              background: "#ff8c00",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🍗 หน้าแรก
          </button>
        </Link>
      </div>

      <p style={{ color: "#888" }}>ทั้งหมด {orders.length} ออเดอร์ (ดูอย่างเดียว)</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {orders.map((order) => (
          <div
            key={order.id}
            style={{
              background: "#1e1e1e",
              borderRadius: "20px",
              padding: "16px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#888" }}>
                {order.orderNo}
              </span>
              <span style={{ fontSize: "12px", color: "#ffb74d" }}>
                {statusLabel(order.status)}
                {order.status === "ยกเลิก" && order.cancelReason
                  ? ` (${order.cancelReason})`
                  : ""}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>
              🕒 {formatDate(order.createdAt)}
            </div>

            {/* ลูกค้า */}
            <div style={{ fontSize: "14px", marginBottom: "8px" }}>
              <div style={{ fontWeight: "bold", color: "#ff8c00" }}>👤 ลูกค้า</div>
              <div>ชื่อ: {order.customerName}</div>
              <div>โทร: {order.phone}</div>
              <div>ที่อยู่: {order.deliveryAddress || order.address || "-"}</div>
              {order.gpsLocation && (
                <div>
                  GPS:{" "}
                  <a
                    href={`https://www.google.com/maps?q=${order.gpsLocation}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#4fc3f7" }}
                  >
                    {order.gpsLocation}
                  </a>
                </div>
              )}
              <div>
                lat/lng: {order.latitude ?? order.lat ?? "-"},{" "}
                {order.longitude ?? order.lng ?? "-"}
              </div>
            </div>

            {/* อาหาร */}
            <div style={{ fontSize: "14px", marginBottom: "8px" }}>
              <div style={{ fontWeight: "bold", color: "#ff8c00" }}>🍗 รายการ</div>
              {order.items?.map((item, index) => (
                <div key={index} style={{ fontSize: "13px" }}>
                  • {item.name} ×{item.qty || 1} = {item.price} บาท
                  {optionLabel(item.top_chicken)
                    ? ` | 🍖 ${optionLabel(item.top_chicken)}`
                    : ""}
                  {optionLabel(item.spicy)
                    ? ` | 🌶️ ${optionLabel(item.spicy)}`
                    : ""}
                  {optionLabel(item.sauce)
                    ? ` | 🥫 ${optionLabel(item.sauce)}`
                    : ""}
                  {optionLabel(item.powder)
                    ? ` | 🧂 ${optionLabel(item.powder)}`
                    : ""}
                </div>
              ))}
              <div style={{ marginTop: "4px" }}>
                ยอดอาหาร: {order.subtotal ?? "-"} | ค่าส่ง:{" "}
                {order.deliveryFee || 0} บาท
              </div>
              <div style={{ color: "#ff8c00", fontWeight: "bold" }}>
                💰 รวม {order.grandTotal} บาท
              </div>
            </div>

            {/* ร้าน + ไรเดอร์ */}
            <div style={{ fontSize: "14px" }}>
              <div style={{ fontWeight: "bold", color: "#ff8c00" }}>
                🏪 สถานะร้าน
              </div>
              <div>{statusLabel(order.status)}</div>
              <div style={{ fontWeight: "bold", color: "#ff8c00", marginTop: "6px" }}>
                🛵 ไรเดอร์
              </div>
              <div>ชื่อ: {order.riderName || "-"}</div>
              <div>โทร: {order.riderPhone || "-"}</div>
              <div>สถานะไรเดอร์: {order.riderStatus || "-"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Admin;
