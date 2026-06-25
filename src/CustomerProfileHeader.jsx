import { useAuth } from "./AuthContext";

// แสดงข้อมูลผู้ใช้ที่ login อยู่ (ชื่อ/อีเมล/role) พร้อมปุ่ม Logout
export default function CustomerProfileHeader() {
  const { user, profile, role, logout } = useAuth();

  if (!user) return null;

  const name = profile?.name || profile?.customerName || user.displayName || "-";
  const email = profile?.email || user.email || "-";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        background: "#1e1e1e",
        borderRadius: "16px",
        padding: "14px 16px",
        marginBottom: "16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ fontWeight: "bold", fontSize: "16px" }}>👤 {name}</div>
        <div style={{ color: "#aaa", fontSize: "13px" }}>{email}</div>
        <div style={{ color: "#ff9800", fontSize: "13px", fontWeight: "bold" }}>
          สิทธิ์: {role || "-"}
        </div>
      </div>
      <button
        onClick={logout}
        style={{
          padding: "10px 18px",
          borderRadius: "20px",
          background: "#e53935",
          color: "#fff",
          border: "none",
          fontSize: "14px",
          fontWeight: "bold",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
