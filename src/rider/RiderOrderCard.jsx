import { useEffect, useState } from "react";
import Chat from "../Chat.jsx";
import DeliveryMap from "../location/DeliveryMap.jsx";
import MapButton from "../location/MapButton.jsx";
import { getRoute, haversineKm } from "../location/locationUtils";
import {
  DELIVERING_STATUS,
  PICKED_UP_STATUS,
  READY_STATUS,
  STATUS_LABEL,
} from "./riderStatus";

const optionLabel = (value) => {
  if (!value) return "";
  if (typeof value === "object") return value.name || "";
  return value;
};

const formatDate = (createdAt) => {
  if (!createdAt) return "-";
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return d.toLocaleString("th-TH");
};

const actionBtn = {
  flex: 1,
  minWidth: "130px",
  padding: "10px",
  borderRadius: "10px",
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const linkBtn = {
  ...actionBtn,
  display: "block",
  textAlign: "center",
  textDecoration: "none",
};

// การ์ดออเดอร์เดียวสำหรับ Rider Dashboard: ข้อมูลลูกค้า + แผนที่/ระยะทาง/เวลา + ปุ่ม Maps/โทร/แชท + ปุ่มเปลี่ยนสถานะ
export default function RiderOrderCard({ order, effectiveStatus, storeLocation, onAccept, onStartDelivering, onDelivered }) {
  const [showMap, setShowMap] = useState(false);
  const [route, setRoute] = useState(null);

  const dLat = order.deliveryLocation?.lat ?? order.lat ?? order.latitude;
  const dLng = order.deliveryLocation?.lng ?? order.lng ?? order.longitude;
  const dAddress = order.deliveryLocation?.address || order.deliveryAddress || order.address;

  useEffect(() => {
    if (dLat == null || dLng == null || !storeLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getRoute(storeLocation.lat, storeLocation.lng, dLat, dLng);
        if (!cancelled) setRoute(r);
      } catch {
        const km = haversineKm(storeLocation.lat, storeLocation.lng, dLat, dLng);
        if (!cancelled) setRoute({ distanceKm: km, durationMin: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dLat, dLng, storeLocation]);

  return (
    <div
      style={{
        background: "#1e1e1e",
        borderRadius: "16px",
        padding: "16px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
          gap: "8px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "17px" }}>
          🧾 {order.orderNo || order.id}
        </h3>
        <span
          style={{
            fontSize: "12px",
            padding: "4px 10px",
            borderRadius: "12px",
            background: "#333",
            color: "#4fc3f7",
            whiteSpace: "nowrap",
          }}
        >
          {STATUS_LABEL[effectiveStatus] || effectiveStatus}
        </span>
      </div>

      <div style={{ fontSize: "12px", color: "#999", marginBottom: "8px" }}>
        🕒 {formatDate(order.createdAt)}
      </div>

      <p style={{ margin: "4px 0" }}>👤 {order.customerName || "-"}</p>
      <p style={{ margin: "4px 0" }}>📞 {order.phone || "-"}</p>
      <p style={{ margin: "4px 0" }}>
        🏠 {order.deliveryAddress || order.address || "-"}
      </p>
      <p style={{ margin: "4px 0" }}>
        💳 ชำระเงิน: {order.paymentMethod || "-"}
      </p>

      <div style={{ marginTop: "10px" }}>
        {(order.items || []).map((item, index) => (
          <div
            key={index}
            style={{
              borderTop: "1px dashed #444",
              paddingTop: "8px",
              marginTop: "8px",
              fontSize: "13px",
            }}
          >
            🍗 {item.name} ×{item.qty || 1}
            {optionLabel(item.top_chicken)
              ? ` (${optionLabel(item.top_chicken)})`
              : ""}
          </div>
        ))}
      </div>

      <h3 style={{ color: "#ff9800", marginTop: "14px", marginBottom: "12px" }}>
        💰 รวมทั้งหมด {order.grandTotal ?? order.subtotal ?? 0} บาท
      </h3>

      {/* ระยะทาง / เวลาเดินทางจากร้าน */}
      {route && (
        <div style={{ fontSize: "13px", color: "#999", marginBottom: "8px" }}>
          📏 ระยะทางจากร้าน: {route.distanceKm.toFixed(1)} กม.
          {route.durationMin != null && <> · ⏱️ ประมาณ {route.durationMin} นาที</>}
        </div>
      )}

      {/* ปุ่ม Google Maps Navigation / โทร / ดูแผนที่ */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <MapButton lat={dLat} lng={dLng} mode="navigate" style={{ flex: 1, minWidth: "130px" }} />
        <a href={`tel:${order.phone}`} style={{ ...linkBtn, background: "#22c55e" }}>
          📞 โทรลูกค้า
        </a>
      </div>
      {dLat != null && dLng != null && (
        <button
          onClick={() => setShowMap((v) => !v)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "8px",
            borderRadius: "10px",
            border: "none",
            background: "#2a2a2a",
            color: "#fff",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          {showMap ? "ซ่อนแผนที่" : "🗺️ ดูแผนที่ลูกค้า"}
        </button>
      )}
      {showMap && (
        <div style={{ marginBottom: "10px" }}>
          <DeliveryMap lat={dLat} lng={dLng} address={dAddress} storeLocation={storeLocation} height="180px" />
        </div>
      )}

      {/* ปุ่มเปลี่ยนสถานะ */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {effectiveStatus === READY_STATUS && (
          <button
            onClick={() => onAccept(order.id)}
            style={{ ...actionBtn, background: "#22c55e" }}
          >
            ✅ รับงานจัดส่ง (Accept Delivery)
          </button>
        )}
        {effectiveStatus === PICKED_UP_STATUS && (
          <button
            onClick={() => onStartDelivering(order.id)}
            style={{ ...actionBtn, background: "#ff9800" }}
          >
            🛵 ออกเดินทางส่ง (Picked Up)
          </button>
        )}
        {effectiveStatus === DELIVERING_STATUS && (
          <button
            onClick={() => onDelivered(order.id)}
            style={{ ...actionBtn, background: "#22c55e" }}
          >
            🎉 ส่งสำเร็จ (Delivered)
          </button>
        )}
      </div>

      {/* แชทกับลูกค้า เฉพาะงานที่รับแล้ว */}
      {effectiveStatus !== READY_STATUS && <Chat orderId={order.id} sender="rider" />}
    </div>
  );
}
