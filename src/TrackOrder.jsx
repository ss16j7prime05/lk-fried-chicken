import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const statusColor = (status) => {
  switch (status) {
    case "กำลังทำ":
      return "#ff8c00";
    case "จัดส่ง":
      return "#4fc3f7";
    case "เสร็จสิ้น":
      return "#22c55e";
    default:
      return "#ffd54f"; // ออเดอร์ใหม่ / pending = yellow
  }
};

const statusLabel = (status) =>
  status === "pending" ? "ออเดอร์ใหม่" : status || "ออเดอร์ใหม่";

const formatDate = (createdAt) => {
  if (!createdAt) return "";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

// ขั้นตอนสถานะสำหรับ progress
const STEPS = ["ออเดอร์ใหม่", "กำลังทำ", "จัดส่ง", "เสร็จสิ้น"];

function TrackOrder() {
  const [phone, setPhone] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!searchPhone) {
      setOrders([]);
      return;
    }
    const q = query(
      collection(db, "orders"),
      where("phone", "==", searchPhone)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
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
  }, [searchPhone]);

  const handleTrack = () => setSearchPhone(phone.trim());

  const currentStep = (status) => {
    const s = status === "pending" ? "ออเดอร์ใหม่" : status;
    const i = STEPS.indexOf(s);
    return i < 0 ? 0 : i;
  };

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>🚚 ติดตามออเดอร์</h1>
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
            🍗 กลับหน้าสั่งอาหาร
          </button>
        </Link>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <input
          type="tel"
          placeholder="กรอกเบอร์โทรของคุณ"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTrack()}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
            fontSize: "15px",
          }}
        />
        <button
          onClick={handleTrack}
          style={{
            padding: "12px 20px",
            borderRadius: "10px",
            border: "none",
            background: "#ff8c00",
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ติดตามออเดอร์
        </button>
      </div>

      {searchPhone && orders.length === 0 && (
        <p style={{ color: "#888" }}>ไม่พบออเดอร์ของเบอร์ {searchPhone}</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
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
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#888" }}>
                {order.orderNo}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  background: statusColor(order.status),
                  color: "#000",
                  fontWeight: "bold",
                }}
              >
                {statusLabel(order.status)}
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#999", marginBottom: "10px" }}>
              🕒 {formatDate(order.createdAt)}
            </div>

            {/* progress */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginBottom: "12px",
              }}
            >
              {STEPS.map((step, i) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: "6px",
                    borderRadius: "3px",
                    background:
                      i <= currentStep(order.status) ? "#ff8c00" : "#444",
                  }}
                />
              ))}
            </div>

            {order.items?.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "10px",
                  borderTop: "1px dashed #444",
                  paddingTop: "8px",
                  marginTop: "8px",
                }}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      width: "48px",
                      height: "48px",
                      objectFit: "cover",
                      borderRadius: "8px",
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold" }}>🍗 {item.name}</div>
                  {optionLabel(item.top_chicken) && (
                    <div style={{ fontSize: "12px" }}>
                      🍖 {optionLabel(item.top_chicken)}
                    </div>
                  )}
                  {optionLabel(item.spicy) && (
                    <div style={{ fontSize: "12px" }}>
                      🌶️ {optionLabel(item.spicy)}
                    </div>
                  )}
                  {optionLabel(item.sauce) && (
                    <div style={{ fontSize: "12px" }}>
                      🥫 {optionLabel(item.sauce)}
                    </div>
                  )}
                  {optionLabel(item.powder) && (
                    <div style={{ fontSize: "12px" }}>
                      🧂 {optionLabel(item.powder)}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#bbb" }}>
                    จำนวน {item.qty || 1} × {item.price} บาท
                  </div>
                </div>
              </div>
            ))}

            {order.orderType === "delivery" && (
              <p style={{ margin: "10px 0 0", fontSize: "14px" }}>
                🛵 ค่าส่ง: {order.deliveryFee || 0} บาท
              </p>
            )}

            <h3 style={{ color: "#ff8c00", marginTop: "10px", marginBottom: 0 }}>
              💰 รวมทั้งหมด {order.grandTotal} บาท
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrackOrder;
