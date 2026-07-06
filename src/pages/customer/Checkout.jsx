import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { MapPin, Map, Upload } from "lucide-react";
import { db, storage } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { STORE_ID, PROMPTPAY_ACCOUNT_NAME } from "../../config";
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
import { getStore } from "./getStore";

// Fallback store coordinates, used only until stores/{STORE_ID} loads (matches the
// same fallback in src/App.jsx / src/pages/customer/OrderDetail.jsx).
const FALLBACK_STORE_LAT = 13.8294079;
const FALLBACK_STORE_LNG = 100.0529543;
const MAX_RADIUS_KM = 8;

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
const SlipUploadField = ({ file, onChange }) => {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm border-2 border-gray-100 hover:border-primary text-gray-700 cursor-pointer transition-all">
        <Upload size={18} />
        {file ? "Change Payment Slip" : "Upload Payment Slip"}
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
            alt="Payment slip preview"
            className="w-20 h-20 rounded-2xl object-cover border border-gray-100"
          />
          <p className="text-sm font-bold text-primary">Slip attached — pending verification</p>
        </div>
      )}
    </div>
  );
};

export const Checkout = () => {
  const { cartItems, subtotal, clearCart } = useCart();
  const { profile } = useAuth();
  const navigate = useNavigate();

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
  const [deliveryFee, setDeliveryFee] = useState(0);
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
      const { distanceKm: km } = await getRoute(storeLocation.lat, storeLocation.lng, latValue, lngValue);
      setDistanceKm(km);
      setDeliveryFee(calcDeliveryFee(km));
    } catch {
      // Fallback to straight-line distance if road-routing is unavailable.
      const km = haversineKm(storeLocation.lat, storeLocation.lng, latValue, lngValue);
      setDistanceKm(km);
      setDeliveryFee(calcDeliveryFee(km));
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setValidationError("Your device doesn't support GPS location.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyLocation(pos.coords.latitude, pos.coords.longitude);
        setGpsLoading(false);
      },
      () => {
        setValidationError("Unable to get your location. Please try again or pick it on the map.");
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
    if (cartItems.length === 0) return "Your cart is empty.";

    for (const item of cartItems) {
      const needsTopChicken = item.menu?.category === RICE_TOPPED_CATEGORY;
      if (needsTopChicken && !item.topChicken) {
        return `"${item.menu?.name}" is missing a required chicken topping.`;
      }
      const needsSpicy = item.menu?.name === SPICY_SALAD_NAME;
      if (needsSpicy && !item.spicy) {
        return `"${item.menu?.name}" is missing a required spice level.`;
      }
    }

    if (!displayName.trim()) return "Please enter your name.";
    if (!displayPhone.trim()) return "Please enter your phone number.";

    if (deliveryMethod === "delivery") {
      if (!address.trim()) return "Please enter a delivery address.";
      if (lat == null || lng == null) {
        return "Please share your location (GPS or map) so we can calculate delivery.";
      }
      if (outOfArea) return `Sorry, this address is outside our ${MAX_RADIUS_KM} km delivery area.`;
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
      setSubmitError("Failed to place your order. Please try again.");
      setErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) {
    return <Loading text="Placing your order..." />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6 pb-32">
      <h1 className="text-2xl font-black text-gray-900">Checkout</h1>

      {/* Customer Information */}
      <Card className="p-6">
        <SectionTitle>Customer Information</SectionTitle>
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={displayName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Phone Number"
            placeholder="08X-XXX-XXXX"
            type="tel"
            value={displayPhone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </Card>

      {/* Delivery */}
      <Card className="p-6">
        <SectionTitle>Delivery</SectionTitle>
        <div className="flex gap-3 mb-4">
          <ToggleOption
            label="Delivery"
            active={deliveryMethod === "delivery"}
            onClick={() => setDeliveryMethod("delivery")}
          />
          <ToggleOption
            label="Pickup"
            active={deliveryMethod === "pickup"}
            onClick={() => setDeliveryMethod("pickup")}
          />
        </div>

        {deliveryMethod === "delivery" && (
          <div className="space-y-4">
            {savedAddress && (
              <button
                type="button"
                onClick={applySavedAddress}
                className="w-full text-left p-3 rounded-2xl bg-primary-light border border-primary/20 text-sm font-medium text-gray-700 hover:brightness-95 transition-all"
              >
                <span className="font-bold text-primary">Use saved address: </span>
                {savedAddress.address}
              </button>
            )}

            <Input
              label="Address"
              placeholder="House no., street, area..."
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
                {gpsLoading ? "Locating..." : "Use My Current Location"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowMapModal(true)}>
                <Map size={18} />
                Choose on Map
              </Button>
            </div>

            {lat != null && lng != null && (
              <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
                <div className="flex justify-between text-sm font-medium text-gray-500">
                  <span>Distance</span>
                  <span>{distanceKm != null ? `${distanceKm.toFixed(1)} km` : "-"}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-gray-500">
                  <span>Delivery Fee</span>
                  <span>฿{deliveryFee}</span>
                </div>
                <MapButton
                  lat={lat}
                  lng={lng}
                  address={address}
                  mode="view"
                  label="View on Google Maps"
                  style={{ width: "100%", textAlign: "center", display: "block", marginTop: "4px" }}
                />
              </div>
            )}

            {outOfArea && (
              <p className="text-sm font-bold text-secondary">
                Sorry, this address is outside our {MAX_RADIUS_KM} km delivery area.
              </p>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Delivery Note
              </label>
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="E.g. leave at the gate, call upon arrival..."
                rows={3}
                className="w-full mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Payment */}
      <Card className="p-6">
        <SectionTitle>Payment</SectionTitle>
        <div className="flex gap-3 mb-4">
          <ToggleOption
            label="Cash"
            active={paymentMethod === "cash"}
            onClick={() => setPaymentMethod("cash")}
          />
          <ToggleOption
            label="PromptPay"
            active={paymentMethod === "promptpay"}
            onClick={() => setPaymentMethod("promptpay")}
          />
          <ToggleOption
            label="Transfer"
            active={paymentMethod === "transfer"}
            onClick={() => setPaymentMethod("transfer")}
          />
        </div>

        {paymentMethod === "promptpay" && (
          <div className="space-y-4">
            <PromptPayQR amount={grandTotal} />
            <SlipUploadField file={slipFile} onChange={setSlipFile} />
          </div>
        )}

        {paymentMethod === "transfer" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-600">
              Please transfer the total amount to{" "}
              <span className="font-bold text-gray-900">{PROMPTPAY_ACCOUNT_NAME}</span>, then
              upload your payment slip below.
            </div>
            <SlipUploadField file={slipFile} onChange={setSlipFile} />
          </div>
        )}
      </Card>

      {/* Order Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Order Summary</SectionTitle>
          <Badge color={paymentMethod === "cash" ? "green" : paymentMethod === "promptpay" ? "blue" : "orange"}>
            {paymentMethod === "cash" ? "Cash" : paymentMethod === "promptpay" ? "PromptPay" : "Transfer"}
          </Badge>
        </div>
        <div className="space-y-3">
          {cartItems.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium">Your cart is empty.</p>
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
                      <p className="text-xs text-gray-400 mt-0.5">Note: {item.note}</p>
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
            <span>Subtotal</span>
            <span>฿{subtotal}</span>
          </div>
          {deliveryMethod === "delivery" && (
            <div className="flex justify-between text-sm font-medium text-gray-500">
              <span>Delivery Fee</span>
              <span>฿{deliveryFee}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-gray-100">
            <span>Grand Total</span>
            <span className="text-primary">฿{grandTotal}</span>
          </div>
        </div>
      </Card>

      {/* Fixed bottom Place Order button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 sm:p-6 z-30">
        <div className="max-w-2xl mx-auto">
          {validationError && (
            <p className="text-center text-sm font-bold text-secondary mb-3">
              {validationError}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
              <p className="text-xl font-black text-primary">฿{grandTotal}</p>
            </div>
            <Button className="flex-1 max-w-xs" onClick={handlePlaceOrder}>
              Place Order
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
        title="Confirm Order"
        message={`Place this order for ฿${grandTotal}?`}
        confirmText="Place Order"
        cancelText="Cancel"
        onConfirm={handleConfirmOrder}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={!!placedOrder}
        title="Order Placed! 🎉"
        message={`Your order ${placedOrder?.orderNo ?? ""} has been received and is being prepared.`}
        confirmText="View My Orders"
        cancelText="Continue Shopping"
        onConfirm={() => navigate(`/shop/orders/${placedOrder.orderId}`)}
        onCancel={() => navigate("/")}
      />

      <ConfirmDialog
        open={errorDialogOpen}
        title="Something Went Wrong"
        message={submitError || "Failed to place your order. Please try again."}
        confirmText="Try Again"
        cancelText="Close"
        onConfirm={() => {
          setErrorDialogOpen(false);
          setConfirmOpen(true);
        }}
        onCancel={() => setErrorDialogOpen(false)}
      />
    </div>
  );
};
