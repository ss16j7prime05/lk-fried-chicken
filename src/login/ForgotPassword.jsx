import { useState } from "react";
import { auth } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";

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

// ส่งอีเมลรีเซ็ตรหัสผ่านผ่าน Firebase Auth
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("กรุณากรอกอีเมล");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("ไม่พบบัญชีที่ใช้อีเมลนี้");
      } else if (err.code === "auth/invalid-email") {
        setError("รูปแบบอีเมลไม่ถูกต้อง");
      } else {
        setError("ส่งคำขอไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>🔑 ลืมรหัสผ่าน</h2>
        <input
          type="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReset()}
          style={input}
        />
        {error && (
          <div style={{ color: "#e53935", marginBottom: "10px", fontSize: "14px" }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ color: "#4caf50", marginBottom: "10px", fontSize: "14px" }}>
            {message}
          </div>
        )}
        <button onClick={handleReset} disabled={loading} style={button}>
          {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
        </button>
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
          <Link to="/login" style={{ color: "#ff8c00" }}>กลับไปเข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
