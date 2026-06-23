import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { STORE_ID } from "./config";
import { useAuth } from "./AuthContext.jsx";

const toDate = (c) => (c ? (c.toDate ? c.toDate() : new Date(c)) : null);
const isSameDay = (d, ref) =>
  d &&
  d.getDate() === ref.getDate() &&
  d.getMonth() === ref.getMonth() &&
  d.getFullYear() === ref.getFullYear();

const card = {
  background: "#1e1e1e",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
};

function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "orders"), (s) =>
      setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(collection(db, "users"), (s) =>
      setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u3 = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) setIsOpen(snap.data().isOpen !== false);
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const now = new Date();
  const completed = orders.filter((o) => o.status === "เสร็จสิ้น");
  const totalSales = completed.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const salesToday = completed
    .filter((o) => isSameDay(toDate(o.createdAt), now))
    .reduce((s, o) => s + (o.grandTotal || 0), 0);
  const costOf = (o) =>
    (o.items || []).reduce((s, it) => s + (it.cost || 0) * (it.qty || 1), 0);
  const profitTotal = completed.reduce(
    (s, o) => s + ((o.grandTotal || 0) - costOf(o)),
    0
  );

  const customers = users.filter((u) => u.role === "customer").length;
  const riders = users.filter((u) => u.role === "rider").length;

  const menuCount = {};
  completed.forEach((o) =>
    (o.items || []).forEach((it) => {
      menuCount[it.name] = (menuCount[it.name] || 0) + (it.qty || 1);
    })
  );
  const best = Object.entries(menuCount).sort((a, b) => b[1] - a[1])[0];

  // ลูกค้าที่ใช้จ่ายสูงสุด
  const custSpend = {};
  completed.forEach((o) => {
    const key = o.customerName || o.phone || "-";
    custSpend[key] = (custSpend[key] || 0) + (o.grandTotal || 0);
  });
  const topCustomers = Object.entries(custSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ไรเดอร์ที่ส่งมากสุด
  const riderJobs = {};
  completed.forEach((o) => {
    if (o.riderName) riderJobs[o.riderName] = (riderJobs[o.riderName] || 0) + 1;
  });
  const topRiders = Object.entries(riderJobs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // กราฟยอดขาย 7 วัน
  const sevenDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const total = completed
      .filter((o) => isSameDay(toDate(o.createdAt), d))
      .reduce((s, o) => s + (o.grandTotal || 0), 0);
    sevenDays.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total });
  }
  const maxSale = Math.max(1, ...sevenDays.map((d) => d.total));

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>📈 Admin Dashboard</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link to="/admin">
            <button style={navBtn}>📦 ออเดอร์</button>
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
        <Stat label="ลูกค้าทั้งหมด" value={customers} />
        <Stat label="ไรเดอร์ทั้งหมด" value={riders} />
        <Stat label="ออเดอร์ทั้งหมด" value={orders.length} />
        <Stat label="ยอดขายรวม" value={`${totalSales} ฿`} color="#ff8c00" />
        <Stat label="ยอดขายวันนี้" value={`${salesToday} ฿`} color="#ff8c00" />
        <Stat label="กำไรรวม" value={`${profitTotal} ฿`} color="#22c55e" />
        <Stat
          label="สถานะร้าน"
          value={isOpen ? "เปิด" : "ปิด"}
          color={isOpen ? "#22c55e" : "#e53935"}
        />
        <Stat label="เมนูขายดี" value={best ? `${best[0]} (${best[1]})` : "-"} />
      </div>

      {/* กราฟยอดขาย 7 วัน */}
      <div style={{ ...card, marginTop: "16px" }}>
        <div style={{ color: "#999", fontSize: "14px", marginBottom: "10px" }}>
          กราฟยอดขาย 7 วันล่าสุด
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "160px" }}>
          {sevenDays.map((d) => (
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
              <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{d.label}</div>
              <div style={{ fontSize: "11px" }}>{d.total}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top customers / riders */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "16px",
          marginTop: "16px",
        }}
      >
        <div style={card}>
          <div style={{ color: "#999", fontSize: "14px", marginBottom: "8px" }}>
            ลูกค้าที่ใช้จ่ายสูงสุด
          </div>
          {topCustomers.length === 0 && <div style={{ color: "#777" }}>-</div>}
          {topCustomers.map(([name, amt], i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{i + 1}. {name}</span>
              <span style={{ color: "#ff8c00" }}>{amt} ฿</span>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ color: "#999", fontSize: "14px", marginBottom: "8px" }}>
            ไรเดอร์ส่งมากสุด
          </div>
          {topRiders.length === 0 && <div style={{ color: "#777" }}>-</div>}
          {topRiders.map(([name, jobs], i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>{i + 1}. {name}</span>
              <span style={{ color: "#4fc3f7" }}>{jobs} งาน</span>
            </div>
          ))}
        </div>
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

export default AdminDashboard;
