import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChefHat,
  Bike,
  Truck,
  PartyPopper,
  PackageCheck,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "../../AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { normalizeStatus } from "../../store/orderStatus";
import { useCustomerOrders } from "./useCustomerOrders";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

// "Read" state has nowhere to live in Firestore: firestore.rules only grants
// customers create+read on `orders` (not update), so a per-notification read flag
// can't be written there. Tracked device-locally instead — same localStorage-only
// approach already used for the saved-address shortcut in Checkout.jsx.
const READ_STORAGE_KEY = "lkfc_read_notifications";

const CATEGORIES = [
  "All",
  "New Order",
  "Accepted",
  "Cooking",
  "Rider Assigned",
  "Delivering",
  "Completed",
  "Cancelled",
  "Promotion",
];

// Maps a real order's (normalized) status to one of this page's notification
// categories. ready_for_delivery and picked_up both collapse into "Rider Assigned"
// — from the customer's point of view both just mean "a rider is being sorted
// out" (same collapsing src/pages/customer/Orders.jsx already does for its own
// status filter tabs). There is no real "Promotion" data source in Firestore
// today, so that category is wired up but will simply have no entries — no
// promotion notifications are fabricated.
const STATUS_CATEGORY = {
  pending: "New Order",
  accepted: "Accepted",
  cooking: "Cooking",
  ready_for_delivery: "Rider Assigned",
  picked_up: "Rider Assigned",
  delivering: "Delivering",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CATEGORY_ICON = {
  "New Order": ShoppingBag,
  Accepted: CheckCircle2,
  Cooking: ChefHat,
  "Rider Assigned": Bike,
  Delivering: Truck,
  Completed: PackageCheck,
  Cancelled: XCircle,
  Promotion: PartyPopper,
};

// Category display string -> i18n subkey (for both label and message lookups).
const CATEGORY_TKEY = {
  All: "all",
  "New Order": "newOrder",
  Accepted: "accepted",
  Cooking: "cooking",
  "Rider Assigned": "riderAssigned",
  Delivering: "delivering",
  Completed: "completed",
  Cancelled: "cancelled",
  Promotion: "promotion",
};

const formatDateTime = (timestamp, locale) => {
  const d = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(locale === "th" ? "th-TH" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

const NotificationCard = ({ notification, onOpen }) => {
  const { t, language } = usePreferences();
  const Icon = CATEGORY_ICON[notification.category] ?? PartyPopper;

  return (
    <div onClick={() => onOpen(notification)} className="cursor-pointer">
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
            <h3 className="font-bold text-gray-900">
              {t(`notif.cat.${CATEGORY_TKEY[notification.category] ?? "newOrder"}`)}
            </h3>
            <Badge color={notification.read ? "blue" : "green"}>
              {notification.read ? t("notif.read") : t("notif.unread")}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-400 font-bold mt-2">
            {formatDateTime(notification.createdAt, language)}
          </p>
        </div>
      </Card>
    </div>
  );
};

export const Notifications = () => {
  const { profile } = useAuth();
  const { t } = usePreferences();
  const navigate = useNavigate();

  const [retryToken, setRetryToken] = useState(0);
  const { orders, loading, error } = useCustomerOrders(profile?.phone, {
    retryToken,
    errorMessage: t("notif.error"),
  });
  const [activeCategory, setActiveCategory] = useState("All");
  const [readMap, setReadMap] = useState(() => loadReadMap());

  // One notification per order, reflecting its current real-time status — not a
  // fabricated history. Order documents only store their latest status (plus a
  // few milestone timestamps), not a full per-transition log, so a history of
  // "every stage this order passed through" isn't something that can be read back
  // out of Firestore without inventing data that was never recorded.
  const notifications = useMemo(() => {
    return orders.map((order) => {
      const normalized = normalizeStatus(order.status);
      const category = STATUS_CATEGORY[normalized] ?? "New Order";
      const key = `${order.id}__${normalized}`;
      const msgKey = CATEGORY_TKEY[category] ?? "updated";
      return {
        id: key,
        orderId: order.id,
        category,
        message: t(`notif.msg.${msgKey}`, { orderNo: order.orderNo }),
        createdAt: order.createdAt,
        read: Boolean(readMap[key]),
      };
    });
  }, [orders, readMap, t]);

  const filteredNotifications = useMemo(() => {
    if (activeCategory === "All") return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeCategory]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

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

  const handleOpen = (notification) => {
    markRead(notification.id);
    if (notification.orderId) {
      navigate(`/shop/orders/${notification.orderId}`);
    }
  };

  const handleRetry = () => setRetryToken((t) => t + 1);

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-gray-900">{t("notif.title")}</h1>
          {unreadCount > 0 && <Badge color="green">{t("notif.new", { n: unreadCount })}</Badge>}
        </div>
        <Button variant="outline" className="!px-4 !py-2 text-xs" onClick={markAllRead}>
          {t("notif.markAllRead")}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-5 py-2 rounded-2xl text-sm font-bold border whitespace-nowrap transition-all ${
              activeCategory === category
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            {t(`notif.cat.${CATEGORY_TKEY[category] ?? "all"}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <NotificationCardSkeleton />
          <NotificationCardSkeleton />
          <NotificationCardSkeleton />
        </div>
      ) : error ? (
        <div className="space-y-6">
          <EmptyState icon="⚠️" title={t("common.somethingWrong")} description={error} />
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleRetry}>
              {t("common.retry")}
            </Button>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={t("notif.emptyTitle")}
          description={t("notif.emptyDesc")}
        />
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={t("notif.noMatchTitle")}
          description={t("notif.noMatchDesc")}
        />
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </div>
  );
};
