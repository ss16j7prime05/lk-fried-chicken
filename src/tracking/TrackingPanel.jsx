import { useState } from "react";
import LiveMap from "./LiveMap.jsx";
import ETABox from "./ETABox.jsx";

// แผงติดตามไรเดอร์แบบ realtime (toggle เปิด/ปิด) ใช้ร่วมกันทั้งฝั่ง Customer และ Store
// ต้องมี riderLocation (ไรเดอร์เริ่มเดินทางแล้ว) ถึงจะแสดงปุ่มติดตาม
export default function TrackingPanel({
  storeLocation,
  customerLocation,
  riderLocation,
  estimatedArrival,
  remainingDistance,
  height = "220px",
}) {
  const [show, setShow] = useState(false);

  if (!riderLocation?.lat || !riderLocation?.lng) return null;

  return (
    <div style={{ marginTop: "10px" }}>
      <button
        onClick={() => setShow((v) => !v)}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "10px",
          border: "none",
          background: "#4fc3f7",
          color: "#000",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        {show ? "ซ่อนแผนที่ติดตาม" : "🛵 ติดตามไรเดอร์ (Track Rider)"}
      </button>
      {show && (
        <div style={{ marginTop: "8px" }}>
          <LiveMap
            storeLocation={storeLocation}
            customerLocation={customerLocation}
            riderLocation={riderLocation}
            height={height}
          />
          <ETABox remainingDistance={remainingDistance} estimatedArrival={estimatedArrival} />
        </div>
      )}
    </div>
  );
}
