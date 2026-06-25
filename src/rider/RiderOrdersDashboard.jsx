import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { useAuth } from "../AuthContext.jsx";
import RiderOrderCard from "./RiderOrderCard.jsx";
import {
  DELIVERED_STATUS,
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_STATUS,
  isReadyForDelivery,
} from "./riderStatus";

// ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID}
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

const navBtn = {
  padding: "8px 14px",
  borderRadius: "20px",
  border: "none",
  background: "#ff8c00",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

// Rider Dashboard ใหม่: เห็นงานพร้อมส่งทั้งหมด, รับงานได้, อัปเดตสถานะแบบ realtime
export default function RiderOrdersDashboard() {
  const { user, profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("available");
  const [storeLocation, setStoreLocation] = useState({
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
    name: "LK Fried Chicken",
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubStore = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStoreLocation({
          lat: data.lat ?? FALLBACK_STORE_LAT,
          lng: data.lng ?? FALLBACK_STORE_LNG,
          name: data.storeName || "LK Fried Chicken",
        });
      }
    });
    return () => {
      unsubscribe();
      unsubStore();
    };
  }, []);

  const availableOrders = orders.filter(
    (o) => !o.riderId && isReadyForDelivery(o.status)
  );

  const myOrders = orders
    .filter(
      (o) =>
        o.riderId === user?.uid &&
        (o.status === PICKED_UP_STATUS || o.status === DELIVERING_STATUS)
    )
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });

  // รับงาน: บันทึก riderId/riderName + ย้ายสถานะเป็น "picked_up" (ออเดอร์พร้อมส่งอยู่แล้วที่เคาน์เตอร์)
  const acceptDelivery = async (orderId) => {
    if (!user) return;
    await updateDoc(doc(db, "orders", orderId), {
      riderId: user.uid,
      riderName: profile?.name || profile?.riderName || user.email || "ไรเดอร์",
      riderPhone: profile?.phone || "",
      status: PICKED_UP_STATUS,
      acceptedAt: serverTimestamp(),
      pickedUpAt: serverTimestamp(),
    });
  };

  const startDelivering = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), {
      status: DELIVERING_STATUS,
    });
  };

  const markDelivered = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), {
      status: DELIVERED_STATUS,
      deliveredAt: serverTimestamp(),
    });
  };

  const list = tab === "available" ? availableOrders : myOrders;

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>🛵 Rider Dashboard</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link to="/rider/profile">
            <button style={navBtn}>👤 โปรไฟล์</button>
          </Link>
          <button style={{ ...navBtn, background: "#e53935" }} onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => setTab("available")}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: tab === "available" ? "#ff9800" : "#2a2a2a",
            color: "#fff",
          }}
        >
          📦 งานพร้อมส่ง ({availableOrders.length})
        </button>
        <button
          onClick={() => setTab("mine")}
          style={{
            padding: "10px 16px",
            borderRadius: "20px",
            border: "none",
            cursor: "pointer",
            fontWeight: "bold",
            background: tab === "mine" ? "#ff9800" : "#2a2a2a",
            color: "#fff",
          }}
        >
          🛵 งานของฉัน ({myOrders.length})
        </button>
      </div>

      {list.length === 0 && (
        <p style={{ color: "#888" }}>
          {tab === "available" ? "ยังไม่มีงานพร้อมส่ง" : "คุณยังไม่มีงานที่กำลังจัดส่ง"}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {list.map((order) => (
          <RiderOrderCard
            key={order.id}
            order={order}
            effectiveStatus={tab === "available" ? READY_STATUS : order.status}
            storeLocation={storeLocation}
            onAccept={acceptDelivery}
            onStartDelivering={startDelivering}
            onDelivered={markDelivered}
          />
        ))}
      </div>
    </div>
  );
}
