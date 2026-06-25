import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

// อัปโหลดไฟล์เอกสารสมัครสมาชิก (ร้าน/ไรเดอร์) ไปที่ applications/{role}/{uid}/{field} แล้วคืน URL จริง
// ต้องล็อกอินก่อนเรียก (createUserWithEmailAndPassword สำเร็จแล้ว) เพราะ Storage rule ผูกกับ uid เจ้าของไฟล์
export async function uploadApplicationFile(role, uid, field, file) {
  if (!file) return "";
  const path = `applications/${role}/${uid}/${field}-${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}
