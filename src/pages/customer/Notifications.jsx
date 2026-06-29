import { useState } from "react";
import {
  CheckCircle2,
  ChefHat,
  Bike,
  MapPin,
  PartyPopper,
  Ticket,
  Megaphone,
  PackageCheck,
} from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Loading } from "../../components/ui/Loading";

const FILTERS = ["All", "Orders", "Promotions", "System"];

const TYPE_META = {
  "Order Accepted": { icon: CheckCircle2, category: "Orders" },
  "Preparing Food": { icon: ChefHat, category: "Orders" },
  "Rider Picked Up": { icon: PackageCheck, category: "Orders" },
  "Rider Arriving": { icon: Bike, category: "Orders" },
  Delivered: { icon: MapPin, category: "Orders" },
  Promotion: { icon: PartyPopper, category: "Promotions" },
  Coupon: { icon: Ticket, category: "Promotions" },
  "Store Announcement": { icon: Megaphone, category: "System" },
};

const MOCK_NOTIFICATIONS = [
  {
    id: "1",
    type: "Order Accepted",
    title: "Order Accepted",
    description: "LK Fried Chicken has accepted your order #LK20260630-002.",
    time: "2 min ago",
    read: false,
  },
  {
    id: "2",
    type: "Preparing Food",
    title: "Preparing Your Food",
    description: "Your crispy chicken is being freshly prepared in the kitchen.",
    time: "10 min ago",
    read: false,
  },
  {
    id: "3",
    type: "Rider Picked Up",
    title: "Rider Picked Up Your Order",
    description: "Rider Beam has picked up your order and is heading your way.",
    time: "25 min ago",
    read: true,
  },
  {
    id: "4",
    type: "Rider Arriving",
    title: "Rider Arriving Soon",
    description: "Your rider is 500m away from your delivery address.",
    time: "32 min ago",
    read: true,
  },
  {
    id: "5",
    type: "Delivered",
    title: "Order Delivered",
    description: "Your order #LK20260627-014 has been delivered. Enjoy!",
    time: "1 day ago",
    read: true,
  },
  {
    id: "6",
    type: "Promotion",
    title: "Weekend Special: 20% Off",
    description: "Get 20% off on all chicken buckets this weekend only.",
    time: "2 days ago",
    read: false,
  },
  {
    id: "7",
    type: "Coupon",
    title: "New Coupon Available",
    description: "Use code LKFC50 for ฿50 off your next order over ฿300.",
    time: "3 days ago",
    read: true,
  },
  {
    id: "8",
    type: "Store Announcement",
    title: "New Opening Hours",
    description: "We're now open until midnight every Friday and Saturday.",
    time: "5 days ago",
    read: true,
  },
];

const NotificationCard = ({ notification }) => {
  const meta = TYPE_META[notification.type] ?? { icon: Megaphone };
  const Icon = meta.icon;

  return (
    <Card className={`p-5 flex gap-4 ${!notification.read ? "ring-2 ring-primary/10" : ""}`}>
      <div
        className={`p-3 rounded-2xl shrink-0 ${
          notification.read ? "bg-gray-50 text-gray-400" : "bg-primary-light text-primary"
        }`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-gray-900">{notification.title}</h3>
          <Badge color={notification.read ? "blue" : "green"}>
            {notification.read ? "Read" : "Unread"}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">{notification.description}</p>
        <p className="text-xs text-gray-400 font-bold mt-2">{notification.time}</p>
      </div>
    </Card>
  );
};

export const Notifications = () => {
  const [loading] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = notifications.filter((n) => {
    if (activeFilter === "All") return true;
    return TYPE_META[n.type]?.category === activeFilter;
  });

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (loading) {
    return <Loading text="Loading notifications..." />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-gray-900">Notifications</h1>
        <Button variant="outline" className="!px-4 !py-2 text-xs" onClick={markAllRead}>
          Mark All Read
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-5 py-2 rounded-2xl text-sm font-bold border whitespace-nowrap transition-all ${
              activeFilter === filter
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-500 border-gray-100 hover:border-primary"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No notifications"
          description="You're all caught up — new updates will appear here."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
};
