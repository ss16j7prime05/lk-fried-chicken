import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { useAuth } from "../AuthContext.jsx";
import { adminNormalizeStatus, isSameDay, isSameMonth, toDate } from "./adminUtils";
import SummaryCards from "./SummaryCards.jsx";
import SalesChart from "./SalesChart.jsx";
import TopMenuChart from "./TopMenuChart.jsx";
import OrdersPanel from "./OrdersPanel.jsx";
import CustomersPanel from "./CustomersPanel.jsx";
import RidersPanel from "./RidersPanel.jsx";
import StoresPanel from "./StoresPanel.jsx";
import ReportsPanel from "./ReportsPanel.jsx";
import PaymentsPanel from "./PaymentsPanel.jsx";
import NewOrderAlert from "./NewOrderAlert.jsx";

const navBtn = {
  padding: "8px 14px",
  borderRadius: "20px",
  border: "none",
  background: "#ff8c00",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const TABS = ["dashboard", "orders", "payments", "customers", "riders", "stores", "reports"];
const TAB_LABEL = {
  dashboard: "📊 ภาพรวม",
  orders: "📦 ออเดอร์",
  payments: "💳 การชำระเงิน",
  customers: "👤 ลูกค้า",
  riders: "🛵 ไรเดอร์",
  stores: "🏪 ร้านค้า",
  reports: "⬇️ รายงาน",
};

// Admin Control Center: รวมทุกฟีเจอร์ของ Admin Dashboard ใหม่ในที่เดียว แยกจากหน้า Admin เดิมทั้งหมด
export default function AdminControlCenter() {
  const { logout } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "orders"), (s) =>
      setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(collection(db, "users"), (s) =>
      setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u3 = onSnapshot(collection(db, "blockedCustomers"), (s) =>
      setBlocked(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u4 = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
      if (snap.exists()) setIsOpen(snap.data().isOpen !== false);
    });
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const customers = users.filter((u) => u.role === "customer");
  const riders = users.filter((u) => u.role === "rider");
  const stores = users.filter((u) => u.role === "store");

  const now = new Date();
  const completed = orders.filter((o) => adminNormalizeStatus(o.status) === "completed");
  const salesToday = completed
    .filter((o) => isSameDay(toDate(o.createdAt), now))
    .reduce((s, o) => s + (o.grandTotal || 0), 0);
  const salesMonth = completed
    .filter((o) => isSameMonth(toDate(o.createdAt), now))
    .reduce((s, o) => s + (o.grandTotal || 0), 0);

  const countByStatus = (status) =>
    orders.filter((o) => adminNormalizeStatus(o.status) === status).length;

  const summaryStats = [
    { label: "ยอดขายวันนี้", value: `${salesToday} ฿`, color: "#ff8c00" },
    { label: "ยอดขายเดือนนี้", value: `${salesMonth} ฿`, color: "#ff8c00" },
    { label: "ออเดอร์ทั้งหมด", value: orders.length },
    { label: "ลูกค้าทั้งหมด", value: customers.length },
    { label: "ไรเดอร์ทั้งหมด", value: riders.length },
    { label: "ร้านค้าทั้งหมด", value: stores.length },
    { label: "รอรับออเดอร์", value: countByStatus("pending"), color: "#e53935" },
    { label: "กำลังปรุง", value: countByStatus("cooking"), color: "#ffb74d" },
    { label: "กำลังจัดส่ง", value: countByStatus("delivering"), color: "#4fc3f7" },
    { label: "เสร็จสิ้น", value: countByStatus("completed"), color: "#22c55e" },
  ];

  const sevenDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const total = completed
      .filter((o) => isSameDay(toDate(o.createdAt), d))
      .reduce((s, o) => s + (o.grandTotal || 0), 0);
    sevenDays.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total });
  }

  const menuCount = {};
  completed.forEach((o) => {
    (o.items || []).forEach((it) => {
      menuCount[it.name] = (menuCount[it.name] || 0) + (it.qty || 1);
    });
  });
  const top10 = Object.entries(menuCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

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
      <NewOrderAlert orders={orders} />

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>🛠️ Admin Control Center</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link to="/admin/dashboard">
            <button style={navBtn}>📈 Dashboard เดิม</button>
          </Link>
          <button style={{ ...navBtn, background: "#e53935" }} onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", overflowX: "auto", paddingBottom: "6px" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              background: tab === t ? "#ff9800" : "#2a2a2a",
              color: "#fff",
            }}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SummaryCards stats={summaryStats} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <SalesChart days={sevenDays} />
            <TopMenuChart items={top10} />
          </div>
        </div>
      )}

      {tab === "orders" && <OrdersPanel orders={orders} />}
      {tab === "payments" && <PaymentsPanel orders={orders} />}
      {tab === "customers" && (
        <CustomersPanel customers={customers} blocked={blocked} orders={orders} />
      )}
      {tab === "riders" && <RidersPanel riders={riders} orders={orders} />}
      {tab === "stores" && <StoresPanel stores={stores} isOpen={isOpen} orders={orders} />}
      {tab === "reports" && (
        <ReportsPanel orders={orders} customers={customers} riders={riders} />
      )}
    </div>
  );
}
