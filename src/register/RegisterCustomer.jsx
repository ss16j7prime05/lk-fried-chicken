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

// สมัครสมาชิกลูกค้า: role=customer, status=active -> เข้าใช้งานได้ทันทีหลังสมัคร
export default function RegisterCustomer() {
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const handleRegister = async () => {
    setError("");
    if (!f.firstName.trim() || !f.lastName.trim() || !f.phone.trim() || !f.email.trim() || !f.password.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (f.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (f.password !== f.confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        role: "customer",
        status: "active",
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        name: `${f.firstName.trim()} ${f.lastName.trim()}`,
        phone: f.phone.trim(),
        email: f.email.trim(),
        createdAt: serverTimestamp(),
      });
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") setError("อีเมลนี้ถูกใช้สมัครแล้ว");
      else if (err.code === "auth/invalid-email") setError("รูปแบบอีเมลไม่ถูกต้อง");
      else setError("สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>👤 สมัครสมาชิกลูกค้า</h2>
        <input placeholder="ชื่อ" value={f.firstName} onChange={set("firstName")} style={input} />
        <input placeholder="นามสกุล" value={f.lastName} onChange={set("lastName")} style={input} />
        <input type="tel" placeholder="เบอร์โทร" value={f.phone} onChange={set("phone")} style={input} />
        <input type="email" placeholder="อีเมล" value={f.email} onChange={set("email")} style={input} />
        <input type="password" placeholder="รหัสผ่าน" value={f.password} onChange={set("password")} style={input} />
        <input
          type="password"
          placeholder="ยืนยันรหัสผ่าน"
          value={f.confirmPassword}
          onChange={set("confirmPassword")}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          style={input}
        />
        {error && <div style={{ color: "#e53935", marginBottom: "10px", fontSize: "14px" }}>{error}</div>}
        <button onClick={handleRegister} disabled={loading} style={button}>
          {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
          มีบัญชีแล้ว? <Link to="/login" style={{ color: "#ff8c00" }}>เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
