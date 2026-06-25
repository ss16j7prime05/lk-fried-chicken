import { PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL } from "./paymentUtils";

// แสดงสถานะการชำระเงินแบบ badge เล็ก ๆ ใช้ร่วมกันทุกหน้า
export default function PaymentStatusBadge({ status }) {
  if (!status) return null;
  return (
    <span
      style={{
        fontSize: "12px",
        padding: "4px 10px",
        borderRadius: "12px",
        background: "#333",
        color: PAYMENT_STATUS_COLOR[status] || "#fff",
        whiteSpace: "nowrap",
      }}
    >
      💳 {PAYMENT_STATUS_LABEL[status] || status}
    </span>
  );
}
