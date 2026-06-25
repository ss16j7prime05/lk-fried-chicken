import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// ป้องกัน route ตาม role ถ้ายังไม่ login -> ไปหน้า login ของระบบนั้น
// ป้องกันเพิ่มเติม: store/rider ที่ status ยังไม่ approved (หรือ customer ที่ status ไม่ active)
// จะเข้าหน้านี้ไม่ได้แม้ session ยังอยู่ - กันไว้อีกชั้นนอกจากที่ Login.jsx เช็กไปแล้ว
export default function ProtectedRoute({ role, loginPath, children }) {
  const { user, role: userRole, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ color: "#fff", background: "#121212", minHeight: "100vh", padding: "20px" }}>
        กำลังโหลด...
      </div>
    );
  }

  if (!user) return <Navigate to={loginPath} replace />;
  if (role && userRole !== role) return <Navigate to={loginPath} replace />;

  const status = profile?.status;
  const needsApproval = role === "store" || role === "rider";
  const needsActive = role === "customer";
  const blocked =
    (needsApproval && status && status !== "approved") ||
    (needsActive && status && status !== "active");

  if (blocked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#121212",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          textAlign: "center",
          fontFamily: "sans-serif",
        }}
      >
        <h2>Your account has not been approved yet.</h2>
        <button
          onClick={logout}
          style={{
            marginTop: "16px",
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: "#ff8c00",
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    );
  }

  return children;
}
