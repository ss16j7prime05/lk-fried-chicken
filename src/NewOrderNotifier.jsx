import { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// เสียงแจ้งเตือนแบบสั้น ๆ ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง)
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

// ฟังออเดอร์ใหม่แบบ realtime แล้วแสดง popup + เสียง
export default function NewOrderNotifier() {
  const [popup, setPopup] = useState(null);
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "==", "ออเดอร์ใหม่")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (!initialized.current) {
            // โหลดครั้งแรก ไม่เด้ง popup
            knownIds.current.add(change.doc.id);
          } else if (!knownIds.current.has(change.doc.id)) {
            knownIds.current.add(change.doc.id);
            setPopup({
              name: data.customerName,
              phone: data.phone,
              total: data.grandTotal,
            });
            beep();
          }
        }
      });
      initialized.current = true;
    });
    return () => unsubscribe();
  }, []);

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
