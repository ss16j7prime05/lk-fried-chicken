import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { MapPin, Map, Upload } from "lucide-react";
import { db, storage } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { STORE_ID, PROMPTPAY_ACCOUNT_NAME, EST_PREP_MINUTES } from "../../config";
import { generateOrderNo } from "../../orderNoUtils";
import { PAYMENT_STATUS } from "../../payment/paymentUtils";
import PromptPayQR from "../../payment/PromptPayQR.jsx";
import LocationPicker from "../../location/LocationPicker.jsx";
import MapButton from "../../location/MapButton.jsx";
import { calcDeliveryFee, getRoute, haversineKm, reverseGeocode } from "../../location/locationUtils";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Loading } from "../../components/ui/Loading";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useCart } from "../../context/CartContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useStoreStatus } from "../../store/useStoreStatus";
import { StoreClosedBanner } from "../../components/customer/StoreClosedBanner";
import { getStore } from "./getStore";
import { useAddresses } from "../../hooks/useAddresses";
import { formatFullAddress, labelMeta, MAX_DELIVERY_RADIUS_KM } from "../../constants/address";

// Fallback store coordinates, used only until stores/{STORE_ID} loads (matches the
// same fallback in src/App.jsx / src/pages/customer/OrderDetail.jsx).
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;
const MAX_RADIUS_KM = MAX_DELIVERY_RADIUS_KM;

// Mirrors src/App.jsx / MenuDetailModal.jsx's real required-option rules (single
// source of truth for these Firestore `options` category/name checks) — re-checked
// here as a defensive guard in case a cart item ever ends up incomplete.
const RICE_TOPPED_CATEGORY = "ข้าวหน้าไก่ทอด";
const SPICY_SALAD_NAME = "ข้าวยำไก่แซ่บ";

// Device-local only (localStorage) — not written to Firestore, so this doesn't
// touch the users/{uid} schema.
const SAVED_ADDRESS_KEY = "lkfc_saved_address";

const optionLabel = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value.name || "" : value;
};

const SectionTitle = ({ children }) => (
  <h2 className="text-lg font-black text-gray-900 mb-4">{children}</h2>
);

const ToggleOption = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 py-3 rounded-2xl font-bold text-sm border transition-all ${
      active
        ? "bg-primary text-white border-primary"
        : "bg-gray-50 text-gray-600 border-gray-100 hover:border-primary"
    }`}
  >
    {label}
  </button>
);

// Reused for both PromptPay and Transfer — file input styled to match Button's
// "outline" variant, plus an image preview once a slip is selected.
const SlipUploadField = ({ file, onChange, t }) => {
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
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {previewUrl && (
        <div className="flex items-center gap-3">
          <img
            src={previewUrl}
            alt={t("checkout.slipPreviewAlt")}
            className="w-20 h-20 rounded-2xl object-cover border border-gray-100"
          />
          <p className="text-sm font-bold text-primary">{t("checkout.slipAttached")}</p>
        </div>
      )}
    </div>
  );
};

export const Checkout = () => {
  const { cartItems, subtotal, clearCart, deliveryFee, setDeliveryFee } = useCart();
  const { profile, user } = useAuth();
  const { t } = usePreferences();
  const { status: storeStatus } = useStoreStatus("delivery");
  const storeClosed = storeStatus === "closed";
  const navigate = useNavigate();

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

  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null); // { orderId, orderNo } once submitted

  // Real store location, for accurate distance/fee (falls back to the constant
  // above until this resolves).
  useEffect(() => {
    getStore().then((s) => {
      if (s) setStoreLocation({ lat: s.lat, lng: s.lng, name: s.storeName || "LK Fried Chicken" });
    });
  }, []);

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

  const outOfArea =
    deliveryMethod === "delivery" && distanceKm != null && distanceKm > MAX_RADIUS_KM;

  const grandTotal = subtotal + (deliveryMethod === "delivery" ? deliveryFee : 0);

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
      if (outOfArea) return t("checkout.outOfArea", { km: MAX_RADIUS_KM });
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

      let slipImage = "";
      let paymentTime = null;
      if (slipFile && (paymentMethod === "promptpay" || paymentMethod === "transfer")) {
        const slipRef = ref(storage, `slips/${Date.now()}_${slipFile.name}`);
        await uploadBytes(slipRef, slipFile);
        slipImage = await getDownloadURL(slipRef);
        paymentTime = new Date();
      }

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
          status: slipImage
            ? PAYMENT_STATUS.PENDING_VERIFICATION
            : paymentMethod === "cash"
            ? PAYMENT_STATUS.UNPAID
            : PAYMENT_STATUS.PENDING_VERIFICATION,
          slipUrl: slipImage,
          paidAt: paymentTime,
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
    } catch (err) {
      console.error("Failed to place order:", err);
      setSubmitError(t("checkout.errorMsg"));
      setErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <Loading text={t("checkout.placingOrder")} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6 pb-60 md:pb-44">
      <h1 className="text-2xl font-black text-gray-900">{t("checkout.title")}</h1>

      <StoreClosedBanner />

      {/* Customer Information */}
      <Card className="p-6">
        <SectionTitle>{t("checkout.customerInfo")}</SectionTitle>
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
        </div>
      </Card>

      {/* Delivery */}
      <Card className="p-6">
        <SectionTitle>{t("checkout.delivery")}</SectionTitle>
        <div className="flex gap-3 mb-4">
          <ToggleOption
            label={t("checkout.delivery")}
            active={deliveryMethod === "delivery"}
            onClick={() => setDeliveryMethod("delivery")}
          />
          <ToggleOption
            label={t("checkout.pickup")}
            active={deliveryMethod === "pickup"}
            onClick={() => setDeliveryMethod("pickup")}
          />
        </div>

        {deliveryMethod === "delivery" && (
          <div className="space-y-4">
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

            {/* Selected address summary */}
            {selectedAddressId && (
              <div className="rounded-2xl bg-white border border-primary/20 p-4 space-y-2 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider">
                    {t("checkout.deliveringTo")}
                  </p>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      lat != null && lng != null
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {lat != null && lng != null ? "GPS ✓" : t("checkout.noGps")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <span className="text-gray-400 font-medium">{t("checkout.receiver")}</span>
                  <span className="text-gray-800 font-bold text-right truncate">{displayName || "—"}</span>
                  <span className="text-gray-400 font-medium">{t("checkout.phone")}</span>
                  <span className="text-gray-800 font-bold text-right truncate">{displayPhone || "—"}</span>
                  <span className="text-gray-400 font-medium">{t("checkout.distance")}</span>
                  <span className="text-gray-800 font-bold text-right">
                    {distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"}
                  </span>
                  <span className="text-gray-400 font-medium">{t("checkout.estTime")}</span>
                  <span className="text-gray-800 font-bold text-right">
                    {etaMinutes != null ? `~${etaMinutes} min` : "—"}
                  </span>
                  <span className="text-gray-400 font-medium">{t("checkout.estFee")}</span>
                  <span className="text-primary font-black text-right">฿{deliveryFee}</span>
                </div>
                {deliveryNote && (
                  <p className="text-xs text-gray-500 font-medium border-t border-gray-100 pt-2">
                    Note: {deliveryNote}
                  </p>
                )}
                {outOfArea && (
                  <p className="text-xs font-bold text-secondary border-t border-gray-100 pt-2">
                    ⚠️ {t("checkout.outOfArea", { km: MAX_RADIUS_KM })}
                  </p>
                )}
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
                {t("checkout.outOfArea", { km: MAX_RADIUS_KM })}
              </p>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {t("checkout.deliveryNoteLabel")}
              </label>
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder={t("checkout.deliveryNotePlaceholder")}
                rows={3}
                className="w-full mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Payment */}
      <Card className="p-6">
        <SectionTitle>{t("checkout.payment")}</SectionTitle>
        <div className="flex gap-3 mb-4">
          <ToggleOption
            label={t("payment.cash")}
            active={paymentMethod === "cash"}
            onClick={() => setPaymentMethod("cash")}
          />
          <ToggleOption
            label={t("payment.promptpay")}
            active={paymentMethod === "promptpay"}
            onClick={() => setPaymentMethod("promptpay")}
          />
          <ToggleOption
            label={t("payment.transfer")}
            active={paymentMethod === "transfer"}
            onClick={() => setPaymentMethod("transfer")}
          />
        </div>

        {paymentMethod === "promptpay" && (
          <div className="space-y-4">
            <PromptPayQR amount={grandTotal} />
            <SlipUploadField file={slipFile} onChange={setSlipFile} t={t} />
          </div>
        )}

        {paymentMethod === "transfer" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-600">
              {t("checkout.transferInstr", { name: PROMPTPAY_ACCOUNT_NAME })}
            </div>
            <SlipUploadField file={slipFile} onChange={setSlipFile} t={t} />
          </div>
        )}
      </Card>

      {/* Order Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>{t("checkout.summary")}</SectionTitle>
          <Badge color={paymentMethod === "cash" ? "green" : paymentMethod === "promptpay" ? "blue" : "orange"}>
            {t(`payment.${paymentMethod}`)}
          </Badge>
        </div>
        <div className="space-y-3">
          {cartItems.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium">{t("checkout.emptyCart")}</p>
          ) : (
            cartItems.map((item) => {
              const options = [
                item.topChicken,
                item.spicy,
                optionLabel(item.sauceMain),
                optionLabel(item.sauceExtra),
                optionLabel(item.powder),
                optionLabel(item.tableCheese),
              ].filter(Boolean);

              return (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-700 font-medium">
                      {item.quantity}x {item.menu?.name}
                    </p>
                    {options.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">{options.join(" • ")}</p>
                    )}
                    {item.note && (
                      <p className="text-xs text-gray-400 mt-0.5">{t("addr.noteLabel")}: {item.note}</p>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 whitespace-nowrap">
                    ฿{item.totalPrice}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <div className="flex justify-between text-sm font-medium text-gray-500">
            <span>{t("checkout.subtotal")}</span>
            <span>฿{subtotal}</span>
          </div>
          {deliveryMethod === "delivery" && (
            <div className="flex justify-between text-sm font-medium text-gray-500">
              <span>{t("checkout.deliveryFee")}</span>
              <span>฿{deliveryFee}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-gray-100">
            <span>{t("checkout.grandTotal")}</span>
            <span className="text-primary">฿{grandTotal}</span>
          </div>
        </div>
      </Card>

      {/* Fixed bottom Place Order bar — sits ABOVE the mobile bottom navigation
          (nav ≈ 56px + safe-area) so the button is always 100% visible; on md+
          the nav becomes a sidebar, so the bar drops to the true bottom and
          shifts right of the 16rem sidebar. */}
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
            <Button className="flex-1 max-w-xs h-14 text-base disabled:opacity-50" onClick={handlePlaceOrder} disabled={storeClosed}>
              {storeClosed ? t("store.closedTitle") : t("checkout.placeOrder")}
            </Button>
          </div>
        </div>
      </div>

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
