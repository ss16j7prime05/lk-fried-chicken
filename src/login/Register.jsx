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
  maxWidth: "380px",
  boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
};
const choiceBtn = {
  display: "block",
  width: "100%",
  padding: "14px",
  marginBottom: "12px",
  borderRadius: "12px",
  border: "none",
  background: "#2a2a2a",
  color: "#fff",
  fontWeight: "bold",
  fontSize: "16px",
  textAlign: "center",
  textDecoration: "none",
  cursor: "pointer",
};

// หน้าเลือกประเภทผู้ใช้ก่อนไปยังหน้าสมัครสมาชิกของแต่ละ role (มีเฉพาะ customer/store/rider ห้ามสมัคร admin)
export default function Register() {
  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>📝 สมัครสมาชิก</h2>
        <p style={{ textAlign: "center", color: "#999", fontSize: "14px", marginBottom: "20px" }}>
          เลือกประเภทบัญชีที่ต้องการสมัคร
        </p>
        <Link to="/register/customer" style={choiceBtn}>👤 สมัครสมาชิกลูกค้า</Link>
        <Link to="/register/store" style={choiceBtn}>🏪 สมัครสมาชิกร้านค้า</Link>
        <Link to="/register/rider" style={choiceBtn}>🛵 สมัครสมาชิกไรเดอร์</Link>
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
          มีบัญชีแล้ว? <Link to="/login" style={{ color: "#ff8c00" }}>เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
