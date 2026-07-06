import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { Phone, MapPin, Navigation, RotateCcw, Check, Bike } from "lucide-react";
import { db } from "../../firebase";
import { STORE_PHONE, PROMPTPAY_ACCOUNT_NAME } from "../../config";
import { getStore } from "./getStore";
import { PAYMENT_STATUS } from "../../payment/paymentUtils";
import { normalizeStatus } from "../../store/orderStatus";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Loading } from "../../components/ui/Loading";
import { EmptyState } from "../../components/ui/EmptyState";
import TrackingPanel from "../../tracking/TrackingPanel.jsx";
import MapButton from "../../location/MapButton.jsx";

// Fallback store coordinates, used only until stores/{STORE_ID} loads (matches the
// same fallback in src/App.jsx / src/TrackOrder.jsx).
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

// Statuses (canonical, post-normalizeStatus) where a rider may be actively en
// route — mirrors the legacy TrackOrder.jsx isDelivering() status set.
const TRACKABLE_STATUSES = ["ready_for_delivery", "picked_up", "delivering"];

// Status enum + timeline mirror src/store/orderStatus.js (single source of truth,
// shared with Store/Rider/Admin dashboards) — DO NOT invent new status values here.
// Cancelled is handled as a separate terminal state below (isCancelled), not a
// linear step after Completed — an order can't be both.
const TIMELINE_STEPS = [
  { status: "pending", label: "Pending" },
  { status: "accepted", label: "Accepted" },
  { status: "cooking", label: "Cooking" },
  { status: "ready_for_delivery", label: "Ready" },
  { status: "picked_up", label: "Rider Assigned" },
  { status: "delivering", label: "Delivering" },
  { status: "completed", label: "Completed" },
];

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  cooking: "Cooking",
  ready_for_delivery: "Ready",
  picked_up: "Rider Assigned",
  delivering: "Delivering",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_BADGE_COLOR = {
  Pending: "orange",
  Accepted: "blue",
  Cooking: "blue",
  Ready: "blue",
  "Rider Assigned": "blue",
  Delivering: "blue",
  Completed: "green",
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

// order.estimatedFinishTime is a real field already written by the Store dashboard
// (src/pages/store/Orders.jsx) when it sets a cook-time estimate — same field, just
// not previously surfaced on the customer side.
const formatTime = (timestamp) => {
  const d = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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
  const [storeLocation, setStoreLocation] = useState(null);
  const trackingRef = useRef(null);

  useEffect(() => {
    getStore().then((s) => {
      if (s) setStoreLocation({ lat: s.lat, lng: s.lng, name: s.storeName || "Store" });
    });
  }, []);

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

  // normalizeStatus maps legacy Thai statuses (written by the old customer/store
  // checkout) onto the canonical English enum, so orders placed before Module 1
  // still show the correct label and timeline progress instead of falling back to
  // the raw Thai string / an all-blank timeline.
  const normalizedStatus = normalizeStatus(order.status);
  const statusLabel = STATUS_LABELS[normalizedStatus] ?? order.status ?? "Pending";
  const isCancelled = normalizedStatus === "cancelled";
  const currentStepIndex = TIMELINE_STEPS.findIndex((step) => step.status === normalizedStatus);
  const isTrackable = TRACKABLE_STATUSES.includes(normalizedStatus);

  const customerLocation = {
    lat: order.deliveryLocation?.lat ?? order.lat ?? order.latitude,
    lng: order.deliveryLocation?.lng ?? order.lng ?? order.longitude,
    address: order.deliveryAddress || order.address,
  };
  const riderLocation = order.riderLocation
    ? { lat: order.riderLocation.lat, lng: order.riderLocation.lng }
    : order.riderLat != null && order.riderLng != null
    ? { lat: order.riderLat, lng: order.riderLng }
    : null;
  const resolvedStoreLocation =
    storeLocation ?? { lat: FALLBACK_STORE_LAT, lng: FALLBACK_STORE_LNG, name: "Store" };

  const hasRider = Boolean(order.riderId);
  const cookingEta = normalizedStatus === "cooking" ? formatTime(order.estimatedFinishTime) : null;

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
            {cookingEta && (
              <div className="mb-4 rounded-2xl bg-primary-light px-4 py-3 text-sm font-bold text-primary">
                Estimated ready by {cookingEta}
              </div>
            )}
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

      {/* Rider — shown once a rider has accepted this delivery */}
      {hasRider && (
        <Card className="p-6">
          <SectionTitle>Rider</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
              <Bike size={22} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{order.riderName || "Rider"}</p>
              <p className="text-sm text-gray-400 font-medium">{order.riderPhone || "-"}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Vehicle: {order.riderVehicle || "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {order.riderPhone && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  window.location.href = `tel:${order.riderPhone}`;
                }}
              >
                <Phone size={18} />
                Call Rider
              </Button>
            )}
            {riderLocation && (
              <MapButton
                lat={riderLocation.lat}
                lng={riderLocation.lng}
                mode="view"
                label="View Rider on Google Maps"
                style={{ flex: 1, textAlign: "center", display: "block" }}
              />
            )}
          </div>
        </Card>
      )}

      {/* Live Tracking — real-time rider location, shown once the order is out for delivery */}
      {isTrackable && (
        <div ref={trackingRef}>
          <Card className="p-6">
            <SectionTitle>Live Tracking</SectionTitle>
            {riderLocation ? (
              <TrackingPanel
                storeLocation={resolvedStoreLocation}
                customerLocation={customerLocation}
                riderLocation={riderLocation}
                estimatedArrival={order.riderLocation?.estimatedArrival}
                remainingDistance={order.riderLocation?.remainingDistance}
              />
            ) : (
              <p className="text-sm text-gray-400 font-medium">
                Waiting for the rider's location to become available…
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 sm:p-6 z-30">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.location.href = `tel:${STORE_PHONE}`;
            }}
          >
            <Phone size={18} />
            Contact Store
          </Button>
          <Button
            variant="outline"
            className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isTrackable}
            onClick={() => trackingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
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
