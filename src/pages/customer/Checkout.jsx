import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { MapPin, QrCode, Upload } from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { STORE_ID } from "../../config";
import { generateOrderNo } from "../../orderNoUtils";
import { PAYMENT_STATUS } from "../../payment/paymentUtils";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Loading } from "../../components/ui/Loading";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useCart } from "../../context/CartContext";

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

export const Checkout = () => {
  const { cartItems, subtotal, deliveryFee, grandTotal, clearCart } = useCart();
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
  const [gpsLocation, setGpsLocation] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("cash"); // 'cash' | 'promptpay'
  const [slipUploaded, setSlipUploaded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleMockGps = () => {
    setGpsLoading(true);
    setTimeout(() => {
      setAddress("123 Sukhumvit Rd, Klongtoey, Bangkok 10110");
      setGpsLocation({ lat: 13.7367, lng: 100.5232 });
      setGpsLoading(false);
    }, 1200);
  };

  const handleMockUploadSlip = () => {
    setSlipUploaded(true);
  };

  const handlePlaceOrder = () => {
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const orderNo = await generateOrderNo(db);
      const isDelivery = deliveryMethod === "delivery";
      const lat = isDelivery ? gpsLocation?.lat ?? null : null;
      const lng = isDelivery ? gpsLocation?.lng ?? null : null;

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
      // (single source of truth: the order-creation logic in src/App.jsx).
      await addDoc(collection(db, "orders"), {
        orderNo,
        storeId: STORE_ID,
        riderLat: null,
        riderLng: null,
        slipImage: "",
        paymentTime: null,
        payment: {
          method: paymentMethod,
          status:
            paymentMethod === "cash"
              ? PAYMENT_STATUS.UNPAID
              : PAYMENT_STATUS.PENDING_VERIFICATION,
          slipUrl: "",
          paidAt: null,
          verifiedBy: null,
        },
        customerName: displayName,
        phone: displayPhone,
        note: deliveryNote,
        address: isDelivery ? address : "",
        deliveryAddress: isDelivery ? address : "",
        latitude: lat,
        longitude: lng,
        lat,
        lng,
        gpsLocation: lat != null && lng != null ? `${lat},${lng}` : "",
        deliveryLocation: {
          lat,
          lng,
          address: isDelivery ? address : "",
        },
        distanceKm: null,
        distance: null,
        deliveryDistance: null,
        storeLat: null,
        storeLng: null,
        orderType: deliveryMethod,
        paymentMethod,
        paymentStatus: "pending",
        items: legacyItems,
        subtotal,
        deliveryFee,
        grandTotal,
        status: "pending",
        riderStatus: "",
        riderId: "",
        createdAt: serverTimestamp(),
      });

      clearCart();
      navigate("/shop/orders");
    } catch (err) {
      console.error("Failed to place order:", err);
      setSubmitError("Failed to place your order. Please try again.");
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
            <Input
              label="Address"
              placeholder="House no., street, area..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleMockGps}
              disabled={gpsLoading}
            >
              <MapPin size={18} />
              {gpsLoading ? "Locating..." : "Use My Current Location"}
            </Button>
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
        </div>

        {paymentMethod === "promptpay" && (
          <div className="space-y-4">
            <div className="aspect-square max-w-[220px] mx-auto bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400">
              <QrCode size={48} />
              <span className="text-xs font-bold">QR Code Placeholder</span>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleMockUploadSlip}
            >
              <Upload size={18} />
              {slipUploaded ? "Slip Uploaded ✓" : "Upload Payment Slip"}
            </Button>
            {slipUploaded && (
              <p className="text-center text-sm font-bold text-primary">
                Slip received — pending verification
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Order Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Order Summary</SectionTitle>
          <Badge color={paymentMethod === "cash" ? "green" : "blue"}>
            {paymentMethod === "cash" ? "Cash" : "PromptPay"}
          </Badge>
        </div>
        <div className="space-y-3">
          {cartItems.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium">Your cart is empty.</p>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600 font-medium">
                  {item.quantity}x {item.menu?.name}
                </span>
                <span className="font-bold text-gray-900">฿{item.totalPrice}</span>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <div className="flex justify-between text-sm font-medium text-gray-500">
            <span>Subtotal</span>
            <span>฿{subtotal}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-gray-500">
            <span>Delivery Fee</span>
            <span>฿{deliveryFee}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-gray-100">
            <span>Grand Total</span>
            <span className="text-primary">฿{grandTotal}</span>
          </div>
        </div>
      </Card>

      {/* Fixed bottom Place Order button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 sm:p-6 z-30">
        <div className="max-w-2xl mx-auto">
          {submitError && (
            <p className="text-center text-sm font-bold text-secondary mb-3">
              {submitError}
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

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Order"
        message={`Place this order for ฿${grandTotal}?`}
        confirmText="Place Order"
        cancelText="Cancel"
        onConfirm={handleConfirmOrder}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
