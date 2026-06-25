import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const messageScreen = {
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
};
const backBtn = {
  marginTop: "16px",
  padding: "10px 20px",
  borderRadius: "10px",
  border: "none",
  background: "#ff8c00",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

function ErrorScreen({ message, onBack }) {
  return (
    <div style={messageScreen}>
      <h2>{message}</h2>
      <button onClick={onBack} style={backBtn}>
        กลับไปหน้าเข้าสู่ระบบ
      </button>
    </div>
  );
}

// ป้องกัน route ตาม role ถ้ายังไม่ login -> ไปหน้า login ของระบบนั้น (ไม่มี error ต้องแสดง แค่ยังไม่ได้ login)
// กรณีอื่นทั้งหมด (role ไม่ตรง / ไม่มี role / ยังไม่ approved) ต้องแสดงข้อความที่ชัดเจนเสมอ ห้าม redirect แบบไม่มีเหตุผล
export default function ProtectedRoute({ role, loginPath, children }) {
  const { user, role: userRole, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={{ color: "#fff", background: "#121212", minHeight: "100vh", padding: "20px" }}>
        กำลังโหลด...
      </div>
    );
  }

  // ไม่มี session เลย -> ไม่ใช่ error อะไร แค่ยังไม่ login ส่งไปหน้า login ตามปกติ
  if (!user) return <Navigate to={loginPath} replace />;

  // มี session แต่ไม่มี Firestore document เลย (ไม่เจอ users/{uid})
  if (!profile) {
    return <ErrorScreen message="User profile not found." onBack={logout} />;
  }

  // มี document แต่ไม่มีฟิลด์ role
  if (!userRole) {
    return <ErrorScreen message="Missing role. Please contact support." onBack={logout} />;
  }

  // role ไม่ตรงกับ route นี้
  if (role && userRole !== role) {
    return <ErrorScreen message="Permission denied." onBack={logout} />;
  }

  const status = profile?.status;
  const needsApproval = role === "store" || role === "rider";
  const needsActive = role === "customer" || role === "admin";
  // ไม่มีฟิลด์ status เลย = บัญชีเก่าก่อนมีระบบอนุมัติ ถือว่าอนุมัติแล้ว (ไม่ล็อกผู้ใช้เดิม)
  const blocked =
    (needsApproval && status && status !== "approved") ||
    (needsActive && status && status !== "active");

  if (blocked) {
    return (
      <ErrorScreen
        message={
          needsApproval ? "Your account has not been approved yet." : "Account not approved."
        }
        onBack={logout}
      />
    );
  }

  return children;
}
