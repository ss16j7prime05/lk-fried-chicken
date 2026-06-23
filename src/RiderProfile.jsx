import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

const toDate = (createdAt) => {
  if (!createdAt) return null;
  return createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
};
const isToday = (d, ref) =>
  d &&
  d.getDate() === ref.getDate() &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();

const vehicleLabel = (v) =>
  v === "car" ? "รถยนต์" : v === "motorcycle" ? "มอเตอร์ไซค์" : v || "-";

function RiderProfile() {
  const { profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, "orders"), where("riderId", "==", uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const rq = query(collection(db, "reviews"), where("riderId", "==", uid));
    const unsubRev = onSnapshot(rq, (snapshot) => {
      setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubscribe();
      unsubRev();
    };
  }, []);

  const now = new Date();
  const totalJobs = orders.length;
  const todayJobs = orders.filter((o) => isToday(toDate(o.createdAt), now)).length;
  // คะแนนเฉลี่ยจากรีวิวจริง
  const reviewCount = reviews.length;
  const rating =
    reviewCount > 0
      ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount).toFixed(1)
      : "-";

  const Row = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #333" }}>
      <span style={{ color: "#999" }}>{label}</span>
      <span style={{ fontWeight: "bold" }}>{value}</span>
    </div>
  );

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
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px" }}>🛵 โปรไฟล์ไรเดอร์</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link to="/rider">
            <button style={navBtn}>📦 งาน</button>
          </Link>
          <button style={{ ...navBtn, background: "#e53935" }} onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#1e1e1e",
          borderRadius: "16px",
          padding: "20px",
          maxWidth: "420px",
        }}
      >
        <Row label="ชื่อ" value={profile?.name || profile?.riderName || "-"} />
        <Row label="เบอร์โทร" value={profile?.phone || "-"} />
        <Row label="ประเภทรถ" value={vehicleLabel(profile?.vehicleType)} />
        <Row label="จำนวนงานทั้งหมด" value={totalJobs} />
        <Row label="งานวันนี้" value={todayJobs} />
        <Row label="คะแนนเฉลี่ย" value={`⭐ ${rating}`} />
        <Row label="จำนวนรีวิว" value={reviewCount} />
      </div>
    </div>
  );
}

const navBtn = {
  padding: "8px 14px",
  borderRadius: "20px",
  border: "none",
  background: "#ff8c00",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

export default RiderProfile;
