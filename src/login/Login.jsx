import { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

// เส้นทางหลังเข้าสู่ระบบสำเร็จของแต่ละ role
const ROLE_HOME = {
  customer: "/customer",
  store: "/store",
  rider: "/rider",
  admin: "/admin",
};

const ROLES = [
  { value: "customer", label: "👤 ลูกค้า" },
  { value: "store", label: "🏪 ร้านค้า" },
  { value: "rider", label: "🛵 ไรเดอร์" },
  { value: "admin", label: "🛠️ แอดมิน" },
];

// หน้า login เดียวของระบบ: เลือก role -> เข้าสู่ระบบด้วย email/password
// -> อ่าน role จริงจาก Firestore users/{uid} -> ถ้าตรงกับ role ที่เลือก redirect ไปหน้านั้น
// -> ถ้าไม่ตรง แสดง "Permission denied" และออกจากระบบทันที (ป้องกันเข้าหน้าอื่นผิด role)
export default function Login() {
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const actualRole = snap.exists() ? snap.data().role : null;

      if (actualRole !== role) {
        await signOut(auth);
        setError("Permission denied");
        return;
      }

      navigate(ROLE_HOME[role] || "/", { replace: true });
    } catch (err) {
      console.error(err);
      setError("เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมล/รหัสผ่าน");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>🔐 เข้าสู่ระบบ</h2>

        {/* เลือก role ก่อนเข้าสู่ระบบ */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              style={{
                flex: "1 1 auto",
                padding: "8px 10px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "bold",
                background: role === r.value ? "#ff8c00" : "#2a2a2a",
                color: "#fff",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <input
          type="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
          <Link to="/forgot-password" style={{ color: "#ff8c00" }}>ลืมรหัสผ่าน?</Link>
        </div>
        <div style={{ textAlign: "center", marginTop: "8px", fontSize: "14px" }}>
          ยังไม่มีบัญชี? <Link to="/register" style={{ color: "#ff8c00" }}>สมัครสมาชิก</Link>
        </div>
      </div>
    </div>
  );
}
