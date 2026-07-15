import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { AlertCircle, Bell, History, LogOut, Power, Settings, User, Wallet, WifiOff } from "lucide-react";
import { db } from "../firebase";
import { STORE_ID } from "../config";
import { useAuth } from "../AuthContext.jsx";
import RiderOrderCard from "./RiderOrderCard.jsx";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Loading } from "../components/ui/Loading";
import {
  DELIVERED_STATUS,
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_QUERY_STATUSES,
  READY_STATUS,
  isReadyForDelivery,
} from "./riderStatus";
import { byNewest, normalizeStatus } from "../store/orderStatus";
import { useStoreStatus } from "../store/useStoreStatus";
import { updateOrderStatus, completeOrder } from "../store/orderEngine";
import { acceptOrder, rejectOrder, hasRejected } from "./riderAcceptReject";
import { logError } from "../errorCenter";

// ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID}
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

// เหตุผลที่รับ/ปฏิเสธงานไม่สำเร็จ (reason จาก riderAcceptReject) -> ข้อความที่ไรเดอร์เข้าใจ
// ที่สำคัญที่สุดคือ already_taken: ไรเดอร์ต้องรู้ว่าโดนตัดหน้า ไม่ใช่กดแล้วเงียบ
const ACTION_ERROR = {
  already_taken: "Another rider just took this delivery.",
  not_ready: "This delivery is no longer ready for pickup.",
  offered_to_other: "This delivery is reserved for another rider right now.",
  not_found: "This delivery no longer exists.",
  invalid: "Couldn't accept this delivery. Please try again.",
  error: "Something went wrong. Please try again.",
};

const actionMessage = (reason) => ACTION_ERROR[reason] || ACTION_ERROR.error;

// feed พังคนละตัวคนละความหมาย: พูลงานว่าง vs คิวงานที่รับไว้แล้ว
const FEED_ERROR = {
  available: "Couldn't load available deliveries. Check your connection and refresh.",
  mine: "Couldn't load your accepted deliveries. Check your connection and refresh.",
};

// Rider Dashboard ใหม่: เห็นงานพร้อมส่งทั้งหมด, รับงานได้, อัปเดตสถานะแบบ realtime
export default function RiderOrdersDashboard() {
  const { user, profile, logout } = useAuth();
  // Same live store status the Store portal writes / Customer reads — new orders can't
  // be created while closed, so no new jobs arrive; this just tells the rider why.
  const { status: storeStatus } = useStoreStatus("store");
  const storeClosed = storeStatus === "closed";
  const [availablePool, setAvailablePool] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("available");
  // ข้อผิดพลาดจากการกดปุ่ม (รับ/ปฏิเสธ/สลับสถานะ) กับจากตัว feed เอง แยกกันคนละก้อน
  const [actionError, setActionError] = useState("");
  // แยกราย feed: feed หนึ่งหายดีต้องไม่ไปล้าง error ของอีก feed ที่ยังพังอยู่
  const [feedErrors, setFeedErrors] = useState({ available: "", mine: "" });
  // ออเดอร์ที่กำลังยิง action อยู่ — กันกดซ้ำ/กดหลายใบพร้อมกัน
  const [busyId, setBusyId] = useState("");
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
    // สถานะพร้อมส่งรวม alias เดิมด้วย (ออเดอร์เก่ายังเป็นภาษาไทย) — ใช้ "in" แบบเดียวกับ Kitchen
    const availableQ = query(collection(db, "orders"), where("status", "in", READY_QUERY_STATUSES));
    const mineQ = query(collection(db, "orders"), where("riderId", "==", user.uid));
    const markFeed = (key, msg) =>
      setFeedErrors((prev) => (prev[key] === msg ? prev : { ...prev, [key]: msg }));
    // ถ้า feed พัง (สิทธิ์/เน็ต) ต้องเลิกหมุนแล้วบอกเหตุผล ไม่ใช่ค้างที่ Loading ตลอดกาล
    const onFeedError = (err, key) => {
      logError(err, `RiderOrdersDashboard.${key}`);
      markFeed(key, FEED_ERROR[key]);
      setLoading(false);
    };
    const unsubAvailable = onSnapshot(
      availableQ,
      (snapshot) => {
        setAvailablePool(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        markFeed("available", "");
        setLoading(false);
      },
      (err) => onFeedError(err, "available")
    );
    const unsubMine = onSnapshot(
      mineQ,
      (snapshot) => {
        setMyJobs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        markFeed("mine", "");
        setLoading(false);
      },
      (err) => onFeedError(err, "mine")
    );
    const unsubStore = onSnapshot(
      doc(db, "stores", STORE_ID),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setStoreLocation({
            lat: data.lat ?? FALLBACK_STORE_LAT,
            lng: data.lng ?? FALLBACK_STORE_LNG,
            name: data.storeName || "LK Fried Chicken",
          });
        }
      },
      // ตำแหน่งร้านมี fallback อยู่แล้ว — ล้มเหลวได้โดยไม่ต้องกวนไรเดอร์
      (err) => logError(err, "RiderOrdersDashboard.store")
    );
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
  const feedError = feedErrors.available || feedErrors.mine;

  // งานว่าง (riderId=="") กับงานของไรเดอร์ (riderId==uid) เป็นเซตที่ไม่ทับกัน รวมได้ตรง ๆ
  const orders = availablePool.concat(myJobs);

  // งานที่ไรเดอร์คนนี้กดปฏิเสธไปแล้ว ไม่ต้องโผล่ในพูลของเขาอีก (ของคนอื่นยังเห็นปกติ)
  const availableOrders = orders
    .filter((o) => !o.riderId && isReadyForDelivery(o.status) && !hasRejected(o, user?.uid))
    .sort(byNewest());

  // คิวงานของไรเดอร์คนนี้ แยกตามสถานะเดิม: Assigned (picked_up) / Active (delivering) / Completed
  const mine = orders.filter((o) => o.riderId === user?.uid);
  const assignedOrders = mine.filter((o) => o.status === PICKED_UP_STATUS).sort(byNewest());
  const activeOrders = mine.filter((o) => o.status === DELIVERING_STATUS).sort(byNewest());
  const completedOrders = mine
    .filter((o) => normalizeStatus(o.status) === DELIVERED_STATUS)
    .sort(byNewest());

  // สลับความพร้อมรับงาน — เขียน users/{uid}.riderStatus (ฟิลด์เดิม ไม่เพิ่ม schema)
  const toggleAvailability = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        riderStatus: isOnline ? "offline" : "online",
      });
      setActionError("");
    } catch (e) {
      logError(e, "RiderOrdersDashboard.toggleAvailability");
      setActionError("Couldn't update your availability. Please try again.");
    }
  };

  // ตัวตนของไรเดอร์ที่เขียนลงออเดอร์ — รูปแบบเดียวกับที่ assignRider เคยใช้
  const riderIdentity = () => ({
    uid: user.uid,
    name: profile?.name || profile?.riderName || user.email || "ไรเดอร์",
    phone: profile?.phone || "",
  });

  // รับงาน: ผ่าน acceptOrder (transaction) เท่านั้น — re-read ออเดอร์ใน transaction แล้วเคลมต่อเมื่อ
  // ยังพร้อมส่งและยังไม่มีคนรับ จึงกันสองไรเดอร์กดพร้อมกันแล้วได้งานใบเดียวกันทั้งคู่
  // (assignRider เดิมเป็น updateDoc ตรง ๆ จาก snapshot ในเครื่อง = เขียนทับกันเงียบ ๆ)
  // ต้องออนไลน์ก่อนถึงรับงานได้ (กันแย่งงานทั้งที่ปิดรับ)
  const acceptDelivery = async (order) => {
    if (!user || !isOnline || busyId) return;
    setBusyId(order.id);
    setActionError("");
    const { ok, reason } = await acceptOrder(order, riderIdentity());
    // สำเร็จแล้วออเดอร์จะหายจากแท็บ Available ไปโผล่ที่ Assigned — พาไรเดอร์ตามไปเลย
    if (ok) setTab("assigned");
    else setActionError(actionMessage(reason));
    setBusyId("");
  };

  // ปฏิเสธงาน: ออเดอร์ยังพร้อมส่งและว่างเหมือนเดิม แค่ซ่อนจากพูลของไรเดอร์คนนี้ (rejectedBy)
  const rejectDelivery = async (order) => {
    if (!user || busyId) return;
    setBusyId(order.id);
    setActionError("");
    const { ok, reason } = await rejectOrder(order, riderIdentity());
    if (!ok) setActionError(actionMessage(reason));
    setBusyId("");
  };
  const startDelivering = (order) => updateOrderStatus(order, DELIVERING_STATUS, { by: user?.uid });
  const markDelivered = (order) => completeOrder(order, user?.uid);

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
          <div className="flex gap-2 items-center">
            <NotificationBell />
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

        {/* feed พัง = ไม่มีข้อมูลให้เชื่อถือ ต้องบอกตรง ๆ แทนที่จะโชว์ "ไม่มีงาน" ทั้งที่อาจมี */}
        {feedError && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
            <WifiOff size={20} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-black text-sm">Can't load deliveries</p>
              <p className="text-xs font-medium text-red-500 mt-0.5">{feedError}</p>
            </div>
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600"
          >
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm font-bold min-w-0 flex-1">{actionError}</p>
            <button
              onClick={() => setActionError("")}
              className="text-xs font-black text-red-400 hover:text-red-600 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {tab === "available" && storeClosed && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600">
            <Power size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm">Store is closed</p>
              <p className="text-xs font-medium text-red-500 mt-0.5">
                No new orders arrive while the store is closed. Deliveries already prepared still appear below.
              </p>
            </div>
          </div>
        )}

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
                busy={busyId === order.id}
                disabled={Boolean(busyId) && busyId !== order.id}
                onAccept={acceptDelivery}
                onReject={rejectDelivery}
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
