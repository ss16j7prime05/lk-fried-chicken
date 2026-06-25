import { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import Chat from "./Chat.jsx";
import PaymentStatusBadge from "./payment/PaymentStatusBadge.jsx";
import TrackingPanel from "./tracking/TrackingPanel.jsx";
import { STORE_ID } from "./config";

// ฟอร์มให้คะแนนเมื่อออเดอร์เสร็จสิ้น
function ReviewForm({ order }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  const submit = async () => {
    await addDoc(collection(db, "reviews"), {
      orderId: order.id,
      customerName: order.customerName || "",
      riderId: order.riderId || "",
      storeId: order.storeId || "",
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: serverTimestamp(),
    });
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ marginTop: "10px", color: "#22c55e" }}>
        ขอบคุณสำหรับรีวิว ⭐
      </div>
    );
  }

  return (
    <div style={{ marginTop: "10px", background: "#161616", borderRadius: "12px", padding: "12px" }}>
      <div style={{ fontWeight: "bold", marginBottom: "6px" }}>ให้คะแนนการจัดส่ง</div>
      <div style={{ fontSize: "24px", marginBottom: "6px" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            onClick={() => setRating(n)}
            style={{ cursor: "pointer", color: n <= rating ? "#ffd54f" : "#555" }}
          >
            ★
          </span>
        ))}
      </div>
      <textarea
        placeholder="เขียนรีวิว (ไม่บังคับ)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{
          width: "100%",
          minHeight: "50px",
          borderRadius: "8px",
          border: "none",
          background: "#2a2a2a",
          color: "#fff",
          padding: "8px",
          boxSizing: "border-box",
        }}
      />
      <button
        onClick={submit}
        style={{
          width: "100%",
          marginTop: "8px",
          padding: "10px",
          borderRadius: "10px",
          border: "none",
          background: "#ff8c00",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        ส่งรีวิว
      </button>
    </div>
  );
}

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const statusColor = (status) => {
  switch (status) {
    case "กำลังทำ":
    case "cooking":
      return "#ff8c00";
    case "ส่งให้ไรเดอร์":
    case "จัดส่ง":
    case "delivering":
    case "ready_for_delivery":
    case "out_for_delivery":
    case "picked_up":
      return "#4fc3f7";
    case "เสร็จสิ้น":
    case "completed":
      return "#22c55e";
    default:
      return "#ffd54f"; // ออเดอร์ใหม่ / pending / accepted = yellow
  }
};

// ป้ายสถานะภาษาไทยสำหรับสถานะอังกฤษ (Store/Rider Dashboard ใหม่)
const ENGLISH_STATUS_LABEL = {
  pending: "ออเดอร์ใหม่",
  accepted: "ร้านรับออเดอร์แล้ว",
  cooking: "กำลังทำ",
  ready_for_delivery: "กำลังจัดส่ง",
  delivering: "กำลังจัดส่ง",
  out_for_delivery: "ไรเดอร์กำลังไปส่ง",
  picked_up: "ไรเดอร์รับอาหารแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
};

const statusLabel = (status) =>
  ENGLISH_STATUS_LABEL[status] || status || "ออเดอร์ใหม่";

const formatDate = (createdAt) => {
  if (!createdAt) return "";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

// เบอร์โทรร้าน LK Fried Chicken
const STORE_PHONE = "0830000000";

// ขั้นตอนที่ลูกค้าเห็น
const STEPS = ["ร้านรับออเดอร์", "กำลังทำ", "กำลังจัดส่ง", "เสร็จสิ้น"];

// แปลงสถานะจริงใน Firestore -> index ของ STEPS
const statusToStep = (status) => {
  const s = status === "pending" ? "ออเดอร์ใหม่" : status;
  if (s === "ออเดอร์ใหม่" || s === "ร้านรับออเดอร์" || s === "accepted") return 0;
  if (s === "กำลังทำ" || s === "cooking") return 1;
  if (
    s === "ส่งให้ไรเดอร์" ||
    s === "จัดส่ง" ||
    s === "กำลังจัดส่ง" ||
    s === "delivering" ||
    s === "ready_for_delivery" ||
    s === "out_for_delivery" ||
    s === "picked_up"
  )
    return 2;
  if (s === "เสร็จสิ้น" || s === "completed") return 3;
  return 0;
};

// กำลังจัดส่งอยู่หรือไม่ (สำหรับแสดงไรเดอร์ + แชท)
const isDelivering = (status) =>
  [
    "ส่งให้ไรเดอร์",
    "จัดส่ง",
    "กำลังจัดส่ง",
    "delivering",
    "ready_for_delivery",
    "out_for_delivery",
    "picked_up",
  ].includes(status);

function TrackOrder() {
  const [phone, setPhone] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState(null);
  const [storeLocation, setStoreLocation] = useState(null);
  const prevStatus = useRef({});

  useEffect(() => {
    getDoc(doc(db, "stores", STORE_ID)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.lat != null && data.lng != null) {
          setStoreLocation({ lat: data.lat, lng: data.lng, name: data.storeName || "ร้าน" });
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!searchPhone) {
      setOrders([]);
      return;
    }
    const q = query(
      collection(db, "orders"),
      where("phone", "==", searchPhone)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // แจ้งเตือนเมื่อสถานะเปลี่ยน (realtime)
      data.forEach((o) => {
        const prev = prevStatus.current[o.id];
        if (prev && prev !== o.status) {
          setToast(`ออเดอร์ ${o.orderNo || ""} : ${o.status}`);
          setTimeout(() => setToast(null), 4000);
        }
        prevStatus.current[o.id] = o.status;
      });

      data.sort((a, b) => {
        const ta = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
      setOrders(data);
    });
    return () => unsubscribe();
  }, [searchPhone]);

  const handleTrack = () => setSearchPhone(phone.trim());

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
        <h1 style={{ margin: 0, fontSize: "22px" }}>🚚 ติดตามออเดอร์</h1>
        {toast && (
          <div
            style={{
              position: "fixed",
              top: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5000,
              background: "#ff8c00",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: "12px",
              fontWeight: "bold",
              boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            }}
          >
            🔔 {toast}
          </div>
        )}
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
            🍗 กลับหน้าสั่งอาหาร
          </button>
        </Link>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <input
          type="tel"
          placeholder="กรอกเบอร์โทรของคุณ"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTrack()}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
            fontSize: "15px",
          }}
        />
        <button
          onClick={handleTrack}
          style={{
            padding: "12px 20px",
            borderRadius: "10px",
            border: "none",
            background: "#ff8c00",
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ติดตามออเดอร์
        </button>
      </div>

      {searchPhone && orders.length === 0 && (
        <p style={{ color: "#888" }}>ไม่พบออเดอร์ของเบอร์ {searchPhone}</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#888" }}>
                {order.orderNo}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  background: statusColor(order.status),
                  color: "#000",
                  fontWeight: "bold",
                }}
              >
                {statusLabel(order.status)}
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#999", marginBottom: "6px" }}>
              🕒 {formatDate(order.createdAt)}
            </div>

            {order.payment?.status && (
              <div style={{ marginBottom: "10px" }}>
                <PaymentStatusBadge status={order.payment.status} />
              </div>
            )}

            {/* progress bar */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                marginBottom: "12px",
              }}
            >
              {STEPS.map((step, i) => (
                <div
                  key={step}
                  style={{
                    flex: 1,
                    height: "6px",
                    borderRadius: "3px",
                    background:
                      i <= statusToStep(order.status) ? "#ff8c00" : "#444",
                  }}
                />
              ))}
            </div>

            {/* ขั้นตอนสถานะ (อ่านอย่างเดียว) */}
            <div style={{ marginBottom: "12px" }}>
              {STEPS.map((step, i) => {
                const active = i <= statusToStep(order.status);
                const current = i === statusToStep(order.status);
                return (
                  <div
                    key={step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "14px",
                      color: active ? "#fff" : "#666",
                      fontWeight: current ? "bold" : "normal",
                      marginBottom: "2px",
                    }}
                  >
                    <span>{active ? "✅" : "⬜"}</span>
                    <span>
                      {i + 1}. {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* เวลาทำอาหาร */}
            {(order.status === "กำลังทำ" || order.status === "cooking") &&
              order.estimatedFinishTime && (
              <div
                style={{
                  background: "#161616",
                  borderRadius: "10px",
                  padding: "10px",
                  marginBottom: "8px",
                  color: "#ffb74d",
                }}
              >
                👨‍🍳 กำลังทำอาหาร — คาดว่าจะเสร็จเวลา{" "}
                {(order.estimatedFinishTime.toDate
                  ? order.estimatedFinishTime.toDate()
                  : new Date(order.estimatedFinishTime)
                ).toLocaleTimeString("th-TH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" น."}
              </div>
            )}

            {/* ที่อยู่จัดส่ง */}
            {order.orderType === "delivery" && (
              <div style={{ fontSize: "14px", marginBottom: "8px" }}>
                🏠 {order.deliveryAddress || order.address || "-"}
              </div>
            )}

            {order.items?.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: "10px",
                  borderTop: "1px dashed #444",
                  paddingTop: "8px",
                  marginTop: "8px",
                }}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{
                      width: "48px",
                      height: "48px",
                      objectFit: "cover",
                      borderRadius: "8px",
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold" }}>🍗 {item.name}</div>
                  {optionLabel(item.top_chicken) && (
                    <div style={{ fontSize: "12px" }}>
                      🍖 {optionLabel(item.top_chicken)}
                    </div>
                  )}
                  {optionLabel(item.spicy) && (
                    <div style={{ fontSize: "12px" }}>
                      🌶️ {optionLabel(item.spicy)}
                    </div>
                  )}
                  {optionLabel(item.sauce) && (
                    <div style={{ fontSize: "12px" }}>
                      🥫 {optionLabel(item.sauce)}
                    </div>
                  )}
                  {optionLabel(item.powder) && (
                    <div style={{ fontSize: "12px" }}>
                      🧂 {optionLabel(item.powder)}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#bbb" }}>
                    จำนวน {item.qty || 1} × {item.price} บาท
                  </div>
                </div>
              </div>
            ))}

            {order.orderType === "delivery" && (
              <p style={{ margin: "10px 0 0", fontSize: "14px" }}>
                🛵 ค่าส่ง: {order.deliveryFee || 0} บาท
              </p>
            )}

            <h3 style={{ color: "#ff8c00", marginTop: "10px", marginBottom: "10px" }}>
              💰 รวมทั้งหมด {order.grandTotal} บาท
            </h3>

            {/* แจ้งเตือนการยกเลิก */}
            <p style={{ fontSize: "12px", color: "#ffb74d", margin: "0 0 8px" }}>
              หากต้องการยกเลิกออเดอร์ กรุณาโทรติดต่อร้าน
            </p>

            {/* เบอร์โทรร้าน (แสดงตลอด) */}
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
                📞 โทรหาร้าน ({STORE_PHONE})
              </button>
            </a>

            {/* เบอร์ไรเดอร์ + แชท เฉพาะตอนกำลังจัดส่ง */}
            {isDelivering(order.status) && (
              <>
                {order.riderName && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "14px",
                      color: "#4fc3f7",
                    }}
                  >
                    🛵 ไรเดอร์: {order.riderName}
                  </div>
                )}
                {order.riderPhone && (
                  <a href={`tel:${order.riderPhone}`}>
                    <button
                      style={{
                        width: "100%",
                        padding: "10px",
                        marginTop: "8px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#4fc3f7",
                        color: "#000",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      🛵 โทรหาไรเดอร์ ({order.riderPhone})
                    </button>
                  </a>
                )}

                {/* ติดตามไรเดอร์ realtime: แผนที่ + เส้นทาง + ระยะทาง/เวลาที่เหลือ */}
                <TrackingPanel
                  storeLocation={storeLocation}
                  customerLocation={{
                    lat: order.deliveryLocation?.lat ?? order.lat ?? order.latitude,
                    lng: order.deliveryLocation?.lng ?? order.lng ?? order.longitude,
                    address: order.deliveryAddress || order.address,
                  }}
                  riderLocation={
                    order.riderLocation
                      ? { lat: order.riderLocation.lat, lng: order.riderLocation.lng }
                      : order.riderLat != null && order.riderLng != null
                      ? { lat: order.riderLat, lng: order.riderLng }
                      : null
                  }
                  estimatedArrival={order.riderLocation?.estimatedArrival}
                  remainingDistance={order.riderLocation?.remainingDistance}
                />

                <Chat orderId={order.id} sender="customer" />
              </>
            )}

            {/* ให้คะแนนเมื่อเสร็จสิ้น */}
            {order.status === "เสร็จสิ้น" && <ReviewForm order={order} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrackOrder;
