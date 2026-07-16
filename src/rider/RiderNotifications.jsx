import { useMemo, useState } from "react";
import {
  Bike,
  CheckCheck,
  CheckCircle2,
  ChefHat,
  Package,
  PackageCheck,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { usePreferences } from "../context/PreferencesContext";
import { useRiderOrders } from "./useRiderOrders";
import { normalizeStatus, toDate } from "../store/orderStatus";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

// เหมือนหน้า Notifications ของลูกค้า: read-flag ไม่มีที่เก็บใน Firestore
// (rules ไม่มี collection notifications และห้ามเพิ่ม schema) จึงเก็บ per-device
// ใน localStorage ด้วยแนวทางเดียวกัน แต่แยก key ของไรเดอร์
const READ_STORAGE_KEY = "lkfc_rider_read_notifications";

// สถานะจริงของออเดอร์ -> หมวดแจ้งเตือน (key แปลภาษาผ่าน ro.cat.* / ro.msg.*)
const STATUS_CATEGORY = {
  pending: "newOrder",
  accepted: "accepted",
  cooking: "preparing",
  ready_for_delivery: "readyPickup",
  picked_up: "delivering",
  delivering: "delivering",
  completed: "completed",
  cancelled: "cancelled",
};

const CATEGORY_ICON = {
  newOrder: ShoppingBag,
  accepted: CheckCircle2,
  preparing: ChefHat,
  readyPickup: Bike,
  delivering: Truck,
  completed: PackageCheck,
  cancelled: XCircle,
};

// เวลาแบบ relative เช่น "5 นาทีที่แล้ว" — สั้น อ่านง่ายบนมือถือ (แปลภาษาผ่าน t)
const timeAgo = (d, t) => {
  if (!d) return "-";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("ro.justNow");
  if (mins < 60) return t("ro.minAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("ro.hrAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("ro.dayAgo", { n: days });
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

const NotificationCard = ({ notification, onRead, t }) => {
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
            <h3 className="font-bold text-gray-900">{t(`ro.cat.${notification.category}`)}</h3>
            <Badge color={notification.read ? "blue" : "green"}>
              {notification.read ? t("ro.read") : t("ro.unread")}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-400 font-bold mt-2">
            {notification.orderNo} · {timeAgo(notification.when, t)}
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
  const { user } = useAuth();
  const { t } = usePreferences();
  const { orders, loading } = useRiderOrders(user?.uid);
  const [readMap, setReadMap] = useState(() => loadReadMap());

  const notifications = useMemo(() => {
    return orders
      .map((order) => {
        const normalized = normalizeStatus(order.status);
        const category = STATUS_CATEGORY[normalized] ?? "newOrder";
        const key = `${order.id}__${normalized}`;
        const orderNo = order.orderNo || order.id;
        return {
          id: key,
          orderNo,
          category,
          message: t(`ro.msg.${category}`, { orderNo }),
          when: notificationTime(order),
          read: Boolean(readMap[key]),
        };
      })
      .sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0));
  }, [orders, readMap, t]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-gray-900">{t("ro.notif.title")}</h1>
          {unreadCount > 0 && <Badge color="green">{t("ro.new", { count: unreadCount })}</Badge>}
        </div>
        <Button variant="outline" className="!px-4 !py-2 text-sm" onClick={markAllRead}>
          <CheckCheck size={16} />
          {t("ro.markAllRead")}
        </Button>
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
          title={t("ro.notif.emptyTitle")}
          description={t("ro.notif.emptyDesc")}
        />
      ) : (
        <>
          {todayList.length > 0 && (
            <div className="space-y-3">
              <SectionTitle>{t("ro.today")}</SectionTitle>
              {todayList.map((n) => (
                <NotificationCard key={n.id} notification={n} onRead={markRead} t={t} />
              ))}
            </div>
          )}
          {earlierList.length > 0 && (
            <div className="space-y-3">
              <SectionTitle>{t("ro.earlier")}</SectionTitle>
              {earlierList.map((n) => (
                <NotificationCard key={n.id} notification={n} onRead={markRead} t={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
