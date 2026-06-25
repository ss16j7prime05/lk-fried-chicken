import { useState } from "react";
import { NEXT_ACTION, STATUS_COLOR, STATUS_LABEL } from "./orderStatus";
import DeliveryMap from "../location/DeliveryMap.jsx";
import MapButton from "../location/MapButton.jsx";
import PaymentStatusBadge from "../payment/PaymentStatusBadge.jsx";
import { PAYMENT_STATUS } from "../payment/paymentUtils";
import TrackingPanel from "../tracking/TrackingPanel.jsx";

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
  minWidth: "120px",
  padding: "10px",
  borderRadius: "10px",
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

// การ์ดออเดอร์เดียว ใช้ใน Store Dashboard ใหม่ (รับ order + status ปัจจุบัน + callback)
export default function OrderCard({ order, status, onAdvance, onCancel, onVerifyPayment, storeLocation }) {
  const nextAction = NEXT_ACTION[status];
  const [showMap, setShowMap] = useState(false);
  const dLat = order.deliveryLocation?.lat ?? order.lat ?? order.latitude;
  const dLng = order.deliveryLocation?.lng ?? order.lng ?? order.longitude;
  const dAddress = order.deliveryLocation?.address || order.deliveryAddress;

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
            color: STATUS_COLOR[status] || "#ffb74d",
            whiteSpace: "nowrap",
          }}
        >
          {STATUS_LABEL[status] || status}
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
      <p style={{ margin: "4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
        💳 ชำระเงิน: {order.paymentMethod || "-"}
        <PaymentStatusBadge status={order.payment?.status} />
      </p>

      {order.payment?.slipUrl && (
        <div style={{ margin: "8px 0" }}>
          <div style={{ fontSize: "12px", color: "#999", marginBottom: "4px" }}>
            📸 สลิปการโอน
          </div>
          <a href={order.payment.slipUrl} target="_blank" rel="noreferrer">
            <img
              src={order.payment.slipUrl}
              alt="สลิป"
              style={{ width: "100px", borderRadius: "10px" }}
            />
          </a>
          {order.payment.status === PAYMENT_STATUS.PENDING_VERIFICATION && (
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={() => onVerifyPayment(order.id, true)}
                style={{ ...actionBtn, background: "#22c55e", flex: 1 }}
              >
                ✅ อนุมัติการชำระเงิน
              </button>
              <button
                onClick={() => onVerifyPayment(order.id, false)}
                style={{ ...actionBtn, background: "#e53935", flex: 1 }}
              >
                ❌ ปฏิเสธสลิป
              </button>
            </div>
          )}
        </div>
      )}

      {dLat != null && dLng != null && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "6px 0" }}>
          <MapButton lat={dLat} lng={dLng} mode="view" style={{ padding: "6px 12px", fontSize: "13px" }} />
          <button
            onClick={() => setShowMap((v) => !v)}
            style={{
              padding: "6px 12px",
              borderRadius: "10px",
              border: "none",
              background: "#2a2a2a",
              color: "#fff",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {showMap ? "ซ่อนแผนที่" : "🗺️ ดูแผนที่"}
          </button>
        </div>
      )}
      {showMap && (
        <div style={{ marginBottom: "8px" }}>
          <DeliveryMap lat={dLat} lng={dLng} address={dAddress} height="180px" />
        </div>
      )}

      {order.riderPhone && (
        <a href={`tel:${order.riderPhone}`} style={{ display: "block", marginBottom: "8px" }}>
          <button
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "10px",
              border: "none",
              background: "#22c55e",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            📞 โทรหาไรเดอร์ ({order.riderPhone})
          </button>
        </a>
      )}

      <TrackingPanel
        storeLocation={storeLocation}
        customerLocation={dLat != null && dLng != null ? { lat: dLat, lng: dLng, address: dAddress } : null}
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

      <div style={{ marginTop: "10px" }}>
        {(order.items || []).map((item, index) => (
          <div
            key={index}
            style={{
              borderTop: "1px dashed #444",
              paddingTop: "8px",
              marginTop: "8px",
            }}
          >
            <div style={{ fontWeight: "bold" }}>🍗 {item.name}</div>
            {optionLabel(item.top_chicken) && (
              <div style={{ fontSize: "13px" }}>🍖 {optionLabel(item.top_chicken)}</div>
            )}
            {optionLabel(item.spicy) && (
              <div style={{ fontSize: "13px" }}>🌶️ {optionLabel(item.spicy)}</div>
            )}
            {optionLabel(item.sauce) && (
              <div style={{ fontSize: "13px" }}>🥫 {optionLabel(item.sauce)}</div>
            )}
            {optionLabel(item.powder) && (
              <div style={{ fontSize: "13px" }}>🧂 {optionLabel(item.powder)}</div>
            )}
            <div style={{ fontSize: "13px", color: "#bbb" }}>
              จำนวน {item.qty || 1} × {item.price} บาท
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ color: "#ff9800", marginTop: "14px", marginBottom: "12px" }}>
        💰 รวมทั้งหมด {order.grandTotal ?? order.subtotal ?? 0} บาท
      </h3>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {nextAction && (
          <button
            onClick={() => onAdvance(order.id, nextAction.to)}
            style={{ ...actionBtn, background: nextAction.color }}
          >
            {nextAction.label}
          </button>
        )}
        {status !== "completed" && (
          <button
            onClick={() => onCancel(order.id)}
            style={{ ...actionBtn, background: "#e53935" }}
          >
            {status === "pending" ? "❌ ปฏิเสธออเดอร์ (Reject)" : "❌ ยกเลิกออเดอร์ (Cancel)"}
          </button>
        )}
      </div>
    </div>
  );
}
