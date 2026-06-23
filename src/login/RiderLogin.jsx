import { useState } from "react";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
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

// แปลงเบอร์เป็น email ภายในสำหรับ Firebase Auth
const phoneToEmail = (phone) => `${phone.replace(/\D/g, "")}@rider.lk`;

export default function RiderLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    if (!phone.trim() || !password.trim()) {
      setError("กรุณากรอกเบอร์และรหัสผ่าน");
      return;
    }
    setLoading(true);
    const email = phoneToEmail(phone);
    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        // ยังไม่มีบัญชี -> สมัครใหม่อัตโนมัติ
        if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/invalid-credential"
        ) {
          cred = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw err;
        }
      }
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          role: "rider",
          phone: phone.trim(),
          riderName: name.trim() || "ไรเดอร์",
        },
        { merge: true }
      );
      navigate("/rider", { replace: true });
    } catch (err) {
      console.error(err);
      setError("เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>🛵 ไรเดอร์ เข้าสู่ระบบ</h2>
        <input
          type="text"
          placeholder="ชื่อไรเดอร์"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
        />
        <input
          type="tel"
          placeholder="เบอร์โทร"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={input}
        />
        <input
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          style={input}
        />
        {error && (
          <div style={{ color: "#e53935", marginBottom: "10px", fontSize: "14px" }}>
            {error}
          </div>
        )}
        <button onClick={handleLogin} disabled={loading} style={button}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </div>
    </div>
  );
}
