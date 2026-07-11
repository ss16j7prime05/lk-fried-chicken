import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { Phone, MapPin, Navigation, RotateCcw, Check, Bike, Clock, Upload, X, Loader2, Pencil } from "lucide-react";
import { db } from "../../firebase";
import { STORE_PHONE, PROMPTPAY_ACCOUNT_NAME } from "../../config";
import { getStore } from "./getStore";
import { PAYMENT_STATUS, countdownFrom, uploadSlip, submitSlip, expire } from "../../payment/paymentService";
import { normalizeStatus } from "../../store/orderStatus";
import { usePreferences } from "../../context/PreferencesContext";
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

const STATUS_BADGE_COLOR = {
  pending: "orange",
  accepted: "blue",
  cooking: "blue",
  ready_for_delivery: "blue",
  picked_up: "blue",
  delivering: "blue",
  completed: "green",
  cancelled: "orange",
};

// order.payment.status (enum) -> od.payStatus.* i18n subkey.
const PAY_STATUS_KEY = {
  [PAYMENT_STATUS.UNPAID]: "unpaid",
  [PAYMENT_STATUS.WAITING_PAYMENT]: "waiting",
  [PAYMENT_STATUS.PENDING_VERIFICATION]: "pending",
  [PAYMENT_STATUS.APPROVED]: "approved",
  [PAYMENT_STATUS.REJECTED]: "rejected",
  [PAYMENT_STATUS.EXPIRED]: "expired",
};

const PAYMENT_STATUS_COLOR = {
  [PAYMENT_STATUS.UNPAID]: "orange",
  [PAYMENT_STATUS.WAITING_PAYMENT]: "orange",
  [PAYMENT_STATUS.PENDING_VERIFICATION]: "blue",
  [PAYMENT_STATUS.APPROVED]: "green",
  [PAYMENT_STATUS.REJECTED]: "orange",
  [PAYMENT_STATUS.EXPIRED]: "orange",
};

// slip upload guard — image only, ≤ 5 MB (mirrors Checkout).
const MAX_SLIP_BYTES = 5 * 1024 * 1024;

const formatDateTime = (timestamp, locale) => {
  if (!timestamp?.toDate) return "-";
  return timestamp.toDate().toLocaleString(locale === "th" ? "th-TH" : "en-GB", {
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

const ItemRow = ({ item, t }) => {
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
          <p className="text-xs text-gray-400 font-medium mt-1">{t("addr.noteLabel")}: {item.note}</p>
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
  const { t, language } = usePreferences();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [storeLocation, setStoreLocation] = useState(null);
  const trackingRef = useRef(null);

  // Payment countdown — recomputed from expireAt each tick so it survives reloads.
  // Date.now (bare reference) as the lazy initializer — React calls it, so it isn't
  // an impure call in the render body (same pattern as useStoreStatus).
  const [nowMs, setNowMs] = useState(Date.now);
  const [slipFile, setSlipFile] = useState(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [slipError, setSlipError] = useState(null);
  const slipPreview = useMemo(() => (slipFile ? URL.createObjectURL(slipFile) : null), [slipFile]);
  useEffect(() => () => slipPreview && URL.revokeObjectURL(slipPreview), [slipPreview]);
  const expiringRef = useRef(false);

  useEffect(() => {
    getStore().then((s) => {
      if (s) setStoreLocation({ lat: s.lat, lng: s.lng, name: s.storeName || "Store" });
    });
  }, []);

  // 1-second ticker (drives the live countdown).
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-cancel when the payment window elapses (idempotent, guarded against re-fire).
  useEffect(() => {
    if (order?.payment?.status !== PAYMENT_STATUS.WAITING_PAYMENT) return;
    if (!countdownFrom(order.payment.expireAt, nowMs).expired || expiringRef.current) return;
    expiringRef.current = true;
    expire(order).catch(() => { expiringRef.current = false; });
  }, [order, nowMs]);

  const handlePickSlip = (f) => {
    if (!f) { setSlipFile(null); return; }
    if (!f.type.startsWith("image/")) { setSlipError(t("checkout.slipTypeErr")); return; }
    if (f.size > MAX_SLIP_BYTES) { setSlipError(t("checkout.slipSizeErr")); return; }
    setSlipError(null);
    setSlipFile(f);
  };

  const handleSubmitSlip = async () => {
    if (!slipFile || uploadingSlip) return;
    setUploadingSlip(true);
    setSlipError(null);
    try {
      const url = await uploadSlip(slipFile);
      await submitSlip(order, url);
      setSlipFile(null);
    } catch {
      setSlipError(t("od.slipUploadErr"));
    } finally {
      setUploadingSlip(false);
    }
  };

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
        setError(t("od.error"));
        setLoading(false);
      }
    );

    return () => unsubscribe();
    // t เป็นฟังก์ชันแปลภาษา ไม่ต้อง re-subscribe เมื่อเปลี่ยน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return <Loading text={t("od.loading")} />;
  }

  if (error) {
    return <EmptyState icon="⚠️" title={t("common.somethingWrong")} description={error} />;
  }

  if (notFound || !order) {
    return (
      <EmptyState
        icon="🔍"
        title={t("od.orderNotFound")}
        description={t("od.notFoundDesc")}
      />
    );
  }

  // normalizeStatus maps legacy Thai statuses (written by the old customer/store
  // checkout) onto the canonical English enum, so orders placed before Module 1
  // still show the correct label and timeline progress instead of falling back to
  // the raw Thai string / an all-blank timeline.
  const normalizedStatus = normalizeStatus(order.status);
  const statusLabel = t(`status.${normalizedStatus}`) || order.status || t("status.pending");
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

  // Payment states (PromptPay / Bank Transfer): awaiting payment (countdown),
  // rejected (re-upload), or an additional payment after a store edit. All three
  // surface the same slip-upload box.
  const isWaitingPayment = order.payment?.status === PAYMENT_STATUS.WAITING_PAYMENT;
  const isRejected = order.payment?.status === PAYMENT_STATUS.REJECTED;
  const isAdditional = order.payment?.status === PAYMENT_STATUS.ADDITIONAL_PAYMENT;
  const showPayBox = isWaitingPayment || isRejected || isAdditional;
  const hasCountdown = isWaitingPayment || isAdditional;
  const countdown = hasCountdown ? countdownFrom(order.payment.expireAt, nowMs) : null;

  // Store edit history (Phase 3.7F) — show the customer the previous vs current order.
  const editHistory = Array.isArray(order.editHistory) ? order.editHistory : [];
  const isEdited = (order.version ?? 1) > 1 && editHistory.length > 0;
  const prevSnapshot = isEdited ? editHistory[editHistory.length - 1] : null;
  const refundAmount = Number(order.refundAmount || 0);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6 pb-32">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-gray-900">{order.orderNo}</h1>
          <Badge color={STATUS_BADGE_COLOR[normalizedStatus] ?? "blue"}>{statusLabel}</Badge>
        </div>
        <p className="text-sm text-gray-400 font-medium mt-1">
          {formatDateTime(order.createdAt, language)}
        </p>
      </div>

      {/* Payment action — live countdown (waiting) or rejected notice, plus slip upload */}
      {showPayBox && (
        <Card className={`p-6 border-2 ${isRejected ? "border-secondary/40" : "border-primary/30"}`}>
          {hasCountdown && countdown && (
            <>
              <div className="flex items-center gap-2 text-primary">
                <Clock size={18} />
                <span className="text-base font-black">
                  {isAdditional ? t("od.additionalPayment") : t("od.waitingPayment")}
                </span>
              </div>
              {isAdditional && (
                <p className="mt-1 text-center text-2xl font-black text-primary">฿{order.payment?.additionalAmount ?? 0}</p>
              )}
              <div className="mt-3 text-center">
                <p className="text-5xl font-black tabular-nums text-primary">{countdown.label}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{t("od.timeLeft")}</p>
              </div>
              <p className="mt-3 text-sm font-medium text-gray-500 text-center">
                {isAdditional ? t("od.payDiffHint") : t("od.payBeforeExpire")}
              </p>
            </>
          )}

          {isRejected && (
            <div className="flex items-start gap-2 text-secondary">
              <X size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-base font-black">{t("od.paymentRejected")}</p>
                {order.payment?.rejectReason && (
                  <p className="text-sm font-medium text-gray-500 mt-0.5">{t("od.rejectReason")}: {order.payment.rejectReason}</p>
                )}
                <p className="text-sm font-medium text-gray-500 mt-1">{t("od.reuploadHint")}</p>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm border-2 border-gray-100 hover:border-primary text-gray-700 cursor-pointer transition-all">
              <Upload size={18} />
              {slipFile ? t("checkout.changeSlip") : t("checkout.uploadSlip")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { handlePickSlip(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
            </label>

            {slipPreview && (
              <div className="flex items-center gap-3">
                <img src={slipPreview} alt={t("checkout.slipPreviewAlt")} className="w-20 h-20 rounded-2xl object-cover border border-gray-100" />
                <p className="flex-1 text-sm font-bold text-primary">{t("checkout.slipAttached")}</p>
                <button
                  type="button"
                  onClick={() => setSlipFile(null)}
                  className="flex items-center gap-1 text-sm font-bold text-gray-400 hover:text-secondary transition-colors"
                >
                  <X size={16} /> {t("checkout.removeSlip")}
                </button>
              </div>
            )}

            {slipError && <p className="text-sm font-bold text-secondary">{slipError}</p>}

            <Button className="w-full" onClick={handleSubmitSlip} disabled={!slipFile || uploadingSlip}>
              {uploadingSlip ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {uploadingSlip ? t("od.slipUploading") : isRejected ? t("od.reuploadSlip") : t("od.confirmSlip")}
            </Button>
          </div>
        </Card>
      )}

      {/* Order edited by store — previous vs current (Phase 3.7F) */}
      {isEdited && (
        <Card className="p-6 border border-amber-200">
          <div className="flex items-center gap-2 text-amber-600">
            <Pencil size={16} />
            <span className="text-base font-black">{t("od.orderEdited")}</span>
          </div>
          {order.editReason && (
            <p className="text-sm font-medium text-gray-500 mt-1">
              {t("od.editReason")}: {t(`oe.reason.${order.editReason}`) || order.editReason}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">{t("od.previous")}</p>
              {(prevSnapshot.items || []).map((it, i) => (
                <p key={i} className="text-xs text-gray-400 font-medium line-through">{(it.qty || 1)}× {it.name}</p>
              ))}
              <p className="text-sm font-bold text-gray-400 mt-1">฿{prevSnapshot.grandTotal}</p>
            </div>
            <div>
              <p className="text-xs font-black text-primary uppercase tracking-wider mb-1">{t("od.updated")}</p>
              {(order.items || []).map((it, i) => (
                <p key={i} className="text-xs text-gray-700 font-bold">{(it.qty || 1)}× {it.name}</p>
              ))}
              <p className="text-sm font-black text-gray-900 mt-1">฿{order.grandTotal}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm font-black">
            <span className="text-gray-500">{t("od.difference")}</span>
            <span className={order.grandTotal - prevSnapshot.grandTotal >= 0 ? "text-amber-600" : "text-blue-600"}>
              {order.grandTotal - prevSnapshot.grandTotal >= 0 ? "+" : "−"}฿{Math.abs(order.grandTotal - prevSnapshot.grandTotal)}
            </span>
          </div>
        </Card>
      )}

      {/* Refund pending (store lowered the total) */}
      {refundAmount > 0 && (
        <Card className="p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-base font-black text-blue-600">{t("od.refundPending")}</span>
            <span className="text-lg font-black text-blue-600">฿{refundAmount}</span>
          </div>
          <p className="text-sm font-medium text-gray-500 mt-1">
            {t("od.refundVia")}: {t(`payment.${order.refundMethod || "cash"}`)}
          </p>
        </Card>
      )}

      {/* Store Information */}
      <Card className="p-6">
        <SectionTitle>{t("od.storeInfo")}</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</p>
            <p className="text-sm text-gray-400 font-medium">{STORE_PHONE}</p>
          </div>
        </div>
      </Card>

      {/* Customer Information */}
      <Card className="p-6">
        <SectionTitle>{t("od.customerInfo")}</SectionTitle>
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
            {t("od.gps")}: {order.gpsLocation || t("od.notProvided")}
          </p>
          {order.note && (
            <p className="text-xs text-gray-400 font-medium mt-1">{t("addr.noteLabel")}: {order.note}</p>
          )}
        </div>
      </Card>

      {/* Ordered Items */}
      <Card className="p-6">
        <SectionTitle>{t("od.orderedItems")}</SectionTitle>
        <div>
          {(order.items ?? []).map((item, index) => (
            <ItemRow key={`${item.id ?? index}-${index}`} item={item} t={t} />
          ))}
        </div>
      </Card>

      {/* Payment */}
      <Card className="p-6">
        <SectionTitle>{t("od.payment")}</SectionTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">{t("od.paymentMethod")}</span>
          <span className="font-bold text-gray-900">
            {(order.payment?.method ?? order.paymentMethod)
              ? t(`payment.${order.payment?.method ?? order.paymentMethod}`)
              : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-medium text-gray-500">{t("od.paymentStatus")}</span>
          <Badge color={PAYMENT_STATUS_COLOR[order.payment?.status] ?? "orange"}>
            {PAY_STATUS_KEY[order.payment?.status]
              ? t(`od.payStatus.${PAY_STATUS_KEY[order.payment?.status]}`)
              : order.payment?.status ?? "-"}
          </Badge>
        </div>
      </Card>

      {/* Price Summary */}
      <Card className="p-6">
        <SectionTitle>{t("od.priceSummary")}</SectionTitle>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-500 font-medium">
            <span>{t("od.subtotal")}</span>
            <span>฿{order.subtotal}</span>
          </div>
          <div className="flex justify-between text-gray-500 font-medium">
            <span>{t("od.deliveryFee")}</span>
            <span>฿{order.deliveryFee}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-gray-900 pt-3 border-t border-gray-100">
            <span>{t("od.grandTotal")}</span>
            <span className="text-primary">฿{order.grandTotal}</span>
          </div>
        </div>
      </Card>

      {/* Delivery Timeline */}
      <Card className="p-6">
        <SectionTitle>{t("od.deliveryTimeline")}</SectionTitle>
        {isCancelled ? (
          <p className="text-sm font-bold text-secondary">{t("od.cancelled")}</p>
        ) : (
          <div className="space-y-0">
            {cookingEta && (
              <div className="mb-4 rounded-2xl bg-primary-light px-4 py-3 text-sm font-bold text-primary">
                {t("od.estReadyBy", { time: cookingEta })}
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
                    {t(`status.${step.status}`)}
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
          <SectionTitle>{t("od.rider")}</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
              <Bike size={22} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{order.riderName || t("od.rider")}</p>
              <p className="text-sm text-gray-400 font-medium">{order.riderPhone || "-"}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {t("od.vehicle")}: {order.riderVehicle || "—"}
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
                {t("od.callRider")}
              </Button>
            )}
            {riderLocation && (
              <MapButton
                lat={riderLocation.lat}
                lng={riderLocation.lng}
                mode="view"
                label={t("od.viewRiderMaps")}
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
            <SectionTitle>{t("od.liveTracking")}</SectionTitle>
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
                {t("od.waitingRiderLoc")}
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
            {t("od.contactStore")}
          </Button>
          <Button
            variant="outline"
            className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isTrackable}
            onClick={() => trackingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <Navigation size={18} />
            {t("od.trackRider")}
          </Button>
          <Button className="flex-1 opacity-50 cursor-not-allowed" disabled>
            <RotateCcw size={18} />
            {t("od.reorder")}
          </Button>
        </div>
      </div>
    </div>
  );
};
