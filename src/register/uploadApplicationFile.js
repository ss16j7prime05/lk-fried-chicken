import { uploadImage } from "../services/cloudinary";

// อัปโหลดรูปเอกสารสมัครสมาชิก (ร้าน/ไรเดอร์: โลโก้/ปก/บัตร ปชช./รูปร้าน/ใบขับขี่/รูปรถ)
// ผ่าน uploadImage ตัวกลางเดียวของทั้งแอป (Cloudinary) แล้วคืน secure_url จริง —
// เดิมใช้ Firebase Storage ซึ่งโปรเจกต์นี้ไม่มี bucket จริง (uploadBytes 404) ทำให้
// อัปเอกสารสมัครล้มเหลว. field/uid ยังถูกเก็บเป็น key ในเอกสาร application อยู่แล้ว
// จึงไม่ต้องพึ่ง path ของไฟล์.
export async function uploadApplicationFile(role, uid, field, file) {
  if (!file) return "";
  return uploadImage(file);
}
