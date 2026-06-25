import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import { uploadApplicationFile } from "./uploadApplicationFile.js";

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
  maxWidth: "420px",
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
const sectionTitle = { margin: "16px 0 8px", color: "#ff9800", fontSize: "15px" };
const fileLabel = { display: "block", marginBottom: "4px", fontSize: "13px", color: "#bbb" };

// สมัครสมาชิกไรเดอร์: role=rider, status=pending -> ต้องรอแอดมินอนุมัติก่อนรับงานได้
export default function RegisterRider() {
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    vehicleType: "motorcycle",
    brand: "",
    model: "",
    color: "",
    licensePlate: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
  });
  const [files, setFiles] = useState({ idCard: null, driverLicense: null, vehiclePhoto: null });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setFile = (k) => (e) => setFiles((p) => ({ ...p, [k]: e.target.files?.[0] || null }));

  const handleRegister = async () => {
    setError("");
    if (!f.firstName.trim() || !f.lastName.trim() || !f.phone.trim() || !f.email.trim() || !f.password.trim()) {
      setError("กรุณากรอกข้อมูลส่วนตัวให้ครบ");
      return;
    }
    if (f.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (!f.licensePlate.trim()) {
      setError("กรุณากรอกข้อมูลยานพาหนะให้ครบ");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      const uid = cred.user.uid;

      const [idCardUrl, driverLicenseUrl, vehiclePhotoUrl] = await Promise.all([
        uploadApplicationFile("rider", uid, "idCard", files.idCard),
        uploadApplicationFile("rider", uid, "driverLicense", files.driverLicense),
        uploadApplicationFile("rider", uid, "vehiclePhoto", files.vehiclePhoto),
      ]);

      await setDoc(doc(db, "users", uid), {
        uid,
        role: "rider",
        status: "pending",
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        name: `${f.firstName.trim()} ${f.lastName.trim()}`,
        riderName: `${f.firstName.trim()} ${f.lastName.trim()}`,
        phone: f.phone.trim(),
        email: f.email.trim(),
        vehicleType: f.vehicleType,
        vehicleBrand: f.brand.trim(),
        vehicleModel: f.model.trim(),
        vehicleColor: f.color.trim(),
        licensePlate: f.licensePlate.trim(),
        bankName: f.bankName.trim(),
        accountNumber: f.accountNumber.trim(),
        accountName: f.accountName.trim(),
        idCardUrl,
        driverLicenseUrl,
        vehiclePhotoUrl,
        riderStatus: "offline",
        createdAt: serverTimestamp(),
      });

      // สถานะ pending -> ออกจากระบบทันที ป้องกันรับงานก่อนได้รับอนุมัติ
      await signOut(auth);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") setError("อีเมลนี้ถูกใช้สมัครแล้ว");
      else if (err.code === "auth/invalid-email") setError("รูปแบบอีเมลไม่ถูกต้อง");
      else setError("สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h2 style={{ marginTop: 0, textAlign: "center" }}>🛵 สมัครไรเดอร์สำเร็จ</h2>
          <p style={{ textAlign: "center", color: "#ffb74d" }}>Your application is under review.</p>
          <p style={{ textAlign: "center", fontSize: "13px", color: "#999" }}>
            แอดมินจะตรวจสอบเอกสารและอนุมัติบัญชีของคุณ กรุณารอการอนุมัติก่อนรับงาน
          </p>
          <Link to="/login">
            <button style={{ ...button, marginTop: "12px" }}>กลับไปหน้าเข้าสู่ระบบ</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ marginTop: 0, textAlign: "center" }}>🛵 สมัครสมาชิกไรเดอร์</h2>

        <div style={sectionTitle}>ข้อมูลส่วนตัว</div>
        <input placeholder="ชื่อ" value={f.firstName} onChange={set("firstName")} style={input} />
        <input placeholder="นามสกุล" value={f.lastName} onChange={set("lastName")} style={input} />
        <input type="tel" placeholder="เบอร์โทร" value={f.phone} onChange={set("phone")} style={input} />
        <input type="email" placeholder="อีเมล" value={f.email} onChange={set("email")} style={input} />
        <input type="password" placeholder="รหัสผ่าน" value={f.password} onChange={set("password")} style={input} />

        <div style={sectionTitle}>ข้อมูลยานพาหนะ</div>
        <select value={f.vehicleType} onChange={set("vehicleType")} style={input}>
          <option value="motorcycle">มอเตอร์ไซค์</option>
          <option value="car">รถยนต์</option>
          <option value="bicycle">จักรยาน</option>
        </select>
        <input placeholder="ยี่ห้อรถ" value={f.brand} onChange={set("brand")} style={input} />
        <input placeholder="รุ่นรถ" value={f.model} onChange={set("model")} style={input} />
        <input placeholder="สีรถ" value={f.color} onChange={set("color")} style={input} />
        <input placeholder="เลขทะเบียนรถ" value={f.licensePlate} onChange={set("licensePlate")} style={input} />

        <div style={sectionTitle}>เอกสารแนบ</div>
        <label style={fileLabel}>บัตรประชาชน</label>
        <input type="file" accept="image/*" onChange={setFile("idCard")} style={input} />
        <label style={fileLabel}>ใบขับขี่</label>
        <input type="file" accept="image/*" onChange={setFile("driverLicense")} style={input} />
        <label style={fileLabel}>รูปถ่ายรถ</label>
        <input type="file" accept="image/*" onChange={setFile("vehiclePhoto")} style={input} />

        <div style={sectionTitle}>ข้อมูลบัญชีธนาคาร</div>
        <input placeholder="ธนาคาร" value={f.bankName} onChange={set("bankName")} style={input} />
        <input placeholder="เลขบัญชี" value={f.accountNumber} onChange={set("accountNumber")} style={input} />
        <input
          placeholder="ชื่อบัญชี"
          value={f.accountName}
          onChange={set("accountName")}
          onKeyDown={(e) => e.key === "Enter" && handleRegister()}
          style={input}
        />

        {error && <div style={{ color: "#e53935", marginBottom: "10px", fontSize: "14px" }}>{error}</div>}
        <button onClick={handleRegister} disabled={loading} style={button}>
          {loading ? "กำลังส่งคำขอ..." : "ส่งคำขอสมัครไรเดอร์"}
        </button>
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
          มีบัญชีแล้ว? <Link to="/login" style={{ color: "#ff8c00" }}>เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
