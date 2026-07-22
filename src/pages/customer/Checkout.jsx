import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  MapPin, Map, Upload, X, Copy, Check, Download, Pencil, Clock, Bike, Store,
  User, Phone, Coins, ShoppingBag, QrCode, Banknote, Landmark,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { STORE_ID, EST_PREP_MINUTES } from "../../config";
import { generateOrderNo } from "../../orderNoUtils";
import { PAYMENT_STATUS, requiresCountdown, paymentExpireTimestamp, uploadSlip } from "../../payment/paymentUtils";
import { normalizePayment, enabledMethods } from "../../payment/paymentSettings";
import { notifyStore, notifyAdmin, NOTIF_TYPE } from "../../notifications/notificationUtils";
import LocationPicker from "../../location/LocationPicker.jsx";
import MapButton from "../../location/MapButton.jsx";
import { calcDeliveryFee, getRoute, haversineKm, reverseGeocode } from "../../location/locationUtils";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useCart } from "../../context/CartContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useStoreStatus } from "../../store/useStoreStatus";
import { StoreClosedBanner } from "../../components/customer/StoreClosedBanner";
import { getStore } from "./getStore";
import { useAddresses } from "../../hooks/useAddresses";
import { formatFullAddress, labelMeta } from "../../constants/address";
import { isInsideServiceArea, clampDeliveryKm } from "../../location/serviceArea";

// Fallback store coordinates, used only until stores/{STORE_ID} loads (matches the
// same fallback in src/App.jsx / src/pages/customer/OrderDetail.jsx).
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;

// Mirrors src/App.jsx / MenuDetailModal.jsx's real required-option rules (single
// source of truth for these Firestore `options` category/name checks) — re-checked
// here as a defensive guard in case a cart item ever ends up incomplete.
const RICE_TOPPED_CATEGORY = "ข้าวหน้าไก่ทอด";
const SPICY_SALAD_NAME = "ข้าวยำไก่แซ่บ";

// Device-local only (localStorage) — not written to Firestore, so this doesn't
// touch the users/{uid} schema.
const SAVED_ADDRESS_KEY = "lkfc_saved_address";

// Slip upload guard — image only, ≤ 5 MB.
const MAX_SLIP_BYTES = 5 * 1024 * 1024;

const optionLabel = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value.name || "" : value;
};

const SectionTitle = ({ icon: Icon, children }) => (
  <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
    {Icon && <Icon size={19} className="text-primary shrink-0" />}
    {children}
  </h2>
);

// Delivery/Pickup segmented control — icon + label pill.
const ModeToggle = ({ label, icon: Icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm border transition-all ${
      active
        ? "bg-primary text-white border-primary shadow-soft"
        : "bg-gray-50 text-gray-600 border-gray-100 hover:border-primary"
    }`}
  >
    {Icon && <Icon size={17} />} {label}
  </button>
);

// Payment method icons — cash / promptpay / bank transfer only (no wallet/points/card).
const PAYMENT_ICON = { cash: Banknote, promptpay: QrCode, transfer: Landmark };

// Selectable payment card with a clear active state (radio-style check on the right).
const PaymentMethodCard = ({ method, active, onClick, t }) => {
  const Icon = PAYMENT_ICON[method] || Banknote;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 w-full p-4 rounded-2xl border-2 text-left transition-all ${
        active ? "border-primary bg-primary-light" : "border-gray-100 bg-white hover:border-primary/40"
      }`}
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-primary text-white" : "bg-gray-50 text-gray-500"}`}>
        <Icon size={20} />
      </span>
      <span className="flex-1 font-black text-gray-900">{t(`payment.${method}`)}</span>
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? "border-primary bg-primary" : "border-gray-300"}`}>
        {active && <Check size={12} className="text-white" strokeWidth={3} />}
      </span>
    </button>
  );
};

// Beautiful order-item card: image, name, qty, price, and option/sauce/spice chips + note.
const FoodItemCard = ({ item }) => {
  const options = [
    item.topChicken,
    item.spicy,
    optionLabel(item.sauceMain),
    optionLabel(item.sauceExtra),
    optionLabel(item.powder),
    optionLabel(item.tableCheese),
  ].filter(Boolean);
  const img = item.menu?.image;
  return (
    <div className="flex gap-3 p-3 rounded-2xl border border-gray-100 bg-white">
      {img ? (
        <img src={img} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0 bg-gray-50" />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
          <ShoppingBag size={22} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-black text-gray-900 leading-tight min-w-0">{item.menu?.name}</p>
          <span className="text-sm font-black text-gray-900 whitespace-nowrap">฿{item.totalPrice}</span>
        </div>
        <span className="inline-block mt-1 text-[11px] font-black text-primary bg-primary-light px-2 py-0.5 rounded-full">× {item.quantity}</span>
        {options.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {options.map((o, i) => (
              <span key={i} className="text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{o}</span>
            ))}
          </div>
        )}
        {item.note && (
          <p className="flex items-start gap-1 text-xs text-gray-400 font-medium mt-1.5">
            <Pencil size={11} className="mt-0.5 shrink-0" /> <span className="min-w-0">{item.note}</span>
          </p>
        )}
      </div>
    </div>
  );
};

// Read-only labelled row for the collapsed delivery summary.
const SummaryRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3">
    <Icon size={16} className="text-gray-400 shrink-0" />
    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider w-20 shrink-0">{label}</span>
    <span className="text-sm font-bold text-gray-800 truncate">{value || "—"}</span>
  </div>
);

// Reused for both PromptPay and Transfer — file input styled to match Button's
// "outline" variant, plus an image preview + remove once a slip is selected.
const SlipUploadField = ({ file, onChange, onRemove, t }) => {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm border-2 border-gray-100 hover:border-primary text-gray-700 cursor-pointer transition-all">
        <Upload size={18} />
        {file ? t("checkout.changeSlip") : t("checkout.uploadSlip")}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { onChange(e.target.files?.[0] ?? null); e.target.value = ""; }}
        />
      </label>
      {previewUrl && (
        <div className="flex items-center gap-3">
          <img
            src={previewUrl}
            alt={t("checkout.slipPreviewAlt")}
            className="w-20 h-20 rounded-2xl object-cover border border-gray-100"
          />
          <p className="flex-1 text-sm font-bold text-primary">{t("checkout.slipAttached")}</p>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 text-sm font-bold text-gray-400 hover:text-secondary transition-colors"
          >
            <X size={16} /> {t("checkout.removeSlip")}
          </button>
        </div>
      )}
    </div>
  );
};

// Read-only labelled value with a copy button — used for PromptPay ID and each
// bank-account field (single copy primitive, no duplication).
const CopyField = ({ label, value, t }) => {
  const [copied, setCopied] = useState(false);
  const v = String(value || "").trim();
  const copy = async () => {
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-gray-800 truncate">{v || "—"}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={!v}
        aria-label={t("checkout.copy")}
        className="flex items-center gap-1 shrink-0 text-sm font-bold text-primary hover:underline disabled:opacity-40"
      >
        {copied ? <><Check size={15} /> {t("checkout.copied")}</> : <><Copy size={15} /> {t("checkout.copy")}</>}
      </button>
    </div>
  );
};

export const Checkout = () => {
  const { cartItems, subtotal, clearCart, deliveryFee, setDeliveryFee } = useCart();
  const { profile, user } = useAuth();
  const { t } = usePreferences();
  // Reuse the existing store listener (subscribes to stores/{STORE_ID}) — it also
  // returns the full store doc, so we read paymentSettings from it (no extra read).
  const { status: storeStatus, store } = useStoreStatus("delivery");
  const storeClosed = storeStatus === "closed";
  const navigate = useNavigate();

  // Live e-payment config from the store (single source of truth).
  const paySettings = useMemo(() => normalizePayment(store?.paymentSettings), [store]);
  const methods = useMemo(() => enabledMethods(paySettings), [paySettings]);

  // Saved delivery addresses (users/{uid}/addresses). The default one is
  // auto-applied below so checkout is one tap (LINE MAN / GrabFood style).
  const { addresses, defaultAddress } = useAddresses(user?.uid);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // null = not yet edited by the customer -> fall back to their account profile.
  // Orders are matched back to "My Orders" by exact phone string (Firestore "=="
  // query, mirrors firestore.rules' myPhone() check), so defaulting to the
  // logged-in customer's own profile.phone here ensures the saved order is always
  // findable, instead of relying on them re-typing it identically.
  const [fullName, setFullName] = useState(null);
  const [phone, setPhone] = useState(null);
  const displayName = fullName ?? profile?.name ?? "";
  const displayPhone = phone ?? profile?.phone ?? "";

  const [deliveryMethod, setDeliveryMethod] = useState("delivery"); // 'delivery' | 'pickup'
  const [address, setAddress] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [travelMin, setTravelMin] = useState(null); // road travel time (OSRM), null = unknown
  const [showMapModal, setShowMapModal] = useState(false);
  const [storeLocation, setStoreLocation] = useState({
    lat: FALLBACK_STORE_LAT,
    lng: FALLBACK_STORE_LNG,
    name: "LK Fried Chicken",
  });
  const [savedAddress, setSavedAddress] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("cash"); // 'cash' | 'promptpay' | 'transfer'
  const [slipFile, setSlipFile] = useState(null);
  const payInitialized = useRef(false); // guards the one-time default-method sync

  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null); // { orderId, orderNo } once submitted
  // UI-only: collapse the delivery editor into a summary card once details exist (LINE MAN style).
  const [editingDelivery, setEditingDelivery] = useState(false);

  // Real store location, for accurate distance/fee (falls back to the constant
  // above until this resolves).
  useEffect(() => {
    getStore().then((s) => {
      if (s) setStoreLocation({ lat: s.lat, lng: s.lng, name: s.storeName || "LK Fried Chicken" });
    });
  }, []);

  // Pre-select the store's default method once its settings load, then keep the
  // selection valid if the merchant disables the chosen method mid-session.
  useEffect(() => {
    if (!store) return;
    const firstLoad = !payInitialized.current;
    payInitialized.current = true;
    if (firstLoad || !methods.includes(paymentMethod)) {
      setPaymentMethod(paySettings.default);
    }
  }, [store, methods, paySettings.default, paymentMethod]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_ADDRESS_KEY);
      // โหลดที่อยู่ที่จำไว้จาก localStorage ครั้งเดียวตอน mount — setState ที่ตั้งใจ
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSavedAddress(JSON.parse(raw));
    } catch {
      // ignore malformed/blocked localStorage
    }
  }, []);

  const applyLocation = async (latValue, lngValue, knownAddress) => {
    setLat(latValue);
    setLng(lngValue);
    const addr = knownAddress || (await reverseGeocode(latValue, lngValue));
    setAddress(addr);
    try {
      const { distanceKm: km, durationMin } = await getRoute(storeLocation.lat, storeLocation.lng, latValue, lngValue);
      setDistanceKm(km);
      setTravelMin(durationMin);
      setDeliveryFee(calcDeliveryFee(km));
    } catch {
      // Fallback to straight-line distance if road-routing is unavailable.
      const km = haversineKm(storeLocation.lat, storeLocation.lng, latValue, lngValue);
      setDistanceKm(km);
      setTravelMin(null);
      setDeliveryFee(calcDeliveryFee(km));
    }
  };

  // เวลาจัดส่งโดยประมาณ = เวลาเตรียมอาหาร + เวลาเดินทางจริงตามถนน (ถ้ามี)
  const etaMinutes = travelMin != null ? EST_PREP_MINUTES + travelMin : null;

  // Apply a saved address-book entry: fills receiver/phone/note + recomputes
  // distance & fee from its GPS via applyLocation.
  const pickSavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setFullName(addr.receiverName || "");
    setPhone(addr.receiverPhone || "");
    setDeliveryNote(addr.note || "");
    if (addr.lat != null && addr.lng != null) {
      applyLocation(addr.lat, addr.lng, formatFullAddress(addr));
    } else {
      setAddress(formatFullAddress(addr));
    }
  };

  // Auto-apply the default address once it loads, if the customer hasn't picked one.
  useEffect(() => {
    if (defaultAddress && !selectedAddressId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      pickSavedAddress(defaultAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAddress]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setValidationError(t("checkout.valGpsDevice"));
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyLocation(pos.coords.latitude, pos.coords.longitude);
        setGpsLoading(false);
      },
      () => {
        setValidationError(t("checkout.valGpsFail"));
        setGpsLoading(false);
      }
    );
  };

  const handleConfirmMapLocation = async ({ lat: la, lng: ln, address: addr }) => {
    await applyLocation(la, ln, addr);
    setShowMapModal(false);
  };

  const applySavedAddress = () => {
    if (!savedAddress) return;
    if (savedAddress.lat != null && savedAddress.lng != null) {
      applyLocation(savedAddress.lat, savedAddress.lng, savedAddress.address);
    } else {
      setAddress(savedAddress.address || "");
    }
  };

  // Slip picker with inline image/size validation.
  const handleSlipChange = (f) => {
    if (!f) { setSlipFile(null); return; }
    if (!f.type.startsWith("image/")) { setValidationError(t("checkout.slipTypeErr")); return; }
    if (f.size > MAX_SLIP_BYTES) { setValidationError(t("checkout.slipSizeErr")); return; }
    setValidationError(null);
    setSlipFile(f);
  };

  // Download the store's PromptPay QR image (fetch→blob so it saves rather than
  // navigating; falls back to opening the image if the fetch is blocked).
  const saveQrImage = async (url) => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = "promptpay-qr.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };

  // Delivery boundary — dynamic service-area polygon if the store has one, else the
  // store's configured radius (clamped 3–20 km). `deliveryKm` is only for the message.
  const deliveryKm = clampDeliveryKm(store?.deliveryRadius);
  const outOfArea =
    deliveryMethod === "delivery" &&
    lat != null &&
    lng != null &&
    !isInsideServiceArea({ lat, lng, distanceKm, store });

  const grandTotal = subtotal + (deliveryMethod === "delivery" ? deliveryFee : 0);

  // ── Display-only derivations (no backend/schema/total changes) ──
  // Customer's existing coin balance, shown for information — NEVER applied as a discount and
  // never written; grandTotal stays subtotal + deliveryFee exactly as before.
  const coinBalance = Number(profile?.coins ?? 0);
  // ETA shown as a small window around the computed estimate (LINE MAN-style "28–40 min").
  const etaText = etaMinutes != null ? `${etaMinutes}–${etaMinutes + 12} min` : null;
  // Whether the delivery block has enough to show its summary; else the editor stays open.
  const deliveryReady =
    Boolean(displayName.trim()) && Boolean(displayPhone.trim()) &&
    (deliveryMethod === "pickup" || Boolean(address.trim()));
  const showDeliveryEditor = editingDelivery || !deliveryReady;
  const cartEmpty = cartItems.length === 0;

  const validate = () => {
    if (storeClosed) return t("store.closedOrder");
    if (cartItems.length === 0) return t("checkout.emptyCart");

    for (const item of cartItems) {
      const needsTopChicken = item.menu?.category === RICE_TOPPED_CATEGORY;
      if (needsTopChicken && !item.topChicken) {
        return t("checkout.valMissingTopping", { name: item.menu?.name });
      }
      const needsSpicy = item.menu?.name === SPICY_SALAD_NAME;
      if (needsSpicy && !item.spicy) {
        return t("checkout.valMissingSpicy", { name: item.menu?.name });
      }
    }

    if (!displayName.trim()) return t("checkout.valName");
    if (!displayPhone.trim()) return t("checkout.valPhone");

    if (deliveryMethod === "delivery") {
      if (!address.trim()) return t("checkout.valAddress");
      if (lat == null || lng == null) {
        return t("checkout.valLocation");
      }
      if (outOfArea) return t("checkout.outOfArea", { km: deliveryKm });
    }

    // Payment: the selected method must be fully configured by the store.
    if (paymentMethod === "promptpay" && !paySettings.promptPayQrUrl) {
      return t("checkout.valPromptpay");
    }
    if (paymentMethod === "transfer") {
      if (!paySettings.bankName.trim() || !paySettings.accountName.trim() || !paySettings.accountNumber.trim()) {
        return t("checkout.valBank");
      }
    }

    return null;
  };

  const handlePlaceOrder = () => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (submitting) return; // guard against a duplicate submit racing this handler
    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const orderNo = await generateOrderNo(db);
      const isDelivery = deliveryMethod === "delivery";
      const orderLat = isDelivery ? lat : null;
      const orderLng = isDelivery ? lng : null;

      const needsCountdown = requiresCountdown(paymentMethod); // promptpay / transfer
      let slipImage = "";
      let paymentTime = null;
      if (slipFile && needsCountdown) {
        // Slip upload must NEVER block order creation. If Cloudinary rejects the
        // image (bad/unsupported format, transient network error, etc.) we still
        // place the order — it falls through to WAITING_PAYMENT below, and the
        // customer re-uploads the slip on the Order Detail page. Previously an
        // upload error threw here and aborted the whole order (nothing reached
        // Firestore) — only for slip methods (โอน / พร้อมเพย์), never cash.
        try {
          slipImage = await uploadSlip(slipFile);
          paymentTime = new Date();
        } catch (uploadErr) {
          console.error("Slip upload failed; placing order as WAITING_PAYMENT so the customer can re-upload on Order Detail:", uploadErr);
        }
      }

      // Payment status + countdown window:
      //  cash            → UNPAID, no expiry
      //  slip at checkout → PENDING_REVIEW (awaiting store review), no countdown
      //  no slip yet      → WAITING_PAYMENT with a 10-min expireAt (customer pays on Order Detail)
      const payStatus = !needsCountdown
        ? PAYMENT_STATUS.UNPAID
        : slipImage
        ? PAYMENT_STATUS.PENDING_REVIEW
        : PAYMENT_STATUS.WAITING_PAYMENT;
      const expireAt = payStatus === PAYMENT_STATUS.WAITING_PAYMENT ? paymentExpireTimestamp() : null;

      // Legacy item shape (matches src/App.jsx's addToCart / Store & Rider dashboards):
      // top_chicken/spicy/Sauce/sauce/powder/tableCheese as flat option fields (set by
      // MenuDetailModal from the real Firestore `options` collection), qty (not
      // quantity), price (not unitPrice).
      const legacyItems = cartItems.map((item) => ({
        id: item.menu?.id ?? null,
        name: item.menu?.name ?? "",
        price: item.menu?.price ?? 0,
        image: item.menu?.image ?? "",
        category: item.menu?.category ?? "",
        top_chicken: item.topChicken || "",
        spicy: item.spicy || "",
        Sauce: item.sauceMain || "",
        sauce: item.sauceExtra || "",
        powder: item.powder || "",
        tableCheese: item.tableCheese || "",
        note: item.note || "",
        qty: item.quantity,
      }));

      // Exact field structure expected by Store Dashboard, Rider Dashboard and Admin
      // (single source of truth: the order-creation logic in src/App.jsx). status
      // stays "pending" (not a new "new" value) — that's the real initial status
      // every other surface (Store/Rider/Admin) already filters/normalizes on.
      const docRef = await addDoc(collection(db, "orders"), {
        orderNo,
        storeId: STORE_ID,
        riderLat: null,
        riderLng: null,
        slipImage,
        paymentTime,
        payment: {
          method: paymentMethod,
          status: payStatus,
          slip: slipImage,           // slip image URL (Phase 3.7C)
          slipUrl: slipImage,        // kept: Store/Rider/Admin already read payment.slipUrl
          createdAt: serverTimestamp(), // payment record created (Phase 3.7D)
          expireAt,                  // countdown deadline (null for cash / already-reviewed)
          updatedAt: serverTimestamp(),
          cancelReason: null,
          paidAt: paymentTime,       // kept: existing consumers read payment.paidAt
          verifiedBy: null,
        },
        customerName: displayName,
        phone: displayPhone,
        note: deliveryNote,
        address: isDelivery ? address : "",
        deliveryAddress: isDelivery ? address : "",
        latitude: orderLat,
        longitude: orderLng,
        lat: orderLat,
        lng: orderLng,
        gpsLocation: orderLat != null && orderLng != null ? `${orderLat},${orderLng}` : "",
        deliveryLocation: {
          lat: orderLat,
          lng: orderLng,
          address: isDelivery ? address : "",
        },
        distanceKm: isDelivery ? distanceKm : null,
        distance: isDelivery ? distanceKm : null,
        deliveryDistance: isDelivery ? distanceKm : null,
        estimatedDeliveryMinutes: isDelivery ? etaMinutes : null,
        storeLat: storeLocation.lat,
        storeLng: storeLocation.lng,
        orderType: deliveryMethod,
        paymentMethod,
        paymentStatus: "pending",
        items: legacyItems,
        subtotal,
        deliveryFee: isDelivery ? deliveryFee : 0,
        grandTotal,
        status: "pending",
        riderStatus: "",
        riderId: "",
        createdAt: serverTimestamp(),
      });

      // Remember this address on this device for next time — localStorage only,
      // never written to Firestore, so the users/{uid} schema is untouched.
      if (isDelivery && address.trim()) {
        try {
          localStorage.setItem(
            SAVED_ADDRESS_KEY,
            JSON.stringify({ address, lat: orderLat, lng: orderLng })
          );
        } catch {
          // ignore blocked/full localStorage
        }
      }

      clearCart();
      setPlacedOrder({ orderId: docRef.id, orderNo });

      // Notify the store of the new order (role-broadcast, single writer — Phase 3.7G).
      notifyStore({
        type: NOTIF_TYPE.NEW_ORDER, orderId: docRef.id, actionUrl: "/store/orders",
        message: `ออเดอร์ใหม่ ${orderNo} · ฿${Math.round(grandTotal)}`,
      });
    } catch (err) {
      console.error("Failed to place order:", err);
      setSubmitError(t("checkout.errorMsg"));
      setErrorDialogOpen(true);
      notifyAdmin({
        type: NOTIF_TYPE.PAYMENT_ERROR, actionUrl: "/admin",
        message: `สั่งซื้อล้มเหลว: ${err?.code || err?.message || "unknown"}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 pb-60 md:pb-44">
      <h1 className="text-2xl font-black text-gray-900">{t("checkout.title")}</h1>

      <StoreClosedBanner />

      {cartEmpty ? (
        /* Empty state — nothing to check out yet */
        <Card className="p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-light text-primary flex items-center justify-center">
            <ShoppingBag size={30} />
          </div>
          <p className="mt-4 text-lg font-black text-gray-900">{t("checkout.emptyCart")}</p>
          <div className="mt-5">
            <Button className="!px-6" onClick={() => navigate("/")}>{t("checkout.continueShopping")}</Button>
          </div>
        </Card>
      ) : (
        <>
          {/* ── SECTION 1 · Delivery Information ─────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-4">
            <SectionTitle icon={Bike}>{t("checkout.deliveryInfo")}</SectionTitle>

            <div className="flex gap-2">
              <ModeToggle label={t("checkout.delivery")} icon={Bike} active={deliveryMethod === "delivery"} onClick={() => setDeliveryMethod("delivery")} />
              <ModeToggle label={t("checkout.pickup")} icon={Store} active={deliveryMethod === "pickup"} onClick={() => setDeliveryMethod("pickup")} />
            </div>

            {showDeliveryEditor ? (
              /* Editor — receiver, phone, and (for delivery) the address controls */
              <div className="space-y-4">
                <Input
                  label={t("checkout.fullName")}
                  placeholder={t("checkout.fullNamePlaceholder")}
                  value={displayName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Input
                  label={t("checkout.phoneNumber")}
                  placeholder={t("checkout.phonePlaceholder")}
                  type="tel"
                  value={displayPhone}
                  onChange={(e) => setPhone(e.target.value)}
                />

                {deliveryMethod === "delivery" && (
                  <>
                    {/* Saved address book */}
                    {addresses.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {t("checkout.savedAddresses")}
                          </label>
                          <button
                            type="button"
                            onClick={() => navigate("/shop/addresses")}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            {t("checkout.manage")}
                          </button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                          {addresses.map((addr) => {
                            const meta = labelMeta(addr.label);
                            const active = selectedAddressId === addr.id;
                            return (
                              <button
                                key={addr.id}
                                type="button"
                                onClick={() => pickSavedAddress(addr)}
                                className={`shrink-0 w-[220px] text-left p-3 rounded-2xl border transition-all ${
                                  active
                                    ? "bg-primary-light border-primary"
                                    : "bg-gray-50 border-gray-100 hover:border-primary"
                                }`}
                              >
                                <p className="text-sm font-black text-gray-900 truncate">
                                  {meta.emoji} {t(`addr.label.${meta.key}`)}
                                  {addr.isDefault && (
                                    <span className="ml-1 text-[10px] text-primary font-black">• {t("addr.default")}</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 font-medium truncate">
                                  {addr.receiverName} · {addr.receiverPhone}
                                </p>
                                <p className="text-xs text-gray-400 font-medium truncate">
                                  {formatFullAddress(addr)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {savedAddress && (
                      <button
                        type="button"
                        onClick={applySavedAddress}
                        className="w-full text-left p-3 rounded-2xl bg-primary-light border border-primary/20 text-sm font-medium text-gray-700 hover:brightness-95 transition-all"
                      >
                        <span className="font-bold text-primary">{t("checkout.savedAddressPrefix")} </span>
                        {savedAddress.address}
                      </button>
                    )}

                    <Input
                      label={t("checkout.addressLabel")}
                      placeholder={t("checkout.addressPlaceholder")}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={useMyLocation}
                        disabled={gpsLoading}
                      >
                        <MapPin size={18} />
                        {gpsLoading ? t("checkout.locating") : t("checkout.useMyLocation")}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowMapModal(true)}>
                        <Map size={18} />
                        {t("checkout.chooseMap")}
                      </Button>
                    </div>

                    {lat != null && lng != null && (
                      <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
                        <div className="flex justify-between text-sm font-medium text-gray-500">
                          <span>{t("checkout.distance")}</span>
                          <span>{distanceKm != null ? `${distanceKm.toFixed(1)} km` : "-"}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-gray-500">
                          <span>{t("checkout.deliveryFee")}</span>
                          <span>฿{deliveryFee}</span>
                        </div>
                        {etaMinutes != null && (
                          <div className="flex justify-between text-sm font-medium text-gray-500">
                            <span>{t("checkout.estTime")}</span>
                            <span>~{etaMinutes} min</span>
                          </div>
                        )}
                        <MapButton
                          lat={lat}
                          lng={lng}
                          address={address}
                          mode="view"
                          label={t("checkout.viewGoogleMaps")}
                          style={{ width: "100%", textAlign: "center", display: "block", marginTop: "4px" }}
                        />
                      </div>
                    )}

                    {outOfArea && (
                      <p className="text-sm font-bold text-secondary">
                        {t("checkout.outOfArea", { km: deliveryKm })}
                      </p>
                    )}
                  </>
                )}

                {deliveryReady && (
                  <Button variant="outline" className="w-full" onClick={() => setEditingDelivery(false)}>
                    {t("checkout.done")}
                  </Button>
                )}
              </div>
            ) : (
              /* Collapsed summary — address, receiver, phone, ETA + Edit */
              <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
                      {deliveryMethod === "delivery" ? <MapPin size={18} /> : <Store size={18} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-wider">
                        {deliveryMethod === "delivery" ? t("checkout.deliveringTo") : t("checkout.pickup")}
                      </p>
                      <p className="text-sm font-bold text-gray-800 mt-0.5 line-clamp-2">
                        {deliveryMethod === "delivery" ? (address || "—") : storeLocation.name}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingDelivery(true)}
                    className="flex items-center gap-1 text-sm font-black text-primary hover:underline shrink-0"
                  >
                    <Pencil size={14} /> {t("checkout.edit")}
                  </button>
                </div>

                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <SummaryRow icon={User} label={t("checkout.receiver")} value={displayName} />
                  <SummaryRow icon={Phone} label={t("checkout.phone")} value={displayPhone} />
                </div>

                {deliveryMethod === "delivery" && (
                  <div className="flex items-center justify-between rounded-2xl bg-primary-light px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-black text-primary">
                      <Clock size={16} /> {t("checkout.eta")}
                    </span>
                    <span className="text-right">
                      <span className="block text-base font-black text-primary leading-tight">{etaText || "—"}</span>
                      <span className="block text-[10px] font-bold text-primary/70 uppercase tracking-wide">{t("checkout.deliverNow")}</span>
                    </span>
                  </div>
                )}

                {deliveryMethod === "delivery" && lat != null && lng != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 font-medium">{t("checkout.distance")} · {t("checkout.estFee")}</span>
                    <span className="font-bold text-gray-800">
                      {distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"} · ฿{deliveryFee}
                    </span>
                  </div>
                )}

                {outOfArea && (
                  <p className="text-xs font-bold text-secondary border-t border-gray-100 pt-2">
                    ⚠️ {t("checkout.outOfArea", { km: deliveryKm })}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* ── SECTION 2 · Order Items ──────────────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-4">
            <SectionTitle icon={ShoppingBag}>{t("checkout.orderItems")}</SectionTitle>
            <div className="space-y-3">
              {cartItems.map((item) => (
                <FoodItemCard key={item.id} item={item} />
              ))}
            </div>
          </Card>

          {/* ── SECTION 3 · Note to Store ────────────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-3">
            <SectionTitle icon={Pencil}>{t("checkout.noteToStore")}</SectionTitle>
            <textarea
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder={t("checkout.storeNotePlaceholder")}
              rows={4}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </Card>

          {/* ── SECTION 4 · Payment Method ─────────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-4">
            <SectionTitle icon={Banknote}>{t("checkout.payment")}</SectionTitle>
            {/* Only the methods the store has enabled in paymentSettings are shown */}
            <div className="grid gap-2.5">
              {methods.map((m) => (
                <PaymentMethodCard key={m} method={m} active={paymentMethod === m} onClick={() => setPaymentMethod(m)} t={t} />
              ))}
            </div>

            {paymentMethod === "cash" && (
          <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm font-medium text-gray-600">
            {t("checkout.cashInstr")}
          </div>
        )}

        {paymentMethod === "promptpay" && (
          <div className="space-y-4">
            {paySettings.promptPayQrUrl ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={paySettings.promptPayQrUrl}
                    alt={t("sp.qrImage")}
                    className="w-56 h-56 max-w-full rounded-2xl border border-gray-100 bg-white p-3 object-contain"
                  />
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => saveQrImage(paySettings.promptPayQrUrl)}
                  >
                    <Download size={18} /> {t("checkout.saveQr")}
                  </Button>
                </div>
                {paySettings.promptPayNumber && (
                  <CopyField label={t("sp.promptpayNumber")} value={paySettings.promptPayNumber} t={t} />
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm font-bold text-secondary">
                {t("checkout.valPromptpay")}
              </div>
            )}
            <SlipUploadField file={slipFile} onChange={handleSlipChange} onRemove={() => setSlipFile(null)} t={t} />
          </div>
        )}

        {paymentMethod === "transfer" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <CopyField label={t("sp.bankName")} value={paySettings.bankName} t={t} />
              <CopyField label={t("sp.accountName")} value={paySettings.accountName} t={t} />
              <CopyField label={t("sp.accountNumber")} value={paySettings.accountNumber} t={t} />
            </div>
            <SlipUploadField file={slipFile} onChange={handleSlipChange} onRemove={() => setSlipFile(null)} t={t} />
          </div>
        )}
          </Card>

          {/* ── SECTION 5 · Order Summary ────────────────────────────────────── */}
          <Card className="p-5 sm:p-6 space-y-3">
            <SectionTitle icon={Coins}>{t("checkout.summary")}</SectionTitle>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm font-medium text-gray-500">
                <span>{t("checkout.foodTotal")}</span>
                <span className="font-bold text-gray-700">฿{subtotal}</span>
              </div>
              {deliveryMethod === "delivery" && (
                <div className="flex justify-between text-sm font-medium text-gray-500">
                  <span>{t("checkout.deliveryFee")}</span>
                  <span className="font-bold text-gray-700">฿{deliveryFee}</span>
                </div>
              )}
              {/* Coin balance — informational only, never applied as a discount (total unchanged) */}
              <div className="flex justify-between text-sm font-medium text-gray-500">
                <span className="flex items-center gap-1.5"><Coins size={15} className="text-amber-500" /> {t("checkout.coin")}</span>
                <span className="font-bold text-gray-700">{coinBalance}</span>
              </div>
            </div>
            <div className="flex items-end justify-between pt-3 border-t border-gray-100">
              <span className="text-base font-black text-gray-900">{t("checkout.grandTotal")}</span>
              <span className="text-2xl font-black text-primary">฿{grandTotal}</span>
            </div>
          </Card>
        </>
      )}

      {/* ── SECTION 6 · Sticky bottom bar (hidden while the cart is empty) ────
          Sits ABOVE the mobile bottom nav (≈60px + safe-area) so the button is
          always visible; on md+ the nav becomes a sidebar, so the bar drops to
          the true bottom and shifts right of the 16rem sidebar. */}
      {!cartEmpty && (
        <div className="fixed left-0 right-0 md:left-64 bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 bg-white border-t border-gray-100 p-4 sm:p-6 md:pb-[max(1.5rem,env(safe-area-inset-bottom))] z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="max-w-2xl mx-auto">
            {validationError && (
              <p className="text-center text-sm font-bold text-secondary mb-3">
                {validationError}
              </p>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">{t("checkout.total")}</p>
                <p className="text-xl font-black text-primary">฿{grandTotal}</p>
              </div>
              <Button
                className="flex-1 max-w-xs h-14 text-base"
                onClick={handlePlaceOrder}
                loading={submitting}
                disabled={storeClosed || submitting}
              >
                {storeClosed ? t("store.closedTitle") : t("checkout.placeOrder")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <LocationPicker
        isOpen={showMapModal}
        storeLocation={storeLocation}
        initialPosition={lat != null && lng != null ? { lat, lng } : null}
        onConfirm={handleConfirmMapLocation}
        onClose={() => setShowMapModal(false)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={t("checkout.confirmTitle")}
        message={t("checkout.confirmMsg", { total: grandTotal })}
        confirmText={t("checkout.placeOrder")}
        cancelText={t("addr.cancel")}
        onConfirm={handleConfirmOrder}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={!!placedOrder}
        title={t("checkout.placedTitle")}
        message={t("checkout.placedMsg", { orderNo: placedOrder?.orderNo ?? "" })}
        confirmText={t("checkout.viewMyOrders")}
        cancelText={t("checkout.continueShopping")}
        onConfirm={() => navigate(`/shop/orders/${placedOrder.orderId}`)}
        onCancel={() => navigate("/")}
      />

      <ConfirmDialog
        open={errorDialogOpen}
        title={t("checkout.errorTitle")}
        message={submitError || t("checkout.errorMsg")}
        confirmText={t("checkout.tryAgain")}
        cancelText={t("common.close")}
        onConfirm={() => {
          setErrorDialogOpen(false);
          setConfirmOpen(true);
        }}
        onCancel={() => setErrorDialogOpen(false)}
      />
    </div>
  );
};
