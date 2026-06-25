import { PROMPTPAY_ACCOUNT_NAME, PROMPTPAY_ID } from "../config";

// QR PromptPay จริง (มาตรฐาน EMV) ผ่านบริการสาธารณะ promptpay.io - ไม่ต้องเพิ่ม dependency
// แสดงชื่อบัญชี + เลข PromptPay คู่กับ QR
export default function PromptPayQR({ amount }) {
  const amountParam = amount > 0 ? `/${amount.toFixed(2)}` : "";
  const qrUrl = `https://promptpay.io/${PROMPTPAY_ID}${amountParam}.png`;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: "6px" }}>สแกนเพื่อชำระเงินผ่าน PromptPay</div>
      <img
        src={qrUrl}
        alt="PromptPay QR"
        style={{
          width: "200px",
          maxWidth: "100%",
          borderRadius: "12px",
          background: "#fff",
          padding: "8px",
        }}
      />
      <div style={{ marginTop: "8px", fontSize: "14px" }}>
        ชื่อบัญชี: {PROMPTPAY_ACCOUNT_NAME}
      </div>
      <div style={{ fontSize: "14px" }}>เบอร์พร้อมเพย์: {PROMPTPAY_ID}</div>
      {amount > 0 && (
        <div style={{ fontSize: "14px", color: "#ff9800", fontWeight: "bold" }}>
          ยอดชำระ: {amount.toFixed(2)} บาท
        </div>
      )}
    </div>
  );
}
