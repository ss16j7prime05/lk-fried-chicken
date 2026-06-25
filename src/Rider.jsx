import { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Chat from "./Chat.jsx";

const STORE_PHONE = "0830000000"; // เบอร์โทรร้าน LK Fried Chicken

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

// rider id ประจำเครื่อง (ไม่มีระบบ login)
const getRiderId = () => {
  let id = localStorage.getItem("riderId");
  if (!id) {
    id = "rider_" + Date.now();
    localStorage.setItem("riderId", id);
  }
  return id;
};

// ขั้นตอนของไรเดอร์ (riderStatus) หลังรับออเดอร์
const RIDER_STEPS = [
  { key: "ถึงร้านแล้ว", label: "1️⃣ ถึงร้านแล้ว" },
  { key: "รับอาหารแล้ว", label: "4️⃣ รับอาหารแล้ว" },
  { key: "กำลังจัดส่ง", label: "5️⃣ กำลังจัดส่ง" },
  { key: "ส่งสำเร็จ", label: "6️⃣ ส่งสำเร็จ" },
];

function Rider() {
  const [orders, setOrders] = useState([]);
  const [tracking, setTracking] = useState({});
  const [proofTarget, setProofTarget] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofUploading, setProofUploading] = useState(false);
  const watchers = useRef({});
  const [riderName, setRiderName] = useState(
    localStorage.getItem("riderName") || ""
  );
  const [riderPhone, setRiderPhone] = useState(
    localStorage.getItem("riderPhone") || ""
  );

  // เริ่มส่งอาหาร -> แชร์ตำแหน่ง realtime
  const startDelivery = (order) => {
    if (!navigator.geolocation) {
      alert("อุปกรณ์ไม่รองรับ GPS");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        updateDoc(doc(db, "orders", order.id), {
          riderLat: pos.coords.latitude,
          riderLng: pos.coords.longitude,
        });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    watchers.current[order.id] = id;
    setTracking((p) => ({ ...p, [order.id]: true }));
  };

  const stopDelivery = (orderId) => {
    const id = watchers.current[orderId];
    if (id != null) {
      navigator.geolocation.clearWatch(id);
      delete watchers.current[orderId];
    }
    setTracking((p) => ({ ...p, [orderId]: false }));
  };

  useEffect(() => {
    return () => {
      Object.values(watchers.current).forEach((id) =>
        navigator.geolocation.clearWatch(id)
      );
    };
  }, []);

  useEffect(() => {
    // ไรเดอร์เห็นออเดอร์ที่ร้านส่งให้ไรเดอร์แล้ว (กำลังจัดส่ง)
    const q = query(
      collection(db, "orders"),
      where("status", "==", "กำลังจัดส่ง")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  // 2 รับออเดอร์ -> บันทึกข้อมูลไรเดอร์ลงออเดอร์
  const acceptOrder = async (order) => {
    if (!riderName.trim() || !riderPhone.trim()) {
      alert("กรุณากรอกชื่อและเบอร์ไรเดอร์ก่อนรับออเดอร์");
      return;
    }
    localStorage.setItem("riderName", riderName.trim());
    localStorage.setItem("riderPhone", riderPhone.trim());
    await updateDoc(doc(db, "orders", order.id), {
      riderId: getRiderId(),
      riderName: riderName.trim(),
      riderPhone: riderPhone.trim(),
      riderStatus: "accepted",
    });
  };

  const setRiderStatus = async (order, riderStatus) => {
    // ส่งสำเร็จ -> ต้องอัปโหลดหลักฐานก่อน
    if (riderStatus === "ส่งสำเร็จ") {
      setProofTarget(order);
      return;
    }
    await updateDoc(doc(db, "orders", order.id), { riderStatus });
  };

  const confirmProof = async () => {
    if (!proofTarget || !proofFile) {
      alert("กรุณาอัปโหลดรูปหลักฐานการส่ง");
      return;
    }
    setProofUploading(true);
    try {
      const storageRef = ref(
        storage,
        `deliveryProof/${proofTarget.id}_${Date.now()}_${proofFile.name}`
      );
      await uploadBytes(storageRef, proofFile);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "orders", proofTarget.id), {
        riderStatus: "ส่งสำเร็จ",
        status: "เสร็จสิ้น",
        deliveryProofUrl: url,
      });
      stopDelivery(proofTarget.id);
      setProofTarget(null);
      setProofFile(null);
    } catch (err) {
      console.error(err);
      alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setProofUploading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#121212",
        color: "#fff",
        padding: "16px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px" }}>🛵 ไรเดอร์</h1>
        <Link to="/rider/dashboard">
          <button
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "none",
              background: "#4fc3f7",
              color: "#000",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🧾 Rider Dashboard
          </button>
        </Link>
        <Link to="/">
          <button
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "none",
              background: "#ff8c00",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            🍗 หน้าแรก
          </button>
        </Link>
      </div>

      {/* ข้อมูลไรเดอร์ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="ชื่อไรเดอร์"
          value={riderName}
          onChange={(e) => setRiderName(e.target.value)}
          style={{
            flex: 1,
            minWidth: "140px",
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
          }}
        />
        <input
          type="tel"
          placeholder="เบอร์ไรเดอร์"
          value={riderPhone}
          onChange={(e) => setRiderPhone(e.target.value)}
          style={{
            flex: 1,
            minWidth: "140px",
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
          }}
        />
      </div>

      {orders.length === 0 && (
        <p style={{ color: "#888" }}>ยังไม่มีออเดอร์ที่ต้องจัดส่ง</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        {orders.map((order) => (
          <div
            key={order.id}
            style={{
              background: "#1e1e1e",
              borderRadius: "20px",
              padding: "16px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: "13px", color: "#888", marginBottom: "6px" }}>
              {order.orderNo}
            </div>

            {/* 3 ข้อมูลลูกค้า */}
            <div
              style={{
                background: "#161616",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "12px",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                3️⃣ ข้อมูลลูกค้า
              </div>
              <div>👤 {order.customerName}</div>
              <div>
                📞{" "}
                <a href={`tel:${order.phone}`} style={{ color: "#4fc3f7" }}>
                  {order.phone}
                </a>
              </div>
              <div>🏠 {order.deliveryAddress || order.address || "-"}</div>
              {order.gpsLocation && (
                <div>
                  📍{" "}
                  <a
                    href={`https://www.google.com/maps?q=${order.gpsLocation}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#4fc3f7" }}
                  >
                    เปิดแผนที่
                  </a>
                </div>
              )}
            </div>

            {/* รายการอาหาร */}
            {order.items?.map((item, index) => (
              <div key={index} style={{ fontSize: "13px", marginBottom: "2px" }}>
                🍗 {item.name} ×{item.qty || 1}
                {optionLabel(item.top_chicken)
                  ? ` (${optionLabel(item.top_chicken)})`
                  : ""}
              </div>
            ))}

            <div style={{ color: "#ff8c00", fontWeight: "bold", margin: "8px 0" }}>
              💰 {order.grandTotal} บาท
            </div>

            {/* 2 รับออเดอร์ (ยังไม่มีไรเดอร์รับ) */}
            {!order.riderStatus && (
              <button
                onClick={() => acceptOrder(order)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#22c55e",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
              >
                2️⃣ รับออเดอร์
              </button>
            )}

            {/* ขั้นตอนไรเดอร์ (หลังรับออเดอร์แล้ว) */}
            {order.riderStatus && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                {RIDER_STEPS.map((step) => (
                  <button
                    key={step.key}
                    onClick={() => setRiderStatus(order, step.key)}
                    style={{
                      flex: 1,
                      minWidth: "130px",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "none",
                      background:
                        order.riderStatus === step.key ? "#22c55e" : "#333",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            )}

            {/* เริ่ม/หยุด แชร์ตำแหน่ง realtime */}
            {order.riderStatus && (
              <button
                onClick={() =>
                  tracking[order.id] ? stopDelivery(order.id) : startDelivery(order)
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: tracking[order.id] ? "#e53935" : "#22c55e",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {tracking[order.id] ? "⏹️ หยุดแชร์ตำแหน่ง" : "▶️ เริ่มส่งอาหาร (แชร์ตำแหน่ง)"}
              </button>
            )}

            {/* 7 เบอร์โทรร้าน */}
            <a href={`tel:${STORE_PHONE}`}>
              <button
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#ff8c00",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                7️⃣ 📞 โทรหาร้าน
              </button>
            </a>

            {/* แชทกับลูกค้า */}
            <Chat orderId={order.id} sender="rider" />
          </div>
        ))}
      </div>

      {/* Modal หลักฐานการส่ง */}
      {proofTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#1e1e1e",
              borderRadius: "16px",
              padding: "20px",
              width: "100%",
              maxWidth: "360px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>📸 หลักฐานการส่ง</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              style={{ marginBottom: "12px", color: "#fff" }}
            />
            {proofFile && (
              <img
                src={URL.createObjectURL(proofFile)}
                alt="preview"
                style={{ width: "120px", borderRadius: "10px", display: "block", marginBottom: "12px" }}
              />
            )}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={confirmProof}
                disabled={proofUploading}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#22c55e",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {proofUploading ? "กำลังอัปโหลด..." : "ยืนยันส่งสำเร็จ"}
              </button>
              <button
                onClick={() => {
                  setProofTarget(null);
                  setProofFile(null);
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#777",
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Rider;
