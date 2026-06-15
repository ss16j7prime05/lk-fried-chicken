import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "firebase/firestore";
function Orders() {
  const [orders, setOrders] = useState([]);
const [filter, setFilter] = useState("ออเดอร์ใหม่");
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .reverse();
      setOrders(data);
    });

    return () => unsubscribe();
  }, []);
const updateStatus = async (id, currentStatus) => {
  let newStatus = currentStatus;

  if (currentStatus === "ออเดอร์ใหม่") {
    newStatus = "กำลังทำ";
  } else if (currentStatus === "กำลังทำ") {
    newStatus = "จัดส่ง";
  } else if (currentStatus === "จัดส่ง") {
    newStatus = "เสร็จสิ้น";
  }

  await updateDoc(doc(db, "orders", id), {
    status: newStatus,
  });
};
const filteredOrders = orders.filter(
  (order) => order.status === filter
);
const deleteOrder = async (id) => {
  if (!window.confirm("ลบออเดอร์นี้ใช่ไหม?")) return;

  await deleteDoc(doc(db, "orders", id));

  window.location.reload();
};
  return (
   <div style={{ padding: "20px" }}>
  <h1>📦 รายการออเดอร์</h1>
<div style={{ marginBottom: "20px" }}>

  <button onClick={() => setFilter("ออเดอร์ใหม่")}>
    ใหม่
  </button>

  <button onClick={() => setFilter("กำลังทำ")}>
    กำลังทำ
  </button>

  <button onClick={() => setFilter("จัดส่ง")}>
    จัดส่ง
  </button>

  <button onClick={() => setFilter("เสร็จสิ้น")}>
    เสร็จสิ้น
  </button>

</div>
  {filteredOrders.map((order) => (
    <div
      key={order.id}
      style={{
        border: "1px solid white",
        padding: "10px",
        marginBottom: "10px",
      }}
    >
    <h3>ลูกค้า: {order.customerName}</h3>
<p>สถานะ: {order.status}</p>

<button
  onClick={() =>
    updateStatus(order.id, order.status)
  }
>
  เปลี่ยนสถานะ
</button>

<button
  onClick={() => deleteOrder(order.id)}
  style={{
    marginLeft: "10px",
    background: "red",
    color: "white"
  }}
>
  ลบออเดอร์
</button>
<h3>รวม {order.totalPrice} บาท</h3>

{order.items?.map((item, index) => (
  <p key={index}>
    {item.name} - {item.price} บาท
  </p>
))}
    </div>
  ))}
</div>
);
}

export default Orders;