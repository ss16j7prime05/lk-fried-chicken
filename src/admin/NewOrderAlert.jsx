import { useEffect, useRef, useState } from "react";

// เสียงแจ้งเตือนสั้น ๆ ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง)
const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.warn(e);
  }
};

// แจ้งเตือนเมื่อมีออเดอร์ใหม่เข้ามา (popup + เสียง) รับ orders ทั้งหมดแบบ realtime มาเฝ้าดู
export default function NewOrderAlert({ orders }) {
  const [popup, setPopup] = useState(null);
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    const currentIds = new Set(orders.map((o) => o.id));
    if (!initialized.current) {
      knownIds.current = currentIds;
      initialized.current = true;
      return;
    }
    for (const order of orders) {
      if (!knownIds.current.has(order.id)) {
        knownIds.current.add(order.id);
        setPopup({
          name: order.customerName,
          phone: order.phone,
          total: order.grandTotal,
        });
        beep();
      }
    }
    knownIds.current = currentIds;
  }, [orders]);

  if (!popup) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 5000,
        background: "#fff",
        color: "#222",
        borderRadius: "16px",
        padding: "16px 20px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        minWidth: "240px",
      }}
    >
      <div style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "8px" }}>
        🔔 ออเดอร์ใหม่
      </div>
      <div>ชื่อ : {popup.name}</div>
      <div>เบอร์ : {popup.phone}</div>
      <div>ยอด : {popup.total} บาท</div>
      <button
        onClick={() => setPopup(null)}
        style={{
          marginTop: "10px",
          width: "100%",
          padding: "8px",
          borderRadius: "10px",
          border: "none",
          background: "#ff8c00",
          color: "#fff",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        ปิด
      </button>
    </div>
  );
}
