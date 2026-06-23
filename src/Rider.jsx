import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import Chat from "./Chat.jsx";

const STORE_PHONE = "0830000000"; // เบอร์โทรร้าน LK Fried Chicken

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

// rider id ประจำเครื่อง (ไม่มีระบบ login)
const getRiderId = () => {
  let id = localStorage.getItem("riderId");
  if (!id) {
    id = "rider_" + Date.now();
    localStorage.setItem("riderId", id);
  }
  return id;
};

// ขั้นตอนของไรเดอร์ (riderStatus) หลังรับออเดอร์
const RIDER_STEPS = [
  { key: "ถึงร้านแล้ว", label: "1️⃣ ถึงร้านแล้ว" },
  { key: "รับอาหารแล้ว", label: "4️⃣ รับอาหารแล้ว" },
  { key: "กำลังจัดส่ง", label: "5️⃣ กำลังจัดส่ง" },
  { key: "ส่งสำเร็จ", label: "6️⃣ ส่งสำเร็จ" },
];

function Rider() {
  const [orders, setOrders] = useState([]);
  const [riderName, setRiderName] = useState(
    localStorage.getItem("riderName") || ""
  );
  const [riderPhone, setRiderPhone] = useState(
    localStorage.getItem("riderPhone") || ""
  );

  useEffect(() => {
    // ไรเดอร์เห็นออเดอร์ที่ร้านส่งให้ไรเดอร์แล้ว (กำลังจัดส่ง)
    const q = query(
      collection(db, "orders"),
      where("status", "==", "กำลังจัดส่ง")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  // 2 รับออเดอร์ -> บันทึกข้อมูลไรเดอร์ลงออเดอร์
  const acceptOrder = async (order) => {
    if (!riderName.trim() || !riderPhone.trim()) {
      alert("กรุณากรอกชื่อและเบอร์ไรเดอร์ก่อนรับออเดอร์");
      return;
    }
    localStorage.setItem("riderName", riderName.trim());
    localStorage.setItem("riderPhone", riderPhone.trim());
    await updateDoc(doc(db, "orders", order.id), {
      riderId: getRiderId(),
      riderName: riderName.trim(),
      riderPhone: riderPhone.trim(),
      riderStatus: "accepted",
    });
  };

  const setRiderStatus = async (order, riderStatus) => {
    const updates = { riderStatus };
    // เมื่อส่งสำเร็จ ปิดออเดอร์
    if (riderStatus === "ส่งสำเร็จ") {
      updates.status = "เสร็จสิ้น";
    }
    await updateDoc(doc(db, "orders", order.id), updates);
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
        <h1 style={{ margin: 0, fontSize: "22px" }}>🛵 ไรเดอร์</h1>
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

      {/* ข้อมูลไรเดอร์ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="ชื่อไรเดอร์"
          value={riderName}
          onChange={(e) => setRiderName(e.target.value)}
          style={{
            flex: 1,
            minWidth: "140px",
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
          }}
        />
        <input
          type="tel"
          placeholder="เบอร์ไรเดอร์"
          value={riderPhone}
          onChange={(e) => setRiderPhone(e.target.value)}
          style={{
            flex: 1,
            minWidth: "140px",
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
          }}
        />
      </div>

      {orders.length === 0 && (
        <p style={{ color: "#888" }}>ยังไม่มีออเดอร์ที่ต้องจัดส่ง</p>
      )}

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
            <div style={{ fontSize: "13px", color: "#888", marginBottom: "6px" }}>
              {order.orderNo}
            </div>

            {/* 3 ข้อมูลลูกค้า */}
            <div
              style={{
                background: "#161616",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "12px",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                3️⃣ ข้อมูลลูกค้า
              </div>
              <div>👤 {order.customerName}</div>
              <div>
                📞{" "}
                <a href={`tel:${order.phone}`} style={{ color: "#4fc3f7" }}>
                  {order.phone}
                </a>
              </div>
              <div>🏠 {order.deliveryAddress || order.address || "-"}</div>
              {order.gpsLocation && (
                <div>
                  📍{" "}
                  <a
                    href={`https://www.google.com/maps?q=${order.gpsLocation}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#4fc3f7" }}
                  >
                    เปิดแผนที่
                  </a>
                </div>
              )}
            </div>

            {/* รายการอาหาร */}
            {order.items?.map((item, index) => (
              <div key={index} style={{ fontSize: "13px", marginBottom: "2px" }}>
                🍗 {item.name} ×{item.qty || 1}
                {optionLabel(item.top_chicken)
                  ? ` (${optionLabel(item.top_chicken)})`
                  : ""}
              </div>
            ))}

            <div style={{ color: "#ff8c00", fontWeight: "bold", margin: "8px 0" }}>
              💰 {order.grandTotal} บาท
            </div>

            {/* 2 รับออเดอร์ (ยังไม่มีไรเดอร์รับ) */}
            {!order.riderStatus && (
              <button
                onClick={() => acceptOrder(order)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#22c55e",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
              >
                2️⃣ รับออเดอร์
              </button>
            )}

            {/* ขั้นตอนไรเดอร์ (หลังรับออเดอร์แล้ว) */}
            {order.riderStatus && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                {RIDER_STEPS.map((step) => (
                  <button
                    key={step.key}
                    onClick={() => setRiderStatus(order, step.key)}
                    style={{
                      flex: 1,
                      minWidth: "130px",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "none",
                      background:
                        order.riderStatus === step.key ? "#22c55e" : "#333",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            )}

            {/* 7 เบอร์โทรร้าน */}
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
                7️⃣ 📞 โทรหาร้าน
              </button>
            </a>

            {/* แชทกับลูกค้า */}
            <Chat orderId={order.id} sender="rider" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Rider;
