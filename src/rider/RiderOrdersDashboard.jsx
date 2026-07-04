import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { History, LogOut, Settings, User } from "lucide-react";
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

// ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID}
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

// Rider Dashboard ใหม่: เห็นงานพร้อมส่งทั้งหมด, รับงานได้, อัปเดตสถานะแบบ realtime
export default function RiderOrdersDashboard() {
  const { user, profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("available");
  const [storeLocation, setStoreLocation] = useState({
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
    name: "LK Fried Chicken",
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  if (loading) {
    return <Loading text="Loading deliveries..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-black text-gray-900">Rider Dashboard</h1>
          <div className="flex gap-2">
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
          <button
            onClick={() => setTab("available")}
            className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
              tab === "available"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            Available Deliveries ({availableOrders.length})
          </button>
          <button
            onClick={() => setTab("mine")}
            className={`px-5 py-2 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all ${
              tab === "mine"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            My Deliveries ({myOrders.length})
          </button>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon="🛵"
            title={tab === "available" ? "No deliveries available" : "No active deliveries"}
            description={
              tab === "available"
                ? "New deliveries ready for pickup will show up here."
                : "Deliveries you accept will show up here until they're completed."
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        )}
      </div>
    </div>
  );
}
