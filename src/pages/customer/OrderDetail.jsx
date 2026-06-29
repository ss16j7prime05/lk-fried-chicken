import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { Phone, MapPin, Navigation, RotateCcw, Check } from "lucide-react";
import { db } from "../../firebase";
import { STORE_PHONE, PROMPTPAY_ACCOUNT_NAME } from "../../config";
import { PAYMENT_STATUS } from "../../payment/paymentUtils";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Loading } from "../../components/ui/Loading";
import { EmptyState } from "../../components/ui/EmptyState";

// Status enum + timeline mirror src/store/orderStatus.js (single source of truth,
// shared with Store/Rider/Admin dashboards) — DO NOT invent new status values here.
const TIMELINE_STEPS = [
  { status: "pending", label: "Order Placed" },
  { status: "accepted", label: "Accepted" },
  { status: "cooking", label: "Preparing" },
  { status: "ready_for_delivery", label: "Ready for Pickup" },
  { status: "picked_up", label: "Rider Picked Up" },
  { status: "delivering", label: "On The Way" },
  { status: "completed", label: "Delivered" },
];

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  cooking: "Preparing",
  ready_for_delivery: "Ready for Pickup",
  picked_up: "Rider Picked Up",
  delivering: "On The Way",
  completed: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_BADGE_COLOR = {
  Pending: "orange",
  Accepted: "blue",
  Preparing: "blue",
  "Ready for Pickup": "blue",
  "Rider Picked Up": "blue",
  "On The Way": "blue",
  Delivered: "green",
  Cancelled: "orange",
};

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  promptpay: "PromptPay",
};

// Mirrors src/payment/paymentUtils.js PAYMENT_STATUS — order.payment.status is the
// authoritative field (nested object), not the flat order.paymentStatus.
const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUS.UNPAID]: "Unpaid (Cash on Delivery)",
  [PAYMENT_STATUS.PENDING_VERIFICATION]: "Pending Verification",
  [PAYMENT_STATUS.APPROVED]: "Paid",
  [PAYMENT_STATUS.REJECTED]: "Rejected — Please Re-pay",
};

const PAYMENT_STATUS_COLOR = {
  [PAYMENT_STATUS.UNPAID]: "orange",
  [PAYMENT_STATUS.PENDING_VERIFICATION]: "blue",
  [PAYMENT_STATUS.APPROVED]: "green",
  [PAYMENT_STATUS.REJECTED]: "orange",
};

const formatDateTime = (timestamp) => {
  if (!timestamp?.toDate) return "-";
  return timestamp.toDate().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// gpsLocation is stored as a "lat,lng" string (legacy format), not an object.
const formatGps = (gpsLocation) => {
  if (!gpsLocation) return "Not provided";
  return gpsLocation;
};

// Legacy option fields (top_chicken/spicy/sauce/powder) can be a plain string or an
// { name, price } object, depending on how the item was added to cart.
const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const SectionTitle = ({ children }) => (
  <h2 className="text-base font-black text-gray-900 mb-4">{children}</h2>
);

const ItemRow = ({ item }) => {
  const qty = item.qty || 1;
  const options = [
    optionLabel(item.top_chicken),
    optionLabel(item.spicy),
    optionLabel(item.sauce),
    optionLabel(item.powder),
  ].filter(Boolean);

  return (
    <div className="flex gap-4 py-4 border-b border-gray-50 last:border-0">
      <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-gray-50">
        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900">{item.name}</p>
        {options.length > 0 && (
          <p className="text-xs text-gray-400 font-medium mt-1">{options.join(" • ")}</p>
        )}
        {item.note && (
          <p className="text-xs text-gray-400 font-medium mt-1">Note: {item.note}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs font-bold text-gray-400">
            ฿{item.price} x {qty}
          </span>
          <span className="font-black text-primary">฿{(item.price || 0) * qty}</span>
        </div>
      </div>
    </div>
  );
};

export const OrderDetail = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(
      doc(db, "orders", orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrder(null);
          setNotFound(true);
        } else {
          setOrder({ id: snapshot.id, ...snapshot.data() });
          setNotFound(false);
        }
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load order:", err);
        setError("Unable to load this order right now. Please try again later.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  if (loading) {
    return <Loading text="Loading order details..." />;
  }

  if (error) {
    return <EmptyState icon="⚠️" title="Something went wrong" description={error} />;
  }

  if (notFound || !order) {
    return (
      <EmptyState
        icon="🔍"
        title="Order not found"
        description="We couldn't find an order with this ID."
      />
    );
  }

  const statusLabel = STATUS_LABELS[order.status] ?? order.status ?? "Pending";
  const isCancelled = order.status === "cancelled";
  const currentStepIndex = TIMELINE_STEPS.findIndex((step) => step.status === order.status);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6 pb-32">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-gray-900">{order.orderNo}</h1>
          <Badge color={STATUS_BADGE_COLOR[statusLabel] ?? "blue"}>{statusLabel}</Badge>
        </div>
        <p className="text-sm text-gray-400 font-medium mt-1">
          {formatDateTime(order.createdAt)}
        </p>
      </div>

      {/* Store Information */}
      <Card className="p-6">
        <SectionTitle>Store Information</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</p>
            <p className="text-sm text-gray-400 font-medium">{STORE_PHONE}</p>
          </div>
        </div>
      </Card>

      {/* Customer Information */}
      <Card className="p-6">
        <SectionTitle>Customer Information</SectionTitle>
        <div className="space-y-1.5 text-sm">
          <p className="font-bold text-gray-900">{order.customerName}</p>
          <p className="text-gray-500 font-medium">{order.phone}</p>
          {order.address && (
            <p className="text-gray-500 font-medium flex items-start gap-1.5 mt-2">
              <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
              {order.address}
            </p>
          )}
          <p className="text-xs text-gray-400 font-medium mt-2">
            GPS: {formatGps(order.gpsLocation)}
          </p>
          {order.note && (
            <p className="text-xs text-gray-400 font-medium mt-1">Note: {order.note}</p>
          )}
        </div>
      </Card>

      {/* Ordered Items */}
      <Card className="p-6">
        <SectionTitle>Ordered Items</SectionTitle>
        <div>
          {(order.items ?? []).map((item, index) => (
            <ItemRow key={`${item.id ?? index}-${index}`} item={item} />
          ))}
        </div>
      </Card>

      {/* Payment */}
      <Card className="p-6">
        <SectionTitle>Payment</SectionTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Payment Method</span>
          <span className="font-bold text-gray-900">
            {PAYMENT_METHOD_LABELS[order.payment?.method ?? order.paymentMethod] ??
              order.paymentMethod}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-medium text-gray-500">Payment Status</span>
          <Badge color={PAYMENT_STATUS_COLOR[order.payment?.status] ?? "orange"}>
            {PAYMENT_STATUS_LABELS[order.payment?.status] ?? order.payment?.status ?? "-"}
          </Badge>
        </div>
      </Card>

      {/* Price Summary */}
      <Card className="p-6">
        <SectionTitle>Price Summary</SectionTitle>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-500 font-medium">
            <span>Subtotal</span>
            <span>฿{order.subtotal}</span>
          </div>
          <div className="flex justify-between text-gray-500 font-medium">
            <span>Delivery Fee</span>
            <span>฿{order.deliveryFee}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-gray-900 pt-3 border-t border-gray-100">
            <span>Grand Total</span>
            <span className="text-primary">฿{order.grandTotal}</span>
          </div>
        </div>
      </Card>

      {/* Delivery Timeline */}
      <Card className="p-6">
        <SectionTitle>Delivery Timeline</SectionTitle>
        {isCancelled ? (
          <p className="text-sm font-bold text-secondary">This order was cancelled.</p>
        ) : (
          <div className="space-y-0">
            {TIMELINE_STEPS.map((step, index) => {
              const isDone = index <= currentStepIndex;
              const isLast = index === TIMELINE_STEPS.length - 1;
              return (
                <div key={step.status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isDone ? "bg-primary text-white" : "bg-gray-100 text-gray-300"
                      }`}
                    >
                      <Check size={14} />
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 flex-1 min-h-[24px] ${
                          index < currentStepIndex ? "bg-primary" : "bg-gray-100"
                        }`}
                      />
                    )}
                  </div>
                  <p
                    className={`font-bold pb-6 ${
                      isDone ? "text-gray-900" : "text-gray-300"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 sm:p-6 z-30">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Button variant="outline" className="flex-1">
            <Phone size={18} />
            Contact Store
          </Button>
          <Button
            variant="outline"
            className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={order.status !== "delivering"}
          >
            <Navigation size={18} />
            Track Rider
          </Button>
          <Button className="flex-1 opacity-50 cursor-not-allowed" disabled>
            <RotateCcw size={18} />
            Reorder
          </Button>
        </div>
      </div>
    </div>
  );
};
