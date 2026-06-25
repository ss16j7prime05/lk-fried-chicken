import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../AuthContext.jsx";
import OrderCard from "./OrderCard.jsx";
import { ORDER_STATUSES, STATUS_LABEL, normalizeStatus } from "./orderStatus";

// เสียงแจ้งเตือนสั้น ๆ ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง)
const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn(e);
  }
};

const navBtn = {
  padding: "8px 14px",
  borderRadius: "20px",
  border: "none",
  background: "#ff8c00",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

// Store Dashboard ใหม่: รับออเดอร์แบบ realtime, อัปเดตสถานะ, เด้งเสียงเมื่อมีออเดอร์ใหม่
export default function StoreOrdersDashboard() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [newOrderPopup, setNewOrderPopup] = useState(null);
  const knownIds = useRef(new Set());
  const initialized = useRef(false);
  const { logout } = useAuth();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(data);

      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const order = { id: change.doc.id, ...change.doc.data() };
        if (!initialized.current) {
          knownIds.current.add(order.id);
          return;
        }
        if (knownIds.current.has(order.id)) return;
        knownIds.current.add(order.id);
        if (normalizeStatus(order.status) === "pending") {
          setNewOrderPopup({
            name: order.customerName,
            phone: order.phone,
            total: order.grandTotal,
          });
          beep();
        }
      });
      initialized.current = true;
    });
    return () => unsubscribe();
  }, []);

  const visibleOrders = orders
    .map((o) => ({ ...o, _status: normalizeStatus(o.status) }))
    .filter((o) => ORDER_STATUSES.includes(o._status));

  const countBy = (status) =>
    visibleOrders.filter((o) => o._status === status).length;

  const filteredOrders = visibleOrders
    .filter((o) => o._status === filter)
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

  const advanceStatus = async (id, to) => {
    await updateDoc(doc(db, "orders", id), { status: to });
  };

  const cancelOrder = async (id) => {
    if (!window.confirm("ยกเลิกออเดอร์นี้ใช่ไหม?")) return;
    await updateDoc(doc(db, "orders", id), { status: "cancelled" });
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
      {newOrderPopup && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 5000,
            background: "#fff",
            color: "#222",
            borderRadius: "16px",
            padding: "16px 20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            minWidth: "240px",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "8px" }}>
            🔔 ออเดอร์ใหม่
          </div>
          <div>ชื่อ : {newOrderPopup.name}</div>
          <div>เบอร์ : {newOrderPopup.phone}</div>
          <div>ยอด : {newOrderPopup.total} บาท</div>
          <button
            onClick={() => setNewOrderPopup(null)}
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "8px",
              borderRadius: "10px",
              border: "none",
              background: "#ff8c00",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            ปิด
          </button>
        </div>
      )}

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>📦 Store Dashboard</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link to="/store/dashboard">
            <button style={navBtn}>📊 สถิติร้าน</button>
          </Link>
          <button style={{ ...navBtn, background: "#e53935" }} onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          overflowX: "auto",
          paddingBottom: "6px",
        }}
      >
        {ORDER_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              background: filter === status ? "#ff9800" : "#2a2a2a",
              color: "#fff",
            }}
          >
            {STATUS_LABEL[status]} ({countBy(status)})
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <p style={{ color: "#888" }}>ยังไม่มีออเดอร์ในสถานะนี้</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            status={order._status}
            onAdvance={advanceStatus}
            onCancel={cancelOrder}
          />
        ))}
      </div>
    </div>
  );
}
