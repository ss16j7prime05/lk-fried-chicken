import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

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
  maxWidth: "380px",
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

export default function SignupRider() {
  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    vehicleType: "motorcycle",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const handleSignup = async () => {
    setError("");
    if (!f.email.trim() || !f.password.trim() || !f.name.trim()) {
      setError("กรุณากรอกชื่อ อีเมล และรหัสผ่าน");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        f.email.trim(),
        f.password
      );
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        role: "rider",
        status: "pending",
        name: f.name.trim(),
        riderName: f.name.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        vehicleType: f.vehicleType,
        riderStatus: "offline",
        createdAt: serverTimestamp(),
      });
      navigate("/rider", { replace: true });
    } catch (err) {
      console.error(err);
      setError("สมัครไม่สำเร็จ: " + (err.code || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>🛵 สมัครไรเดอร์</h2>
        <input placeholder="ชื่อ" value={f.name} onChange={set("name")} style={input} />
        <input placeholder="เบอร์โทร" value={f.phone} onChange={set("phone")} style={input} />
        <input type="email" placeholder="อีเมล" value={f.email} onChange={set("email")} style={input} />
        <input type="password" placeholder="รหัสผ่าน" value={f.password} onChange={set("password")} style={input} />
        <select value={f.vehicleType} onChange={set("vehicleType")} style={input}>
          <option value="motorcycle">มอเตอร์ไซค์</option>
          <option value="car">รถยนต์</option>
        </select>
        {error && <div style={{ color: "#e53935", marginBottom: "10px" }}>{error}</div>}
        <button onClick={handleSignup} disabled={loading} style={button}>
          {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
          มีบัญชีแล้ว? <Link to="/login/rider" style={{ color: "#ff8c00" }}>เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
