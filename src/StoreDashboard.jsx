import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import NewOrderNotifier from "./NewOrderNotifier.jsx";
import { useAuth } from "./AuthContext.jsx";
import { STORE_ID } from "./config";

const toDate = (createdAt) => {
  if (!createdAt) return null;
  return createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
};

const isSameDay = (d, ref) =>
  d &&
  d.getDate() === ref.getDate() &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();

const isSameMonth = (d, ref) =>
  d && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

const card = {
  background: "#1e1e1e",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
};

function StoreDashboard() {
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const { logout } = useAuth();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const rq = query(collection(db, "reviews"), where("storeId", "==", STORE_ID));
    const unsubRev = onSnapshot(rq, (snapshot) => {
      setReviews(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubscribe();
      unsubRev();
    };
  }, []);

  const now = new Date();
  const completed = orders.filter((o) => o.status === "เสร็จสิ้น");

  const salesToday = completed
    .filter((o) => isSameDay(toDate(o.createdAt), now))
    .reduce((s, o) => s + (o.grandTotal || 0), 0);

  const salesMonth = completed
    .filter((o) => isSameMonth(toDate(o.createdAt), now))
    .reduce((s, o) => s + (o.grandTotal || 0), 0);

  const countBy = (status) => orders.filter((o) => o.status === status).length;

  // เมนูขายดี
  const menuCount = {};
  completed.forEach((o) => {
    (o.items || []).forEach((it) => {
      menuCount[it.name] = (menuCount[it.name] || 0) + (it.qty || 1);
    });
  });
  const bestSeller = Object.entries(menuCount).sort((a, b) => b[1] - a[1])[0];

  // คะแนนร้าน
  const reviewCount = reviews.length;
  const storeRating =
    reviewCount > 0
      ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount).toFixed(1)
      : "-";

  // กราฟยอดขาย 7 วันล่าสุด
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const total = completed
      .filter((o) => isSameDay(toDate(o.createdAt), d))
      .reduce((s, o) => s + (o.grandTotal || 0), 0);
    days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total });
  }
  const maxSale = Math.max(1, ...days.map((d) => d.total));

  const Stat = ({ label, value, color }) => (
    <div style={card}>
      <div style={{ color: "#999", fontSize: "14px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: "bold", color: color || "#fff" }}>
        {value}
      </div>
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
      <NewOrderNotifier />

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>📊 Dashboard ร้านค้า</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link to="/store">
            <button style={navBtn}>📦 ออเดอร์</button>
          </Link>
          <Link to="/store/menu">
            <button style={navBtn}>🍽️ จัดการเมนู</button>
          </Link>
          <button style={{ ...navBtn, background: "#e53935" }} onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        <Stat label="ยอดขายวันนี้" value={`${salesToday} ฿`} color="#ff8c00" />
        <Stat label="ยอดขายเดือนนี้" value={`${salesMonth} ฿`} color="#ff8c00" />
        <Stat label="จำนวนออเดอร์ทั้งหมด" value={orders.length} />
        <Stat label="กำลังทำ" value={countBy("กำลังทำ")} color="#ffb74d" />
        <Stat
          label="กำลังจัดส่ง"
          value={countBy("กำลังจัดส่ง") + countBy("ส่งให้ไรเดอร์")}
          color="#4fc3f7"
        />
        <Stat label="เสร็จสิ้น" value={countBy("เสร็จสิ้น")} color="#22c55e" />
        <Stat
          label="เมนูขายดีที่สุด"
          value={bestSeller ? `${bestSeller[0]} (${bestSeller[1]})` : "-"}
        />
        <Stat label="คะแนนร้าน" value={`⭐ ${storeRating}`} color="#ffd54f" />
        <Stat label="จำนวนรีวิว" value={reviewCount} />
      </div>

      {/* กราฟยอดขาย 7 วัน */}
      <div style={{ ...card, marginTop: "16px" }}>
        <div style={{ color: "#999", fontSize: "14px", marginBottom: "10px" }}>
          กราฟยอดขาย 7 วันล่าสุด
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "8px",
            height: "160px",
          }}
        >
          {days.map((d) => (
            <div key={d.label} style={{ flex: 1, textAlign: "center" }}>
              <div
                title={`${d.total} ฿`}
                style={{
                  height: `${(d.total / maxSale) * 120}px`,
                  background: "#ff8c00",
                  borderRadius: "6px 6px 0 0",
                  minHeight: "2px",
                }}
              />
              <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                {d.label}
              </div>
              <div style={{ fontSize: "11px" }}>{d.total}</div>
            </div>
          ))}
        </div>
      </div>

      {/* รีวิวทั้งหมด */}
      <div style={{ ...card, marginTop: "16px" }}>
        <div style={{ color: "#999", fontSize: "14px", marginBottom: "10px" }}>
          รีวิวทั้งหมด ({reviewCount})
        </div>
        {reviews.length === 0 && <div style={{ color: "#777" }}>ยังไม่มีรีวิว</div>}
        {reviews.map((r) => (
          <div
            key={r.id}
            style={{
              borderTop: "1px solid #333",
              padding: "8px 0",
              fontSize: "14px",
            }}
          >
            <div style={{ color: "#ffd54f" }}>
              {"★".repeat(r.rating || 0)}{" "}
              <span style={{ color: "#999" }}>{r.customerName}</span>
            </div>
            {r.comment && <div>{r.comment}</div>}
          </div>
        ))}
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

export default StoreDashboard;
