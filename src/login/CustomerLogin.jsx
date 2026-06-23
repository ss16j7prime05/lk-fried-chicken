import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const wrap = {
  minHeight: "100vh",
  background: "#121212",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  fontFamily: "sans-serif",
};
const card = {
  background: "#1e1e1e",
  borderRadius: "20px",
  padding: "24px",
  width: "100%",
  maxWidth: "360px",
  boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
};
const input = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "10px",
  border: "none",
  background: "#2a2a2a",
  color: "#fff",
  boxSizing: "border-box",
};
const button = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  background: "#ff8c00",
  color: "#fff",
  fontWeight: "bold",
  fontSize: "16px",
  cursor: "pointer",
};

// 0xxxxxxxxx -> +66xxxxxxxxx
const toE164 = (phone) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+66" + digits.slice(1);
  if (digits.startsWith("66")) return "+" + digits;
  return "+" + digits;
};

export default function CustomerLogin() {
  const [phone, setPhone] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
  }, []);

  const sendOtp = async () => {
    setError("");
    if (!phone.trim()) {
      setError("กรุณากรอกเบอร์โทร");
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithPhoneNumber(
        auth,
        toE164(phone),
        window.recaptchaVerifier
      );
      setConfirmation(result);
    } catch (err) {
      console.error(err);
      setError("ส่ง OTP ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    if (!confirmation) return;
    setLoading(true);
    try {
      const cred = await confirmation.confirm(otp.trim());
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          role: "customer",
          phone: phone.trim(),
          ...(lineUserId.trim() ? { lineUserId: lineUserId.trim() } : {}),
        },
        { merge: true }
      );
      navigate("/track", { replace: true });
    } catch (err) {
      console.error(err);
      setError("OTP ไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>👤 ลูกค้า เข้าสู่ระบบ</h2>

        {!confirmation ? (
          <>
            <input
              type="tel"
              placeholder="เบอร์โทร (เช่น 0812345678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={input}
            />
            <input
              type="text"
              placeholder="LINE User ID (ถ้ามี — รับแจ้งเตือนผ่าน LINE)"
              value={lineUserId}
              onChange={(e) => setLineUserId(e.target.value)}
              style={input}
            />
            <button onClick={sendOtp} disabled={loading} style={button}>
              {loading ? "กำลังส่ง..." : "ส่งรหัส OTP"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="กรอกรหัส OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              style={input}
            />
            <button onClick={verifyOtp} disabled={loading} style={button}>
              {loading ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}
            </button>
          </>
        )}

        {error && (
          <div style={{ color: "#e53935", marginTop: "10px", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <div id="recaptcha-container" ref={recaptchaRef} />
      </div>
    </div>
  );
}
