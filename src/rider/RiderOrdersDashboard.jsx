import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { Bell, History, LogOut, Power, Settings, User, Wallet } from "lucide-react";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { useAuth } from "../AuthContext.jsx";
import RiderOrderCard from "./RiderOrderCard.jsx";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Loading } from "../components/ui/Loading";
import {
  DELIVERED_STATUS,
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_STATUS,
  isReadyForDelivery,
} from "./riderStatus";
import { normalizeStatus } from "../store/orderStatus";

// ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID}
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

// Rider Dashboard ใหม่: เห็นงานพร้อมส่งทั้งหมด, รับงานได้, อัปเดตสถานะแบบ realtime
export default function RiderOrdersDashboard() {
  const { user, profile, logout } = useAuth();
  const [availablePool, setAvailablePool] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("available");
  // ความพร้อมรับงาน อ่านแบบ realtime จาก users/{uid}.riderStatus (ฟิลด์เดียวกับ RiderSettings/Admin)
  const [riderStatus, setRiderStatus] = useState(profile?.riderStatus || "offline");
  const [storeLocation, setStoreLocation] = useState({
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
    name: "LK Fried Chicken",
  });

  useEffect(() => {
    if (!user?.uid) return;
    // แทนการ subscribe ทั้ง collection: ดึงเฉพาะพูลงานว่าง (status พร้อมส่ง) + งานของไรเดอร์คนนี้
    // ใช้ query pattern เดียวกับ History/Earnings/Notifications (where field == value)
    const availableQ = query(collection(db, "orders"), where("status", "==", READY_STATUS));
    const mineQ = query(collection(db, "orders"), where("riderId", "==", user.uid));
    const unsubAvailable = onSnapshot(availableQ, (snapshot) => {
      setAvailablePool(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubMine = onSnapshot(mineQ, (snapshot) => {
      setMyJobs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
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
      unsubAvailable();
      unsubMine();
      unsubStore();
    };
  }, [user?.uid]);

  // สถานะออนไลน์/ออฟไลน์ของไรเดอร์เอง (realtime) — RiderSettings เขียนฟิลด์เดียวกันนี้
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) setRiderStatus(snap.data().riderStatus || "offline");
    });
    return () => unsub();
  }, [user?.uid]);

  const isOnline = riderStatus === "online";

  // งานว่าง (riderId=="") กับงานของไรเดอร์ (riderId==uid) เป็นเซตที่ไม่ทับกัน รวมได้ตรง ๆ
  const orders = availablePool.concat(myJobs);

  const availableOrders = orders.filter(
    (o) => !o.riderId && isReadyForDelivery(o.status)
  );

  // คิวงานของไรเดอร์คนนี้ แยกตามสถานะเดิม: Assigned (picked_up) / Active (delivering) / Completed
  const byNewest = (a, b) =>
    (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);

  const mine = orders.filter((o) => o.riderId === user?.uid);
  const assignedOrders = mine.filter((o) => o.status === PICKED_UP_STATUS).sort(byNewest);
  const activeOrders = mine.filter((o) => o.status === DELIVERING_STATUS).sort(byNewest);
  const completedOrders = mine
    .filter((o) => normalizeStatus(o.status) === DELIVERED_STATUS)
    .sort(byNewest);

  // สลับความพร้อมรับงาน — เขียน users/{uid}.riderStatus (ฟิลด์เดิม ไม่เพิ่ม schema)
  const toggleAvailability = async () => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), {
      riderStatus: isOnline ? "offline" : "online",
    });
  };

  // รับงาน: บันทึก riderId/riderName + ย้ายสถานะเป็น "picked_up" (ออเดอร์พร้อมส่งอยู่แล้วที่เคาน์เตอร์)
  // ต้องออนไลน์ก่อนถึงรับงานได้ (กันแย่งงานทั้งที่ปิดรับ)
  const acceptDelivery = async (orderId) => {
    if (!user || !isOnline) return;
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

  // แท็บทั้งหมด: พูลงานว่าง + คิวงานของไรเดอร์ (ใช้ RiderOrderCard ตัวเดิมทุกแท็บ)
  const TABS = [
    {
      key: "available",
      label: "Available",
      list: availableOrders,
      emptyTitle: "No deliveries available",
      emptyDesc: "New deliveries ready for pickup will show up here.",
    },
    {
      key: "assigned",
      label: "Assigned",
      list: assignedOrders,
      emptyTitle: "No assigned deliveries",
      emptyDesc: "Deliveries you accept will appear here until you start delivering.",
    },
    {
      key: "active",
      label: "Active",
      list: activeOrders,
      emptyTitle: "No active deliveries",
      emptyDesc: "Deliveries you're currently delivering will show up here.",
    },
    {
      key: "completed",
      label: "Completed",
      list: completedOrders,
      emptyTitle: "No completed deliveries",
      emptyDesc: "Deliveries you complete will show up here.",
    },
  ];
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const list = activeTab.list;

  if (loading) {
    return <Loading text="Loading deliveries..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900">Rider Dashboard</h1>
          <div className="flex gap-2">
            <Button
              variant={isOnline ? "primary" : "outline"}
              className={`!px-4 !py-2 text-sm ${
                isOnline ? "" : "text-gray-500"
              }`}
              onClick={toggleAvailability}
            >
              <Power size={16} />
              {isOnline ? "Online" : "Offline"}
            </Button>
            <Link to="/rider/profile">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <User size={16} />
                Profile
              </Button>
            </Link>
            <Link to="/rider/history">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <History size={16} />
                History
              </Button>
            </Link>
            <Link to="/rider/earnings">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Wallet size={16} />
                Earnings
              </Button>
            </Link>
            <Link to="/rider/notifications">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Bell size={16} />
                Notifications
              </Button>
            </Link>
            <Link to="/rider/settings">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Settings size={16} />
                Settings
              </Button>
            </Link>
            <Button
              variant="outline"
              className="!px-4 !py-2 text-sm text-secondary border-secondary/30 hover:border-secondary"
              onClick={logout}
            >
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
                tab === t.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-500 border-gray-100 hover:border-primary"
              }`}
            >
              {t.label} ({t.list.length})
            </button>
          ))}
        </div>

        {tab === "available" && !isOnline ? (
          <div className="space-y-4">
            <EmptyState
              icon="🌙"
              title="You're offline"
              description="Go online to see deliveries available for pickup. Deliveries you've already accepted stay in your Assigned and Active tabs."
            />
            <div className="flex justify-center">
              <Button className="!px-6" onClick={toggleAvailability}>
                <Power size={16} />
                Go Online
              </Button>
            </div>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="🛵"
            title={activeTab.emptyTitle}
            description={activeTab.emptyDesc}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((order) => (
              <RiderOrderCard
                key={order.id}
                order={order}
                effectiveStatus={tab === "available" ? READY_STATUS : order.status}
                storeLocation={storeLocation}
                isOnline={isOnline}
                onAccept={acceptDelivery}
                onStartDelivering={startDelivering}
                onDelivered={markDelivered}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
