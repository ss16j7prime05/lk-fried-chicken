import { db } from "./firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
const [paymentMethod, setPaymentMethod] = useState("เงินสด");
const [shippingFee, setShippingFee] = useState(0);
const [selectedTopChicken, setSelectedTopChicken] = useState("");
const [showModal, setShowModal] = useState(false);

const [selectedMenu, setSelectedMenu] = useState(null);

const [selectedSauce, setSelectedSauce] = useState("");

const [selectedSpicy, setSelectedSpicy] = useState("");
console.log(options);
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

  const fetchOptions = async () => {

    const querySnapshot =
      await getDocs(collection(db, "options"));

    const optionData =
      querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
setOptions(optionData);
console.log(optionData);
   
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
const sauce = options.find(
(item)=>item.id==="sauce"
);

const spicy = options.find(
(item)=>item.id==="spicy"
);

const openMenu = (menu) => {

setSelectedMenu(menu);

setSelectedSauce("");

setSelectedSpicy("");

setShowModal(true);

}
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
  const existingItem = cart.find(
    (item) => item.id === menu.id
  );

  if (existingItem) {
    setCart(
      cart.map((item) =>
        item.id === menu.id
          ? { ...item, qty: item.qty + 1 }
          : item
      )
    );
  } else {
    setCart([
      ...cart,
      {
        ...menu,
        qty: 1,
      },
    ]);
  }
};
const totalPrice = cart.reduce(
  (sum, item) => sum + item.price * item.qty,
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
  orderNumber: "LK-" + Date.now(),

  items: cart,

  totalPrice: totalPrice,

  status: "ออเดอร์ใหม่",

  paymentStatus: "รอชำระ",

  createdAt: new Date(),

  updatedAt: new Date(),

  customerName: customerName,

  phone: phone,

  address: address,

  gpsLocation: gpsLocation,

  note: note,

  paymentMethod: paymentMethod,

  shippingFee: shippingFee,
});
console.log("บันทึกสำเร็จ");
  alert("สั่งอาหารสำเร็จ 🎉");
  setCart([]);
setCustomerName("");
setPhone("");
setAddress("");
setGpsLocation("");
setNote("");
};
return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>🍗 LK Fried Chicken</h1>
  
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
  border: "1px solid #ddd",
  borderRadius: "12px",
  padding: "15px",
  backgroundColor: "#f8f8f8",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    }}
  > {menu.image && (
      <img
  src={menu.image}
  alt={menu.name}
  style={{
    width: "100%",
    height: "180px",
    objectFit: "cover",
    borderRadius: "12px",
    marginBottom: "10px",
  }}
/>
    )}
    <h3
  style={{
    fontSize: "20px",
    marginBottom: "10px",
    color: "#222",
  }}
>
  {menu.name}
</h3>
    <p
  style={{
    color: "#e53935",
    fontWeight: "bold",
    fontSize: "18px",
  }}
>
  ฿{menu.price}
</p>

   <button
onClick={() => openMenu(menu)}
  style={{
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    background: "#22c55e",
    color: "white",
    border: "none",
    fontSize: "28px",
    cursor: "pointer",
  }}
>
  +
</button>
  </div>
))} 
</div>
<hr />

<h2> สรุปรายการสั่งซื่อ</h2>
<h3>รวมเป็นเงิน: {totalPrice} บาท</h3>
<input
  type="text"
  placeholder="ชื่อลูกค้า"
  value={customerName}
  onChange={(e) => setCustomerName(e.target.value)}
/>

<br /><br />

<input
  type="tel"
  placeholder="เบอร์โทร"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
/>

<br /><br />

<textarea
  placeholder="ที่อยู่จัดส่ง"
  value={address}
  onChange={(e) => setAddress(e.target.value)}
/>

<br /><br />
<h3>💳 วิธีชำระเงิน</h3>

<select
  value={paymentMethod}
  onChange={(e) => setPaymentMethod(e.target.value)}
>
  <option value="เงินสด">เงินสด</option>
  <option value="โอนเงิน">โอนเงิน</option>
  <option value="PromptPay">PromptPay</option>
</select>

<br /><br />
<button onClick={getLocation}>
  📍 ดึง GPS
</button>

<div>{gpsLocation}</div>

<br />

<textarea
  placeholder="หมายเหตุ"
  value={note}
  onChange={(e) => setNote(e.target.value)}
/>
{topChicken && (
  <>
    <h4>{topChicken.title}</h4>

    <select
      value={selectedTopChicken}
      onChange={(e) =>
        setSelectedTopChicken(e.target.value)
      }
    >
      <option value="">
        -- กรุณาเลือก --
      </option>

      {topChicken.choices.map((choice,index) => (
        <option
          key={index}
          value={choice.name}
        >
          {choice.name}
        </option>
      ))}
    </select>

    <br /><br />
  </>
)}
<br /><br />
<button onClick={() => setCart([])}>
  🗑️ ล้างตะกร้า
</button>

<button onClick={submitOrder}>
  📦 สั่งอาหาร
</button>

{cart.map((item, index) => (
  <div key={index}>
  <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  }}
>
 <div style={{ flex: 1 }}>
  {item.name}
</div>

  <button
    onClick={() => {
      if (item.qty > 1) {
        setCart(
          cart.map((cartItem) =>
            cartItem.id === item.id
              ? {
                  ...cartItem,
                  qty: cartItem.qty - 1,
                }
              : cartItem
          )
        );
      }
    }}
  >
    -
  </button>

  <span>{item.qty}</span>

  <button
    onClick={() => {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                qty: cartItem.qty + 1,
              }
            : cartItem
        )
      );
    }}
  >
    +
  </button>

  <span>
    {item.price * item.qty} บาท
  </span>
</div>
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
<div style={{ textAlign: "center", marginTop: "30px" }}>
  <Link to="/orders">
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
      📦 ดูออเดอร์
    </button>
  </Link>
  {showModal && (

<div className="modal">

  <div className="modal-content">

    <h2>{selectedMenu?.name}</h2>

    <h3>ราคา {selectedMenu?.price} บาท</h3>

    <br/>

    <h3>เลือกซอส</h3>

    <select
      value={selectedSauce}
      onChange={(e)=>setSelectedSauce(e.target.value)}
    >

      <option value="">เลือกซอส</option>

      {sauce?.choices?.map((item,index)=>(

        <option
          key={index}
          value={item.name}
        >
          {item.name}
        </option>

      ))}

    </select>


    <br/><br/>

    <h3>ระดับความเผ็ด</h3>

    <select
      value={selectedSpicy}
      onChange={(e)=>setSelectedSpicy(e.target.value)}
    >

      <option value="">เลือกความเผ็ด</option>

      {spicy?.choices?.map((item,index)=>(

        <option
          key={index}
          value={item.name}
        >
          {item.name}
        </option>

      ))}

    </select>

    <br/><br/>

<button
  onClick={() => {

    addToCart({
      ...selectedMenu,
      sauce: selectedSauce,
      spicy: selectedSpicy
    });

    setSelectedSauce("");
    setSelectedSpicy("");
    setShowModal(false);

  }}
>
  ใส่ตะกร้า
</button>
 <button
  onClick={() => setShowModal(false)}
>
  ปิด
</button>
 </div>
</div>

)}
</div>
</div>
);
}

export default App;