import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import Chat from "./Chat.jsx";

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const statusColor = (status) => {
  switch (status) {
    case "กำลังทำ":
      return "#ff8c00";
    case "ส่งให้ไรเดอร์":
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

// เบอร์โทรร้าน LK Fried Chicken
const STORE_PHONE = "0830000000";

// ขั้นตอนที่ลูกค้าเห็น
const STEPS = ["ร้านรับออเดอร์", "กำลังทำ", "กำลังจัดส่ง", "เสร็จสิ้น"];

// แปลงสถานะจริงใน Firestore -> index ของ STEPS
const statusToStep = (status) => {
  const s = status === "pending" ? "ออเดอร์ใหม่" : status;
  if (s === "ออเดอร์ใหม่" || s === "ร้านรับออเดอร์") return 0;
  if (s === "กำลังทำ") return 1;
  if (s === "ส่งให้ไรเดอร์" || s === "จัดส่ง" || s === "กำลังจัดส่ง") return 2;
  if (s === "เสร็จสิ้น") return 3;
  return 0;
};

// กำลังจัดส่งอยู่หรือไม่ (สำหรับแสดงไรเดอร์ + แชท)
const isDelivering = (status) =>
  status === "ส่งให้ไรเดอร์" || status === "จัดส่ง" || status === "กำลังจัดส่ง";

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

            {/* progress bar */}
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
                      i <= statusToStep(order.status) ? "#ff8c00" : "#444",
                  }}
                />
              ))}
            </div>

            {/* ขั้นตอนสถานะ (อ่านอย่างเดียว) */}
            <div style={{ marginBottom: "12px" }}>
              {STEPS.map((step, i) => {
                const active = i <= statusToStep(order.status);
                const current = i === statusToStep(order.status);
                return (
                  <div
                    key={step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "14px",
                      color: active ? "#fff" : "#666",
                      fontWeight: current ? "bold" : "normal",
                      marginBottom: "2px",
                    }}
                  >
                    <span>{active ? "✅" : "⬜"}</span>
                    <span>
                      {i + 1}. {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ที่อยู่จัดส่ง */}
            {order.orderType === "delivery" && (
              <div style={{ fontSize: "14px", marginBottom: "8px" }}>
                🏠 {order.deliveryAddress || order.address || "-"}
              </div>
            )}

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

            <h3 style={{ color: "#ff8c00", marginTop: "10px", marginBottom: "10px" }}>
              💰 รวมทั้งหมด {order.grandTotal} บาท
            </h3>

            {/* แจ้งเตือนการยกเลิก */}
            <p style={{ fontSize: "12px", color: "#ffb74d", margin: "0 0 8px" }}>
              หากต้องการยกเลิกออเดอร์ กรุณาโทรติดต่อร้าน
            </p>

            {/* เบอร์โทรร้าน (แสดงตลอด) */}
            <a href={`tel:${STORE_PHONE}`}>
              <button
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#ff8c00",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                📞 โทรหาร้าน ({STORE_PHONE})
              </button>
            </a>

            {/* เบอร์ไรเดอร์ + แชท เฉพาะตอนกำลังจัดส่ง */}
            {isDelivering(order.status) && (
              <>
                {order.riderName && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "14px",
                      color: "#4fc3f7",
                    }}
                  >
                    🛵 ไรเดอร์: {order.riderName}
                  </div>
                )}
                {order.riderPhone && (
                  <a href={`tel:${order.riderPhone}`}>
                    <button
                      style={{
                        width: "100%",
                        padding: "10px",
                        marginTop: "8px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#4fc3f7",
                        color: "#000",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      🛵 โทรหาไรเดอร์ ({order.riderPhone})
                    </button>
                  </a>
                )}
                <Chat orderId={order.id} sender="customer" />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrackOrder;
