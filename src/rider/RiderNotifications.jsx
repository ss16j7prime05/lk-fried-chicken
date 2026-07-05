import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import {
  Bike,
  CheckCheck,
  CheckCircle2,
  ChefHat,
  History,
  LogOut,
  Package,
  PackageCheck,
  Settings,
  ShoppingBag,
  Truck,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../AuthContext.jsx";
import { normalizeStatus } from "../store/orderStatus";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

// เหมือนหน้า Notifications ของลูกค้า: read-flag ไม่มีที่เก็บใน Firestore
// (rules ไม่มี collection notifications และห้ามเพิ่ม schema) จึงเก็บ per-device
// ใน localStorage ด้วยแนวทางเดียวกัน แต่แยก key ของไรเดอร์
const READ_STORAGE_KEY = "lkfc_rider_read_notifications";

// หมวดแจ้งเตือนมุมไรเดอร์ จากสถานะจริงของออเดอร์ที่ไรเดอร์รับ (riderId == uid)
const STATUS_CATEGORY = {
  pending: "New Order",
  accepted: "Accepted",
  cooking: "Preparing",
  ready_for_delivery: "Ready for Pickup",
  picked_up: "Delivering",
  delivering: "Delivering",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CATEGORY_ICON = {
  "New Order": ShoppingBag,
  Accepted: CheckCircle2,
  Preparing: ChefHat,
  "Ready for Pickup": Bike,
  Delivering: Truck,
  Completed: PackageCheck,
  Cancelled: XCircle,
};

const CATEGORY_MESSAGE = {
  "New Order": (o) => `Order ${o.orderNo} has been placed and is awaiting the store.`,
  Accepted: (o) => `The store accepted order ${o.orderNo}.`,
  Preparing: (o) => `The store is preparing order ${o.orderNo}.`,
  "Ready for Pickup": (o) => `Order ${o.orderNo} is ready to pick up at the store.`,
  Delivering: (o) => `You are delivering order ${o.orderNo}.`,
  Completed: (o) => `Order ${o.orderNo} was delivered successfully.`,
  Cancelled: (o) => `Order ${o.orderNo} was cancelled.`,
};

const toDate = (ts) => (ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null);

// เวลาแบบ relative เช่น "5 นาทีที่แล้ว" — สั้น อ่านง่ายบนมือถือ
const timeAgo = (d) => {
  if (!d) return "-";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("th-TH");
};

const isToday = (d) => {
  if (!d) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

// เวลาของแจ้งเตือน = milestone ล่าสุดที่มีจริงบนออเดอร์ (ไม่สร้างข้อมูลใหม่)
const notificationTime = (o) =>
  toDate(o.deliveredAt ?? o.pickedUpAt ?? o.acceptedAt ?? o.createdAt);

const loadReadMap = () => {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveReadMap = (map) => {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore blocked/full localStorage
  }
};

const NotificationCardSkeleton = () => (
  <Card className="p-5 flex gap-4 animate-pulse">
    <div className="w-11 h-11 rounded-2xl bg-gray-100 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-32 bg-gray-100 rounded" />
      <div className="h-3 w-48 bg-gray-100 rounded" />
      <div className="h-3 w-20 bg-gray-100 rounded" />
    </div>
  </Card>
);

const NotificationCard = ({ notification, onRead }) => {
  const Icon = CATEGORY_ICON[notification.category] ?? Package;

  return (
    <div onClick={() => onRead(notification.id)} className="cursor-pointer">
      <Card
        className={`p-5 flex gap-4 hover:shadow-premium transition-shadow ${
          !notification.read ? "ring-2 ring-primary/10" : ""
        }`}
      >
        <div
          className={`p-3 rounded-2xl shrink-0 h-fit ${
            notification.read ? "bg-gray-50 text-gray-400" : "bg-primary-light text-primary"
          }`}
        >
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-gray-900">{notification.category}</h3>
            <Badge color={notification.read ? "blue" : "green"}>
              {notification.read ? "Read" : "Unread"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-400 font-bold mt-2">
            {notification.orderNo} · {timeAgo(notification.when)}
          </p>
        </div>
      </Card>
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-black text-gray-900">{children}</h2>
);

// แจ้งเตือนของไรเดอร์: derive จากออเดอร์จริงที่ riderId == uid (ไม่มี collection notifications)
// 1 ออเดอร์ = 1 แจ้งเตือนตามสถานะปัจจุบัน เหมือนแนวทางหน้า Notifications ของลูกค้า
export default function RiderNotifications() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(user?.uid));
  const [readMap, setReadMap] = useState(() => loadReadMap());

  useEffect(() => {
    if (!user?.uid) return;
    // query เดียวกับหน้าไรเดอร์อื่น ๆ (ไม่มี orderBy — ต้องมี composite index) เรียงฝั่ง client
    const q = query(collection(db, "orders"), where("riderId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const notifications = useMemo(() => {
    return orders
      .map((order) => {
        const normalized = normalizeStatus(order.status);
        const category = STATUS_CATEGORY[normalized] ?? "New Order";
        const key = `${order.id}__${normalized}`;
        return {
          id: key,
          orderNo: order.orderNo || order.id,
          category,
          message: CATEGORY_MESSAGE[category]?.(order) ?? `Order ${order.orderNo} was updated.`,
          when: notificationTime(order),
          read: Boolean(readMap[key]),
        };
      })
      .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0));
  }, [orders, readMap]);

  const todayList = notifications.filter((n) => isToday(n.when));
  const earlierList = notifications.filter((n) => !isToday(n.when));
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (key) => {
    setReadMap((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: true };
      saveReadMap(next);
      return next;
    });
  };

  const markAllRead = () => {
    setReadMap((prev) => {
      const next = { ...prev };
      notifications.forEach((n) => {
        next[n.id] = true;
      });
      saveReadMap(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
        {/* header — same pattern as the other rider pages */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900">Notifications</h1>
            {unreadCount > 0 && <Badge color="green">{unreadCount} New</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="!px-4 !py-2 text-sm" onClick={markAllRead}>
              <CheckCheck size={16} />
              Mark All Read
            </Button>
            <Link to="/rider">
              <Button variant="outline" className="!px-4 !py-2 text-sm">
                <Package size={16} />
                Jobs
              </Button>
            </Link>
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

        {loading ? (
          <div className="space-y-3">
            <NotificationCardSkeleton />
            <NotificationCardSkeleton />
            <NotificationCardSkeleton />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No notifications yet"
            description="Updates about your deliveries will show up here once you take a job."
          />
        ) : (
          <>
            {todayList.length > 0 && (
              <div className="space-y-3">
                <SectionTitle>Today</SectionTitle>
                {todayList.map((n) => (
                  <NotificationCard key={n.id} notification={n} onRead={markRead} />
                ))}
              </div>
            )}
            {earlierList.length > 0 && (
              <div className="space-y-3">
                <SectionTitle>Earlier</SectionTitle>
                {earlierList.map((n) => (
                  <NotificationCard key={n.id} notification={n} onRead={markRead} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
