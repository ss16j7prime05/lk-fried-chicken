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
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // ใช้ auth.currentUser.uid เสมอ (ไม่ใช่ cred.user หรือ id ที่ hardcode) เพื่ออ้างอิง users/{uid} ที่ถูกต้องแน่นอน
      const uid = auth.currentUser.uid;

      // ---- Admin: เส้นทางตรวจสอบเฉพาะ (ไม่ใช้ logic ร่วมกับ customer/store/rider ด้านล่าง) ----
      if (role === "admin") {
        const snap = await getDoc(doc(db, "users", uid));
        if (!snap.exists()) {
          console.log({ uid, role: null, status: null });
          await signOut(auth);
          setError("User profile not found.");
          return;
        }
        const data = snap.data();
        console.log("uid:", uid, "role:", data.role, "status:", data.status);

        if (data.role !== "admin") {
          await signOut(auth);
          setError("You are not an admin.");
          return;
        }
        if (data.status !== "active") {
          await signOut(auth);
          setError("Account not approved.");
          return;
        }
        navigate("/admin");
        return;
      }

      // ---- Customer / Store / Rider: logic เดิม ไม่เปลี่ยนแปลง ----
      const snap = await getDoc(doc(db, "users", uid));
      const data = snap.exists() ? snap.data() : null;
      const actualRole = data?.role ?? null;

      if (actualRole !== role) {
        await signOut(auth);
        setError("Permission denied");
        return;
      }

      // ตรวจสถานะการอนุมัติ: customer ต้อง active, store/rider ต้อง approved
      // (ไม่มีฟิลด์ status เลย = บัญชีเก่าก่อนมีระบบอนุมัติ ถือว่าอนุมัติแล้ว ไม่ล็อกผู้ใช้เดิม)
      const status = data?.status;
      if (role === "customer" && status && status !== "active") {
        await signOut(auth);
        setError("Your account has not been approved yet.");
        return;
      }
      if ((role === "store" || role === "rider") && status && status !== "approved") {
        await signOut(auth);
        setError("Your account has not been approved yet.");
        return;
      }

      navigate(ROLE_HOME[role] || "/", { replace: true });
    } catch (err) {
      console.error(err);
      // แสดง error code จริงจาก Firebase เสมอ (ไม่ใช่แค่ข้อความทั่วไป) เพื่อ debug ปัญหาที่เกิดเฉพาะบางเครื่อง/บางเบราว์เซอร์ได้
      setError(`เข้าสู่ระบบไม่สำเร็จ: ${err.code || err.message || "unknown error"}`);
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
