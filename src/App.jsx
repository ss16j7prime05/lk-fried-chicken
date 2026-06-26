import { db, storage } from "./firebase";
import CustomerProfileHeader from "./CustomerProfileHeader";
import { collection, getDocs, addDoc, serverTimestamp, doc, runTransaction, onSnapshot, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { STORE_ID } from "./config";
import PromptPayQR from "./payment/PromptPayQR.jsx";
import { PAYMENT_STATUS } from "./payment/paymentUtils";
import "./checkout.css";

// เลขออเดอร์อัตโนมัติแบบรันต่อวัน เช่น LK2506240001
const generateOrderNo = async (database) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dayKey = `${yy}${mm}${dd}`;
  const counterRef = doc(database, "counters", dayKey);
  try {
    const seq = await runTransaction(database, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? snap.data().count || 0 : 0;
      const next = current + 1;
      tx.set(counterRef, { count: next }, { merge: true });
      return next;
    });
    return `LK${dayKey}${String(seq).padStart(4, "0")}`;
  } catch (err) {
    console.error(err);
    return `LK${dayKey}${String(Date.now()).slice(-4)}`;
  }
};
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LocationPicker from "./location/LocationPicker.jsx";
import {
  calcDeliveryFee,
  getRoute,
  haversineKm,
  reverseGeocode,
} from "./location/locationUtils";

// LK Fried Chicken store location (ค่าเริ่มต้น ใช้เมื่อยังไม่มี lat/lng ใน Firestore stores/{STORE_ID})
// 526 ซอย ประปานคร 3 ต.นครปฐม อ.เมืองนครปฐม จ.นครปฐม 73000
const SHOP_LAT = 13.8294079;
const SHOP_LNG = 100.0529543;

const MAX_RADIUS_KM = 8;

// ร้านเปิดตามเวลา (รองรับข้ามวัน เช่น 15:30 - 02:00)
const withinHours = (openTime, closeTime) => {
  if (!openTime || !closeTime) return true;
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  if (closeM <= openM) {
    // ข้ามเที่ยงคืน
    return cur >= openM || cur < closeM;
  }
  return cur >= openM && cur < closeM;
};

function App() {
  const [menus, setMenus] = useState([]);
  const [options, setOptions] = useState([]);
const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
const [cart, setCart] = useState([]);
const [customerName, setCustomerName] = useState("");
const [phone, setPhone] = useState("");
const [address, setAddress] = useState("");
const [gpsLocation, setGpsLocation] = useState("");
const [note, setNote] = useState("");
const [paymentMethod, setPaymentMethod] = useState("cash");
const [shippingFee, setShippingFee] = useState(0);
const [orderType, setOrderType] = useState("delivery");
const [selectedTopChicken, setSelectedTopChicken] = useState("");
const [showModal, setShowModal] = useState(false);
const [selectedMenu, setSelectedMenu] = useState(null);
const [selectedSpicy, setSelectedSpicy] = useState("");
const [quantity, setQuantity] = useState(1);
const [selectedPowder, setSelectedPowder] = useState("");
const [selectedSauceMain, setSelectedSauceMain] = useState("");
const [selectedSauce, setSelectedSauce] = useState("");
const [selectedTableCheese, setSelectedTableCheese] = useState("");
const [itemNote, setItemNote] = useState("");
const [lat, setLat] = useState(null);
const [lng, setLng] = useState(null);
const [cartOpen, setCartOpen] = useState(false);
const [cartItemsExpanded, setCartItemsExpanded] = useState(false);
const [searchTerm, setSearchTerm] = useState("");
const [storeData, setStoreData] = useState({ isOpen: true });
const [, setTick] = useState(0);
const [slipFile, setSlipFile] = useState(null);
const [deliveryAddress, setDeliveryAddress] = useState("");
const [distanceKm, setDistanceKm] = useState(null);
const [deliveryFee, setDeliveryFee] = useState(0);
const [showMapModal, setShowMapModal] = useState(false);
useEffect(() => {
  const fetchMenus = async () => {
    const querySnapshot = await getDocs(collection(db, "menus"));
    const menuData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setMenus(menuData);
  };
  fetchMenus();
}, []);
useEffect(() => {
  const unsub = onSnapshot(doc(db, "stores", STORE_ID), (snap) => {
    if (snap.exists()) setStoreData(snap.data());
  });
  // re-evaluate เวลาเปิด/ปิดทุก 1 นาที
  const interval = setInterval(() => setTick((t) => t + 1), 60000);
  return () => {
    unsub();
    clearInterval(interval);
  };
}, []);
useEffect(() => {

  const fetchOptions = async () => {

    const querySnapshot =
      await getDocs(collection(db, "options"));

    const optionData =
      querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
setOptions(optionData);
  };

  fetchOptions();

}, []);
const riceMenus = menus.filter(
  (menu) => menu.category === "ข้าวหน้าไก่ทอด"
);

const snackMenus = menus.filter(
  (menu) => menu.category === "อาหารทานเล่น"
);
const topChicken = options.find(
  (item) => item.id === "top_chicken"
);
const spicy = options.find(
(item)=>item.id==="spicy"
);
const powder = options.find(
(item)=>item.id==="poewder"
);
const sauceMain = options.find(
(item)=>item.id==="Sauce"
);
const sauceExtra = options.find(
(item)=>item.id==="sauce"
);
const tableCheese = options.find(
(item)=>item.id==="table cheese"
);
const optionsTotal = (item) =>
  (item.Sauce?.price || 0) +
  (item.sauce?.price || 0) +
  (item.powder?.price || 0) +
  (item.tableCheese?.price || 0);
const itemTotal = (item) =>
  ((item.price || 0) + optionsTotal(item)) * item.qty;
const openMenu = (menu) => {
  setSelectedMenu(menu);
  setSelectedTopChicken("");
  setSelectedSpicy("");
  setSelectedPowder(null);
  setSelectedSauceMain(null);
  setSelectedSauce(null);
  setSelectedTableCheese(null);
  setItemNote("");
  setQuantity(1);
  setShowModal(true);
};
const drinkMenus = menus.filter(
  (menu) => menu.category === "เครื่องดื่ม"
);

const comboMenus = menus.filter(
  (menu) => menu.category === "เซ็ตรวม"
);
const filteredMenus = menus
  .filter(
    (menu) =>
      selectedCategory === "ทั้งหมด" ||
      menu.category === selectedCategory
  )
  .filter(
    (menu) =>
      !searchTerm ||
      menu.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
const addToCart = (menu) => {
  if (!storeOpen) {
    alert("ร้านปิดรับออเดอร์");
    return;
  }
  setCart((prev) => [
    ...prev,
    {
      ...menu,
      qty: menu.qty || 1,
      top_chicken: menu.top_chicken || "",
      spicy: menu.spicy || "",
      powder: menu.powder || "",
      note: menu.note || "",
    },
  ]);
};


const totalPrice = cart.reduce(
  (sum, item) => sum + itemTotal(item),
  0
);
const storeOpen =
  storeData.isOpen !== false &&
  withinHours(storeData.openTime, storeData.closeTime);
const outOfArea =
  orderType === "delivery" &&
  distanceKm != null &&
  distanceKm > MAX_RADIUS_KM;

// ตำแหน่งร้าน: อ่านจาก Firestore stores/{STORE_ID} ถ้ามี lat/lng ไม่งั้น fallback ค่าคงที่
const storeLocation = {
  lat: storeData.lat ?? SHOP_LAT,
  lng: storeData.lng ?? SHOP_LNG,
  name: storeData.storeName || "LK Fried Chicken",
};

const applyLocation = async (latValue, lngValue, knownAddress) => {
  // Always persist coordinates + address (independent of route lookup)
  setLat(latValue);
  setLng(lngValue);
  setGpsLocation(`${latValue},${lngValue}`);

  const addr = knownAddress || (await reverseGeocode(latValue, lngValue));
  setDeliveryAddress(addr);
  setAddress(addr);

  try {
    const { distanceKm: km } = await getRoute(
      storeLocation.lat,
      storeLocation.lng,
      latValue,
      lngValue
    );
    setDistanceKm(km);
    setDeliveryFee(calcDeliveryFee(km));
  } catch (err) {
    console.error(err);

    // Fallback to straight-line (Haversine) distance if routing fails
    const km = haversineKm(storeLocation.lat, storeLocation.lng, latValue, lngValue);
    setDistanceKm(km);
    setDeliveryFee(calcDeliveryFee(km));

    alert("ไม่สามารถคำนวณระยะทางได้");
  }
};

const getLocation = () => {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      applyLocation(position.coords.latitude, position.coords.longitude);
    },
    () => {
      alert("ไม่สามารถดึงตำแหน่งได้");
    }
  );
};

const handleConfirmLocation = async ({ lat: latValue, lng: lngValue, address: addr }) => {
  await applyLocation(latValue, lngValue, addr);
  setShowMapModal(false);
};
const submitOrder = async () => {
  if (!storeOpen) {
    alert("ร้านปิดรับออเดอร์");
    return;
  }
  if (outOfArea) {
    alert("ขออภัย อยู่นอกพื้นที่จัดส่ง");
    return;
  }
  if (cart.length === 0) {
    alert("ยังไม่มีสินค้าในตะกร้า");
    return;
  }
  if (!customerName.trim()) {
  alert("กรุณากรอกชื่อ");
  return;
}

if (!phone.trim()) {
  alert("กรุณากรอกเบอร์โทร");
  return;
}
if (orderType === "delivery") {
  if (!address.trim()) {
    alert("กรุณาระบุที่อยู่");
    return;
  }
  if (!gpsLocation.trim()) {
    alert("กรุณาเลือกตำแหน่ง");
    return;
  }
}
  // ตรวจสอบลูกค้าถูกบล็อกหรือไม่
  try {
    const blockSnap = await getDoc(doc(db, "blockedCustomers", phone.trim()));
    if (blockSnap.exists() && blockSnap.data().blocked) {
      alert("บัญชีของคุณถูกระงับการสั่งซื้อ กรุณาติดต่อร้าน");
      return;
    }
  } catch (e) {
    console.warn(e);
  }

  // อัปโหลดสลิปถ้ามี
  let slipImage = "";
  let paymentTime = null;
  if (slipFile && (paymentMethod === "transfer" || paymentMethod === "promptpay")) {
    try {
      const slipRef = ref(storage, `slips/${Date.now()}_${slipFile.name}`);
      await uploadBytes(slipRef, slipFile);
      slipImage = await getDownloadURL(slipRef);
      paymentTime = new Date();
    } catch (e) {
      console.error(e);
    }
  }

  const orderNo = await generateOrderNo(db);
 await addDoc(collection(db, "orders"), {
  orderNo: orderNo,

  storeId: STORE_ID,

  riderLat: null,

  riderLng: null,

  slipImage: slipImage,

  paymentTime: paymentTime,

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

  customerName: customerName,

  phone: phone,

  note: note,

  address: address,

  deliveryAddress: deliveryAddress,

  latitude: lat,

  longitude: lng,

  lat: lat,

  lng: lng,

  gpsLocation: gpsLocation,

  deliveryLocation: {
    lat: lat,
    lng: lng,
    address: deliveryAddress,
  },

  distanceKm: distanceKm,

  distance: distanceKm,

  deliveryDistance: distanceKm,

  storeLat: storeLocation.lat,

  storeLng: storeLocation.lng,

  orderType: orderType,

  paymentMethod: paymentMethod,

  paymentStatus: "pending",

  items: cart,

  subtotal: totalPrice,

  deliveryFee: orderType === "delivery" ? deliveryFee : 0,

  grandTotal: totalPrice + (orderType === "delivery" ? deliveryFee : 0),

  status: "pending",

  riderStatus: "",

  riderId: "",

  createdAt: serverTimestamp(),
});
  alert("สั่งซื้อสำเร็จ");
  setCart([]);
setCustomerName("");
setPhone("");
setAddress("");
setGpsLocation("");
setNote("");
setLat(null);
setLng(null);
setDeliveryAddress("");
setDistanceKm(null);
setDeliveryFee(0);
setSlipFile(null);
setSelectedTopChicken("");
setSelectedSpicy("");
setSelectedPowder(null);
setSelectedSauceMain(null);
setSelectedSauce(null);
setSelectedTableCheese(null);
setItemNote("");
setQuantity(1);
setOrderType("delivery");
};
return (
    <div style={{ padding: "0 0 20px", fontFamily: "sans-serif", background: "#121212", minHeight: "100vh", color: "#fff" }}>

{/* Sticky Header */}
<div
  style={{
    position: "sticky",
    top: 0,
    zIndex: 1000,
    background: "#1a1a1a",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
  }}
>
  <h1 style={{ margin: 0, fontSize: "20px", whiteSpace: "nowrap" }}>🍗 LK</h1>

  <input
    type="text"
    placeholder="ค้นหาเมนู..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    style={{
      flex: 1,
      minWidth: 0,
      padding: "10px 14px",
      borderRadius: "20px",
      border: "none",
      background: "#2a2a2a",
      color: "#fff",
      fontSize: "15px",
    }}
  />

  <button
    onClick={() => setCartOpen(true)}
    style={{
      flexShrink: 0,
      padding: "10px 16px",
      borderRadius: "30px",
      background: "#ff9800",
      color: "#fff",
      border: "none",
      fontSize: "16px",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}
  >
    🛒 {cart.length}
  </button>
</div>

<div style={{ padding: "20px" }}>
      <CustomerProfileHeader />
      <h2 style={{ marginTop: 0 }}>🍗 LK Fried Chicken</h2>
{!storeOpen && (
  <div
    style={{
      background: "#e53935",
      color: "#fff",
      padding: "12px",
      borderRadius: "12px",
      textAlign: "center",
      fontWeight: "bold",
      marginBottom: "16px",
    }}
  >
    ⛔ ร้านปิดรับออเดอร์
  </div>
)}

{/* Overlay */}
{cartOpen && (
  <div className="checkout-overlay" onClick={() => setCartOpen(false)} />
)}

{/* Checkout drawer: full-screen sheet on mobile, centered two-column modal on desktop */}
<div className={`checkout-drawer${cartOpen ? " open" : ""}`}>
  <div className="checkout-header">
    <h2>🛒 รายการที่สั่ง · ตะกร้า</h2>
    <button
      className="checkout-close-btn"
      onClick={() => setCartOpen(false)}
      aria-label="ปิด"
    >
      ✕
    </button>
  </div>

  <div className="checkout-body">
    <div className="checkout-grid">
      <div className="checkout-col-left">
        {/* 1. Cart Items: collapsed by default, shows item count */}
        <div className="checkout-section">
          <button
            type="button"
            className="cart-toggle"
            onClick={() => setCartItemsExpanded((v) => !v)}
          >
            <span>
              📋 รายการอาหาร ({cart.reduce((sum, i) => sum + i.qty, 0)} ชิ้น)
            </span>
            <span className={`cart-toggle-chevron${cartItemsExpanded ? " expanded" : ""}`}>
              ▼
            </span>
          </button>

          {cartItemsExpanded && (
            <div className="cart-items-list">
              {cart.length === 0 && (
                <p style={{ color: "#888", margin: 0 }}>ยังไม่มีสินค้าในตะกร้า</p>
              )}

              {cart.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "12px",
                    background: "#2a2a2a",
                    borderRadius: "12px",
                    padding: "12px",
                  }}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold" }}>{item.name}</div>
                    {item.top_chicken && <div>🍖 {item.top_chicken}</div>}
                    {item.spicy && <div>🌶️ {item.spicy}</div>}
                    {item.Sauce && <div>🍟 ซอส : {item.Sauce.name} (+{item.Sauce.price || 0})</div>}
                    {item.sauce && <div>🥫 เพิ่มซอส : {item.sauce.name} (+{item.sauce.price || 0})</div>}
                    {item.powder && <div>🧂 ผงเขย่า : {item.powder.name} (+{item.powder.price || 0})</div>}
                    {item.tableCheese && <div>🧀 ชีส : {item.tableCheese.name} (+{item.tableCheese.price || 0})</div>}
                    {item.note && <div>📝 {item.note}</div>}
                    <div>ราคา : {itemTotal(item)} บาท</div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginTop: "8px",
                      }}
                    >
                      <button
                        onClick={() => {
                          if (item.qty > 1) {
                            setCart(
                              cart.map((cartItem, i) =>
                                i === index
                                  ? { ...cartItem, qty: cartItem.qty - 1 }
                                  : cartItem
                              )
                            );
                          }
                        }}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          border: "none",
                          background: "#444",
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        -
                      </button>
                      <span>{item.qty}</span>
                      <button
                        onClick={() => {
                          setCart(
                            cart.map((cartItem, i) =>
                              i === index
                                ? { ...cartItem, qty: cartItem.qty + 1 }
                                : cartItem
                            )
                          );
                        }}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          border: "none",
                          background: "#444",
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                      <span style={{ marginLeft: "auto", color: "#ff9800" }}>
                        {itemTotal(item)} บาท
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setCart(cart.filter((_, i) => i !== index));
                      }}
                      style={{
                        marginTop: "8px",
                        background: "none",
                        border: "none",
                        color: "#e53935",
                        cursor: "pointer",
                        padding: 0,
                        minHeight: "32px",
                      }}
                    >
                      ❌ ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Customer Information */}
        <div className="checkout-section">
          <input
            type="text"
            placeholder="ชื่อ"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="field"
          />
          <input
            type="tel"
            placeholder="เบอร์โทร"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field"
            style={{ marginBottom: 0 }}
          />
        </div>

        {/* 3. Delivery / Pickup + Address */}
        <div className="checkout-section">
          <label style={{ display: "block", marginBottom: "8px" }}>
            รูปแบบการสั่ง
          </label>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
            className="field"
            style={{ marginBottom: orderType === "delivery" ? "10px" : 0 }}
          >
            <option value="pickup">รับที่ร้าน</option>
            <option value="delivery">ส่งถึงบ้าน</option>
          </select>

          {orderType === "delivery" && (
            <textarea
              placeholder="ที่อยู่จัดส่ง"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="field"
              style={{ marginBottom: 0 }}
            />
          )}
        </div>
      </div>

      <div className="checkout-col-right">
        {/* 4-5. GPS + Map (delivery only) */}
        {orderType === "delivery" && (
          <div className="checkout-section">
            <button onClick={getLocation} className="btn btn-secondary">
              📍 ใช้ตำแหน่งปัจจุบัน
            </button>

            <button
              onClick={() => setShowMapModal(true)}
              className="btn btn-secondary"
              style={{ marginBottom: gpsLocation ? "10px" : 0 }}
            >
              🗺️ เลือกตำแหน่งบนแผนที่
            </button>

            {gpsLocation && (
              <div
                style={{
                  background: "#2a2a2a",
                  borderRadius: "10px",
                  padding: "10px",
                  fontSize: "14px",
                }}
              >
                <div>📍 ที่อยู่จัดส่ง</div>
                <div style={{ color: "#ccc", marginBottom: "8px" }}>
                  {deliveryAddress}
                </div>
                {/* 6. Shipping fee */}
                <div>🚗 ระยะทางตามเส้นทางจริง</div>
                <div style={{ marginBottom: "8px" }}>
                  {distanceKm != null ? distanceKm.toFixed(1) : "-"} กม.
                </div>
                <div>🛵 ค่าส่ง</div>
                <div>{deliveryFee} บาท</div>
              </div>
            )}
          </div>
        )}

        {/* 7. Payment Method */}
        <div className="checkout-section">
          <label style={{ display: "block", marginBottom: "8px" }}>
            วิธีชำระเงิน
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="field"
            style={{
              marginBottom:
                paymentMethod === "transfer" || paymentMethod === "promptpay" ? "12px" : 0,
            }}
          >
            <option value="cash">เงินสด</option>
            <option value="transfer">โอนเงิน</option>
            <option value="promptpay">PromptPay</option>
          </select>

          {(paymentMethod === "transfer" || paymentMethod === "promptpay") && (
            <div style={{ textAlign: "center" }}>
              {paymentMethod === "promptpay" ? (
                <PromptPayQR
                  amount={totalPrice + (orderType === "delivery" ? deliveryFee : 0)}
                />
              ) : (
                <>
                  <div style={{ marginBottom: "6px" }}>สแกนเพื่อชำระเงิน</div>
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=LK-Fried-Chicken-PromptPay"
                    alt="QR PromptPay"
                    style={{
                      width: "200px",
                      maxWidth: "100%",
                      borderRadius: "12px",
                      background: "#fff",
                      padding: "8px",
                    }}
                  />
                </>
              )}
              <div style={{ marginTop: "8px", fontSize: "14px" }}>แนบสลิปการโอน</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                style={{ color: "#fff", marginTop: "6px" }}
              />
              {slipFile && (
                <img
                  src={URL.createObjectURL(slipFile)}
                  alt="slip"
                  style={{ width: "100px", borderRadius: "10px", display: "block", margin: "8px auto 0" }}
                />
              )}
            </div>
          )}
        </div>

        {/* 8. Note */}
        <div className="checkout-section">
          <label style={{ display: "block", marginBottom: "8px" }}>
            หมายเหตุเพิ่มเติม (ถ้ามี)
          </label>
          <textarea
            placeholder="เช่น ไม่เผ็ด, แยกถุงน้ำจิ้ม ฯลฯ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field"
            style={{ marginBottom: 0 }}
          />
        </div>

        {/* 9. Order Summary */}
        <div className="checkout-section">
          <div style={{ marginBottom: "12px", fontSize: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>ค่าอาหาร</span>
              <span>{totalPrice} บาท</span>
            </div>
            {orderType === "delivery" && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>ค่าส่ง</span>
                <span>{deliveryFee} บาท</span>
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: outOfArea ? "12px" : 0,
            }}
          >
            <span>💰 รวมทั้งหมด</span>
            <span style={{ color: "#ff9800" }}>
              {totalPrice + (orderType === "delivery" ? deliveryFee : 0)} บาท
            </span>
          </div>
          {outOfArea && (
            <div
              style={{
                background: "#e53935",
                color: "#fff",
                padding: "10px",
                borderRadius: "10px",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              ขออภัย อยู่นอกพื้นที่จัดส่ง (เกิน {MAX_RADIUS_KM} กม.)
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

  {/* 10. Sticky Confirm Order Button */}
  <div className="checkout-footer">
    <button
      onClick={submitOrder}
      disabled={!storeOpen || outOfArea}
      className="btn btn-primary"
    >
      {!storeOpen
        ? "ร้านปิดรับออเดอร์"
        : outOfArea
        ? "นอกพื้นที่จัดส่ง"
        : "📦 ยืนยันสั่งซื้อ"}
    </button>
  </div>
</div>

{/* Map Picker Modal */}
<LocationPicker
  isOpen={showMapModal}
  storeLocation={storeLocation}
  initialPosition={lat != null && lng != null ? { lat, lng } : null}
  onConfirm={handleConfirmLocation}
  onClose={() => setShowMapModal(false)}
/>

<div
  style={{
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    overflowX: "auto",
    paddingBottom: "6px",
    WebkitOverflowScrolling: "touch",
  }}
>
  {["ทั้งหมด", "ข้าวหน้าไก่ทอด", "อาหารทานเล่น", "เครื่องดื่ม", "เซ็ตรวม"].map(
    (cat) => (
      <button
        key={cat}
        onClick={() => setSelectedCategory(cat)}
        style={{
          flexShrink: 0,
          padding: "10px 18px",
          borderRadius: "20px",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
          whiteSpace: "nowrap",
          background: selectedCategory === cat ? "#ff9800" : "#2a2a2a",
          color: "#fff",
        }}
      >
        {cat}
      </button>
    )
  )}
</div>
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "20px",
  }}
>

{filteredMenus.map((menu) => (
  <div
    key={menu.id}
    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    style={{
  borderRadius: "24px",
  padding: "15px",
  backgroundColor: "#fff",
  boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
  transition: "transform 0.2s ease",
  position: "relative",
    }}
  > {menu.image && (
      <img
  src={menu.image}
  alt={menu.name}
  style={{
    width: "100%",
    height: "230px",
    objectFit: "cover",
    borderRadius: "20px",
    marginBottom: "10px",
  }}
/>
    )}
    <h3
  style={{
    fontSize: "24px",
    fontWeight: 700,
    marginBottom: "10px",
    color: "#222",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    minHeight: "62px",
  }}
>
  {menu.name}
</h3>
    <p
  style={{
    color: "#ff9800",
    fontWeight: "bold",
    fontSize: "26px",
    margin: "0 0 12px",
  }}
>
  ฿{menu.price}
</p>

{menu.available === false ? (
  <div
    style={{
      textAlign: "center",
      padding: "14px",
      borderRadius: "12px",
      background: "#eee",
      color: "#999",
      fontWeight: "bold",
      fontSize: "16px",
    }}
  >
    สินค้าหมด
  </div>
) : (
<div style={{ display: "flex", gap: "10px" }}>
   <button
onClick={() => openMenu(menu)}
  style={{
    width: "52px",
    height: "52px",
    flexShrink: 0,
    borderRadius: "50%",
    background: "#22c55e",
    color: "white",
    border: "none",
    fontSize: "30px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(34,197,94,0.4)",
  }}
>
  +
</button>

<button
  onClick={() => openMenu(menu)}
  style={{
    flex: 1,
    height: "52px",
    borderRadius: "26px",
    background: "#fff",
    color: "#ff9800",
    border: "2px solid #ff9800",
    fontWeight: "bold",
    fontSize: "15px",
    cursor: "pointer",
  }}
>
  ดูรายละเอียด
</button>
</div>
)}
  </div>
))}
</div>
<div style={{ textAlign: "center", marginTop: "30px" }}>
  <Link to="/store">
    <button
      style={{
        padding: "12px 25px",
        fontSize: "18px",
        borderRadius: "12px",
        background: "#ff9800",
        color: "white",
        border: "none",
        cursor: "pointer"
      }}
    >
      🏪 ร้านค้า
    </button>
  </Link>
  <Link to="/history">
    <button
      style={{
        padding: "12px 25px",
        fontSize: "18px",
        borderRadius: "12px",
        background: "#444",
        color: "white",
        border: "none",
        cursor: "pointer",
        marginLeft: "10px",
      }}
    >
      📜 ประวัติการสั่งซื้อ
    </button>
  </Link>
  <Link to="/track">
    <button
      style={{
        padding: "12px 25px",
        fontSize: "18px",
        borderRadius: "12px",
        background: "#444",
        color: "white",
        border: "none",
        cursor: "pointer",
        marginLeft: "10px",
      }}
    >
      🚚 ติดตามออเดอร์
    </button>
  </Link>
  {showModal && (

<div
  className="modal"
  onClick={() => setShowModal(false)}
  style={{
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.7)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  }}
>

  <div
    className="modal-content"
    onClick={(e) => e.stopPropagation()}
    style={{
      background: "#fff",
      color: "#222",
      borderRadius: "28px",
      padding: "20px",
      width: "100%",
      maxWidth: "450px",
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
    }}
  >

    {selectedMenu?.image && (
      <img
        src={selectedMenu.image}
        alt={selectedMenu.name}
        style={{
          width: "100%",
          height: "250px",
          objectFit: "cover",
          borderRadius: "16px",
          marginBottom: "14px",
        }}
      />
    )}

    <h2 style={{ fontSize: "26px", margin: "0 0 6px" }}>{selectedMenu?.name}</h2>

    <p style={{ color: "#e53935", fontWeight: "bold", fontSize: "22px", margin: "0 0 10px" }}>
      ฿{selectedMenu?.price}
    </p>

{selectedMenu?.category === "ข้าวหน้าไก่ทอด" && (

<>

<h3>เลือกไก่ทอดที่จะเอามาทำหน้าข้าว</h3>

{topChicken?.choices?.map((item,index)=>(

<label key={index} style={{ display: "block", marginBottom: "6px" }}>
  <input
    type="radio"
    name="topChicken"
    value={item.name}
    checked={selectedTopChicken === item.name}
    onChange={(e)=>setSelectedTopChicken(e.target.value)}
  />{" "}
  {item.name}
</label>

))}

</>
)}

    <br/><br/>
{selectedMenu?.name === "ข้าวยำไก่แซ่บ" && (

<>

<h3>ระดับความเผ็ด</h3>

{spicy?.choices?.map((item,index)=>(

<label key={index} style={{ display: "block", marginBottom: "6px" }}>
  <input
    type="radio"
    name="spicy"
    value={item.name}
    checked={selectedSpicy === item.name}
    onChange={(e)=>setSelectedSpicy(e.target.value)}
  />{" "}
  {item.name}
</label>

))}

</>
)}

<br/><br/>

{["อาหารทานเล่น", "เซ็ตรวม"].includes(selectedMenu?.category) && (

<>

{sauceMain?.choices?.length > 0 && (
<>
<h3>เลือกซอส</h3>
{sauceMain.choices.map((item, index) => (
  <label key={index} style={{ display: "block", marginBottom: "6px" }}>
    <input
      type="radio"
      name="sauceMain"
      checked={selectedSauceMain?.name === item.name}
      onChange={() => setSelectedSauceMain({ name: item.name, price: item.price || 0 })}
    />{" "}
    {item.name} (+{item.price || 0} บาท)
  </label>
))}
<br/><br/>
</>
)}

{sauceExtra?.choices?.length > 0 && (
<>
<h3>เพิ่มซอส</h3>
{sauceExtra.choices.map((item, index) => (
  <label key={index} style={{ display: "block", marginBottom: "6px" }}>
    <input
      type="radio"
      name="sauceExtra"
      checked={selectedSauce?.name === item.name}
      onChange={() => setSelectedSauce({ name: item.name, price: item.price || 0 })}
    />{" "}
    {item.name} (+{item.price || 0} บาท)
  </label>
))}
<br/><br/>
</>
)}

{powder?.choices?.length > 0 && (
<>
<h3>เลือกผงเขย่า</h3>
{powder.choices.map((item, index) => (
  <label key={index} style={{ display: "block", marginBottom: "6px" }}>
    <input
      type="radio"
      name="powder"
      checked={selectedPowder?.name === item.name}
      onChange={() => setSelectedPowder({ name: item.name, price: item.price || 0 })}
    />{" "}
    {item.name} (+{item.price || 0} บาท)
  </label>
))}
<br/><br/>
</>
)}

{tableCheese?.choices?.length > 0 && (
<>
<h3>เพิ่มชีส</h3>
{tableCheese.choices.map((item, index) => (
  <label key={index} style={{ display: "block", marginBottom: "6px" }}>
    <input
      type="radio"
      name="tableCheese"
      checked={selectedTableCheese?.name === item.name}
      onChange={() => setSelectedTableCheese({ name: item.name, price: item.price || 0 })}
    />{" "}
    {item.name} (+{item.price || 0} บาท)
  </label>
))}
<br/><br/>
</>
)}

</>
)}

<br/><br/>

<h3>หมายเหตุเพิ่มเติม</h3>

<textarea
  placeholder="หมายเหตุเพิ่มเติม"
  value={itemNote}
  onChange={(e)=>setItemNote(e.target.value)}
  style={{
    width: "100%",
    minHeight: "60px",
    borderRadius: "10px",
    border: "1px solid #ccc",
    padding: "10px",
    fontFamily: "inherit",
    boxSizing: "border-box",
  }}
/>

<br/><br/>

<h3>จำนวน</h3>

<div style={{ display: "flex", alignItems: "center" }}>
<button
onClick={()=>{
if(quantity>1){
setQuantity(quantity-1)
}
}}
style={{
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  border: "none",
  background: "#eee",
  fontSize: "20px",
  cursor: "pointer",
}}
>
-
</button>

<span style={{margin:"0 20px", fontSize: "18px"}}>
{quantity}
</span>

<button
onClick={()=>{
setQuantity(quantity+1)
}}
style={{
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  border: "none",
  background: "#eee",
  fontSize: "20px",
  cursor: "pointer",
}}
>
+
</button>
</div>

<br/>
<button
onClick={() => {

const item = {
  ...selectedMenu,
  top_chicken: selectedTopChicken,

  spicy:
    selectedMenu?.name === "ข้าวยำไก่แซ่บ"
      ? selectedSpicy
      : "",

  Sauce: selectedSauceMain,

  sauce: selectedSauce,

  powder: selectedPowder,

  tableCheese: selectedTableCheese,

  note: itemNote,

  qty: quantity
};

if (selectedMenu?.category === "ข้าวหน้าไก่ทอด" && !selectedTopChicken) {
  alert("กรุณาเลือกไก่ทอด");
  return;
}

if (
  selectedMenu?.name === "ข้าวยำไก่แซ่บ" &&
  !selectedSpicy
) {
  alert("กรุณาเลือกระดับความเผ็ด");
  return;
}

addToCart(item);
setShowModal(false);
setSelectedSauceMain(null);
setSelectedSauce(null);
setSelectedPowder(null);
setSelectedTableCheese(null);

}}
style={{
  width: "100%",
  padding: "14px",
  marginTop: "8px",
  borderRadius: "12px",
  background: "#ff9800",
  color: "#fff",
  border: "none",
  fontSize: "18px",
  fontWeight: "bold",
  cursor: "pointer",
}}
>
เพิ่มลงตะกร้า
</button>
 <button
  onClick={() => setShowModal(false)}
  style={{
    width: "100%",
    padding: "12px",
    marginTop: "10px",
    borderRadius: "12px",
    background: "#fff",
    color: "#666",
    border: "1px solid #ccc",
    fontSize: "16px",
    cursor: "pointer",
  }}
>
  ปิด
</button>
 </div>

</div>

)}
</div>
</div>
</div>
);

}   // ← เพิ่มบรรทัดนี้

export default App;