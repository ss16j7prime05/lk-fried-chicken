import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// ป้องกัน route ตาม role ถ้ายังไม่ login -> ไปหน้า login ของระบบนั้น
export default function ProtectedRoute({ role, loginPath, children }) {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ color: "#fff", background: "#121212", minHeight: "100vh", padding: "20px" }}>
        กำลังโหลด...
      </div>
    );
  }

  if (!user) return <Navigate to={loginPath} replace />;
  if (role && userRole !== role) return <Navigate to={loginPath} replace />;

  return children;
}
