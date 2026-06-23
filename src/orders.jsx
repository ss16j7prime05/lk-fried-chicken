import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { Link } from "react-router-dom";

const TABS = ["ออเดอร์ใหม่", "กำลังทำ", "กำลังจัดส่ง", "เสร็จสิ้น"];

// ปุ่มที่แสดงในแต่ละสถานะ -> สถานะปลายทาง
const STATUS_ACTIONS = {
  "ออเดอร์ใหม่": [
    { label: "รับออเดอร์", to: "กำลังทำ", color: "#22c55e" },
    { label: "ยกเลิกออเดอร์", to: "ยกเลิก", color: "#e53935" },
  ],
  "กำลังทำ": [
    { label: "ส่งให้ไรเดอร์", to: "กำลังจัดส่ง", color: "#4fc3f7" },
  ],
  "กำลังจัดส่ง": [
    { label: "เสร็จสิ้น", to: "เสร็จสิ้น", color: "#22c55e" },
  ],
};

// แปลงค่า option ที่อาจเป็น string หรือ object {name, price}
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

function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("ออเดอร์ใหม่");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .reverse();
      console.log(data);
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  console.log(orders);

  // ออเดอร์ที่บันทึกจากหน้าลูกค้าใช้ status:"pending" -> ถือเป็น "ออเดอร์ใหม่"
  const matchTab = (order, tab) => {
    if (tab === "ออเดอร์ใหม่") {
      return order.status === "ออเดอร์ใหม่" || order.status === "pending";
    }
    if (tab === "กำลังจัดส่ง") {
      return order.status === "กำลังจัดส่ง" || order.status === "ส่งให้ไรเดอร์";
    }
    return order.status === tab;
  };

  const filteredOrders = orders.filter((order) => matchTab(order, filter));

  const setStatus = async (id, to) => {
    await updateDoc(doc(db, "orders", id), { status: to });
  };

  const actionsFor = (status) => {
    let normalized = status === "pending" ? "ออเดอร์ใหม่" : status;
    if (normalized === "ส่งให้ไรเดอร์") normalized = "กำลังจัดส่ง";
    return STATUS_ACTIONS[normalized] || [];
  };

  const deleteOrder = async (id) => {
    if (!window.confirm("ลบออเดอร์นี้ใช่ไหม?")) return;
    await deleteDoc(doc(db, "orders", id));
  };

  const statusLabel = (status) =>
    status === "pending" ? "ออเดอร์ใหม่" : status;

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>📦 รายการออเดอร์</h1>
        <Link to="/">
          <button
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "none",
              background: "#ff9800",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🍗 กลับหน้าสั่งอาหาร
          </button>
        </Link>
      </div>

      {/* แท็บสถานะ */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          overflowX: "auto",
          paddingBottom: "6px",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              background: filter === tab ? "#ff9800" : "#2a2a2a",
              color: "#fff",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <p style={{ color: "#888" }}>ยังไม่มีออเดอร์ในสถานะนี้</p>
      )}

      {/* การ์ดออเดอร์ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            style={{
              background: "#1e1e1e",
              borderRadius: "16px",
              padding: "16px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <h3 style={{ margin: 0 }}>👤 {order.customerName}</h3>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  background: "#333",
                  color: "#ffb74d",
                }}
              >
                {statusLabel(order.status)}
              </span>
            </div>

            {order.orderNo && (
              <div style={{ fontSize: "12px", color: "#888" }}>
                {order.orderNo}
              </div>
            )}
            {order.createdAt && (
              <div style={{ fontSize: "12px", color: "#999", marginBottom: "6px" }}>
                🕒 {formatDate(order.createdAt)}
              </div>
            )}

            <p style={{ margin: "4px 0" }}>📞 {order.phone}</p>

            {order.orderType === "delivery" && (
              <>
                <p style={{ margin: "4px 0" }}>
                  🏠 {order.deliveryAddress || order.address || "-"}
                </p>
                {order.gpsLocation && (
                  <p style={{ margin: "4px 0" }}>
                    📍 GPS:{" "}
                    <a
                      href={`https://www.google.com/maps?q=${order.gpsLocation}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#4fc3f7" }}
                    >
                      เปิดแผนที่
                    </a>
                  </p>
                )}
                <p style={{ margin: "4px 0" }}>
                  🚗 ระยะทาง:{" "}
                  {order.distanceKm != null
                    ? `${Number(order.distanceKm).toFixed(1)} กม.`
                    : "-"}
                </p>
                <p style={{ margin: "4px 0" }}>
                  🛵 ค่าส่ง: {order.deliveryFee || 0} บาท
                </p>
              </>
            )}

            <p style={{ margin: "4px 0" }}>
              💳 ชำระเงิน: {order.paymentMethod}
            </p>
            <p style={{ margin: "4px 0" }}>
              📄 หมายเหตุ: {order.note || "-"}
            </p>

            {order.riderName && (
              <p style={{ margin: "4px 0", color: "#4fc3f7" }}>
                🛵 ไรเดอร์: {order.riderName} ({order.riderPhone})
              </p>
            )}

            {/* รายการอาหาร */}
            <div style={{ marginTop: "10px" }}>
              {order.items?.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "10px",
                    borderTop: "1px dashed #444",
                    paddingTop: "10px",
                    marginTop: "10px",
                  }}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        width: "56px",
                        height: "56px",
                        objectFit: "cover",
                        borderRadius: "10px",
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold" }}>🍗 {item.name}</div>
                    {optionLabel(item.top_chicken) && (
                      <div style={{ fontSize: "13px" }}>
                        🍖 {optionLabel(item.top_chicken)}
                      </div>
                    )}
                    {optionLabel(item.spicy) && (
                      <div style={{ fontSize: "13px" }}>
                        🌶️ {optionLabel(item.spicy)}
                      </div>
                    )}
                    {optionLabel(item.sauce) && (
                      <div style={{ fontSize: "13px" }}>
                        🥫 {optionLabel(item.sauce)}
                      </div>
                    )}
                    {optionLabel(item.powder) && (
                      <div style={{ fontSize: "13px" }}>
                        🧂 {optionLabel(item.powder)}
                      </div>
                    )}
                    <div style={{ fontSize: "13px", color: "#bbb" }}>
                      จำนวน {item.qty || 1} × {item.price} บาท
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ยอดรวม */}
            <h3
              style={{
                color: "#ff9800",
                marginTop: "14px",
                marginBottom: "12px",
              }}
            >
              💰 รวมทั้งหมด {order.grandTotal} บาท
            </h3>

            {/* ปุ่มควบคุม */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {actionsFor(order.status).map((action) => (
                <button
                  key={action.label}
                  onClick={() => setStatus(order.id, action.to)}
                  style={{
                    flex: 1,
                    minWidth: "120px",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "none",
                    background: action.color,
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {action.label}
                </button>
              ))}
              <button
                onClick={() => deleteOrder(order.id)}
                style={{
                  flex: 1,
                  minWidth: "120px",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#777",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ลบออเดอร์
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Orders;
