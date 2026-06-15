import { db } from "./firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
function App() {
  const [menus, setMenus] = useState([]);
const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
const [cart, setCart] = useState([]);
const [customerName, setCustomerName] = useState("");
const [phone, setPhone] = useState("");
const [address, setAddress] = useState("");
const [gpsLocation, setGpsLocation] = useState("");
const [note, setNote] = useState("");
const [paymentMethod, setPaymentMethod] = useState("เงินสด");
const [shippingFee, setShippingFee] = useState(0);
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
const riceMenus = menus.filter(
  (menu) => menu.category === "ข้าวหน้าไก่ทอด"
);

const snackMenus = menus.filter(
  (menu) => menu.category === "อาหารทานเล่น"
);

const drinkMenus = menus.filter(
  (menu) => menu.category === "เครื่องดื่ม"
);

const comboMenus = menus.filter(
  (menu) => menu.category === "เซ็ตรวม"
);
const filteredMenus =
  selectedCategory === "ทั้งหมด"
    ? menus
    : menus.filter(
        (menu) => menu.category === selectedCategory
      );

const addToCart = (menu) => {
  setCart([...cart, menu]);
};
const totalPrice = cart.reduce(
  (sum, item) => sum + item.price,
  0
);
const getLocation = () => {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setGpsLocation(`${lat},${lng}`);
    },
    (error) => {
      alert("ไม่สามารถดึงตำแหน่งได้");
    }
  );
};
const submitOrder = async () => {
  if (cart.length === 0) {
    alert("ยังไม่มีสินค้าในตะกร้า");
    return;
  }
  if (!customerName.trim()) {
  alert("กรุณากรอกชื่อผู้สั่ง");
  return;
}

if (!phone.trim()) {
  alert("กรุณากรอกเบอร์โทร");
  return;
}
if (!gpsLocation.trim()) {
  alert("กรุณากดใช้ตำแหน่งปัจจุบัน");
  return;
}
  console.log("เริ่มบันทึกออเดอร์");
 await addDoc(collection(db, "orders"), {
  items: cart,
  totalPrice: totalPrice,
  status: "ออเดอร์ใหม่",
  createdAt: new Date(),
  customerName: customerName,
  phone: phone,
  address: address,
  gpsLocation: gpsLocation,
  note: note,
  paymentMethod: paymentMethod,
  shippingFee: shippingFee
});
console.log("บันทึกสำเร็จ");
  alert("สั่งอาหารสำเร็จ 🎉");
  setCart([]);
setCustomerName("");
};
return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>🍗 LK Fried Chicken</h1>
  <input
  type="text"
  placeholder="ชื่อผู้สั่ง"
  value={customerName}
  onChange={(e) => setCustomerName(e.target.value)}
  required
  style={{
    padding: "10px",
    marginBottom: "10px",
    width: "250px"
  }}
  />
  <input
  type="tel"
  placeholder="เบอร์โทร"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  style={{
    padding: "10px",
    marginBottom: "10px",
    width: "250px"
  }}
 />
<button onClick={getLocation}>
  📍 ใช้ตำแหน่งปัจจุบัน
</button>

<p>GPS: {gpsLocation}</p>

<textarea
  placeholder="หมายเหตุ"
  value={note}
  onChange={(e) => setNote(e.target.value)}
  style={{
    padding: "10px",
    marginBottom: "10px",
    width: "250px",
    height: "60px"
  }}
></textarea>
<select
  value={paymentMethod}
  onChange={(e) => setPaymentMethod(e.target.value)}
>
  <option value="เงินสด">เงินสด</option>
  <option value="โอนเงิน">โอนเงิน</option>
  <option value="PromptPay">PromptPay</option>
</select>
  
<h3>🛒 ตะกร้าสินค้า</h3>
      <h3>🛒 ตะกร้า ({cart.length}) รายการ</h3>
      <Link to="/orders">
  <button style={{ marginBottom: "20px" }}>
    📦 ดูออเดอร์
  </button>
</Link>
<div style={{ marginBottom: "20px" }}>
  <button onClick={() => setSelectedCategory("ทั้งหมด")}>ทั้งหมด</button>
  <button onClick={() => setSelectedCategory("ข้าวหน้าไก่ทอด")}>ข้าวหน้าไก่ทอด</button>
  <button onClick={() => setSelectedCategory("อาหารทานเล่น")}>อาหารทานเล่น</button>
  <button onClick={() => setSelectedCategory("เครื่องดื่ม")}>เครื่องดื่ม</button>
  <button onClick={() => setSelectedCategory("เซ็ตรวม")}>เซ็ตรวม</button>
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
    style={{
      border: "1px solid #ffffff",
      padding: "10px",
      marginBottom: "10px",
    }}
  >
    <h3>{menu.name}</h3>

    <p>ราคา: {menu.price} บาท</p>

    {menu.image && (
      <img
        src={menu.image}
        alt={menu.name}
        width="150"
      />
    )}

    <br />

    <button onClick={() => addToCart(menu)}>
      เพิ่มลงตะกร้า
    </button>
  </div>
))} 
</div>
<hr />

<h2>🛒 ตะกร้าสินค้า</h2>
<h3>รวมเป็นเงิน: {totalPrice} บาท</h3>
<button onClick={() => setCart([])}>
  🗑️ ล้างตะกร้า
</button>
<button onClick={submitOrder}>
  📦 สั่งอาหาร
</button>
{cart.map((item, index) => (
  <div key={index}>
    {item.name} - {item.price} บาท

    <button
      onClick={() => {
        const newCart = cart.filter((_, i) => i !== index);
        setCart(newCart);
      }}
    >
      ❌ ลบ
    </button>

  </div>
))}
</div>
  );
}

export default App;