import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Link } from "react-router-dom";
import StoreLocationPicker from "./StoreLocationPicker.jsx";
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
  maxWidth: "440px",
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

// สมัครสมาชิกร้านค้า: role=store, status=pending -> ต้องรอแอดมินอนุมัติก่อนเข้าใช้งานได้
export default function RegisterStore() {
  const [f, setF] = useState({
    storeName: "",
    ownerName: "",
    phone: "",
    email: "",
    password: "",
    address: "",
    openTime: "08:00",
    closeTime: "20:00",
    promptpayNumber: "",
  });
  const [location, setLocation] = useState(null);
  const [files, setFiles] = useState({ logo: null, cover: null, idCard: null, storePhoto: null });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setFile = (k) => (e) => setFiles((p) => ({ ...p, [k]: e.target.files?.[0] || null }));

  const handleRegister = async () => {
    setError("");
    if (!f.storeName.trim() || !f.ownerName.trim() || !f.phone.trim() || !f.email.trim() || !f.password.trim()) {
      setError("กรุณากรอกข้อมูลร้านให้ครบ");
      return;
    }
    if (f.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (!f.address.trim() || !location) {
      setError("กรุณากรอกที่อยู่และเลือกตำแหน่งร้านบนแผนที่");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      const uid = cred.user.uid;

      const [logoUrl, coverUrl, idCardUrl, storePhotoUrl] = await Promise.all([
        uploadApplicationFile("store", uid, "logo", files.logo),
        uploadApplicationFile("store", uid, "cover", files.cover),
        uploadApplicationFile("store", uid, "idCard", files.idCard),
        uploadApplicationFile("store", uid, "storePhoto", files.storePhoto),
      ]);

      await setDoc(doc(db, "users", uid), {
        role: "store",
        status: "pending",
        storeName: f.storeName.trim(),
        ownerName: f.ownerName.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        address: f.address.trim(),
        lat: location.lat,
        lng: location.lng,
        openTime: f.openTime,
        closeTime: f.closeTime,
        promptpayNumber: f.promptpayNumber.trim(),
        logoUrl,
        coverUrl,
        idCardUrl,
        storePhotoUrl,
        createdAt: serverTimestamp(),
      });

      // สถานะ pending -> ออกจากระบบทันที ป้องกันเข้าใช้งานก่อนได้รับอนุมัติ
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
          <h2 style={{ marginTop: 0, textAlign: "center" }}>🏪 สมัครร้านค้าสำเร็จ</h2>
          <p style={{ textAlign: "center", color: "#ffb74d" }}>Your application is under review.</p>
          <p style={{ textAlign: "center", fontSize: "13px", color: "#999" }}>
            แอดมินจะตรวจสอบเอกสารและอนุมัติบัญชีของคุณ กรุณารอการอนุมัติก่อนเข้าสู่ระบบ
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
        <h2 style={{ marginTop: 0, textAlign: "center" }}>🏪 สมัครสมาชิกร้านค้า</h2>

        <div style={sectionTitle}>ข้อมูลร้าน</div>
        <input placeholder="ชื่อร้าน" value={f.storeName} onChange={set("storeName")} style={input} />
        <input placeholder="ชื่อเจ้าของร้าน" value={f.ownerName} onChange={set("ownerName")} style={input} />
        <input type="tel" placeholder="เบอร์โทร" value={f.phone} onChange={set("phone")} style={input} />
        <input type="email" placeholder="อีเมล" value={f.email} onChange={set("email")} style={input} />
        <input type="password" placeholder="รหัสผ่าน" value={f.password} onChange={set("password")} style={input} />

        <div style={sectionTitle}>ข้อมูลธุรกิจ</div>
        <textarea placeholder="ที่อยู่ร้าน" value={f.address} onChange={set("address")} style={{ ...input, minHeight: "60px" }} />
        <StoreLocationPicker value={location} onChange={setLocation} />
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <label style={fileLabel}>เวลาเปิด</label>
            <input type="time" value={f.openTime} onChange={set("openTime")} style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fileLabel}>เวลาปิด</label>
            <input type="time" value={f.closeTime} onChange={set("closeTime")} style={input} />
          </div>
        </div>
        <input placeholder="เลขพร้อมเพย์ของร้าน" value={f.promptpayNumber} onChange={set("promptpayNumber")} style={input} />

        <div style={sectionTitle}>เอกสารแนบ</div>
        <label style={fileLabel}>โลโก้ร้าน</label>
        <input type="file" accept="image/*" onChange={setFile("logo")} style={input} />
        <label style={fileLabel}>ภาพหน้าปกร้าน</label>
        <input type="file" accept="image/*" onChange={setFile("cover")} style={input} />
        <label style={fileLabel}>บัตรประชาชนเจ้าของร้าน</label>
        <input type="file" accept="image/*" onChange={setFile("idCard")} style={input} />
        <label style={fileLabel}>รูปถ่ายหน้าร้าน</label>
        <input type="file" accept="image/*" onChange={setFile("storePhoto")} style={input} />

        {error && <div style={{ color: "#e53935", marginBottom: "10px", fontSize: "14px" }}>{error}</div>}
        <button onClick={handleRegister} disabled={loading} style={button}>
          {loading ? "กำลังส่งคำขอ..." : "ส่งคำขอสมัครร้านค้า"}
        </button>
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "14px" }}>
          มีบัญชีแล้ว? <Link to="/login" style={{ color: "#ff8c00" }}>เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
