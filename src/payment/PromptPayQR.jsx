import { PROMPTPAY_ACCOUNT_NAME, PROMPTPAY_ID } from "../config";

// QR PromptPay จริง (มาตรฐาน EMV) ผ่านบริการสาธารณะ promptpay.io - ไม่ต้องเพิ่ม dependency
// แสดงชื่อบัญชี + เลข PromptPay คู่กับ QR
// promptpayId/accountName override the config defaults so callers can pass the
// store's live paymentSettings values (single source of truth).
export default function PromptPayQR({ amount, promptpayId, accountName }) {
  const id = String(promptpayId || PROMPTPAY_ID).replace(/\D/g, "");
  const name = accountName || PROMPTPAY_ACCOUNT_NAME;
  const amountParam = amount > 0 ? `/${amount.toFixed(2)}` : "";
  const qrUrl = `https://promptpay.io/${id}${amountParam}.png`;

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
        ชื่อบัญชี: {name}
      </div>
      <div style={{ fontSize: "14px" }}>เบอร์พร้อมเพย์: {id}</div>
      {amount > 0 && (
        <div style={{ fontSize: "14px", color: "#ff9800", fontWeight: "bold" }}>
          ยอดชำระ: {amount.toFixed(2)} บาท
        </div>
      )}
    </div>
  );
}
