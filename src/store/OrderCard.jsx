import { NEXT_ACTION, STATUS_COLOR, STATUS_LABEL } from "./orderStatus";

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
export default function OrderCard({ order, status, onAdvance, onCancel }) {
  const nextAction = NEXT_ACTION[status];

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
            ❌ ยกเลิกออเดอร์
          </button>
        )}
      </div>
    </div>
  );
}
