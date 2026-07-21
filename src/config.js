// ค่ากลางของระบบ (เตรียมรองรับหลายร้าน)
export const STORE_ID = "LK001";
// เบอร์โทรร้านจริงอยู่ใน Firestore: stores/{STORE_ID}.phone — ห้าม hardcode เบอร์ placeholder
// ที่นี่ (เดิมเป็นเบอร์ปลอมทำให้ปุ่มโทรหาร้านโทรเบอร์ผิด). ค่าว่าง = ไม่มี fallback: ทุกจุดต้อง
// อ่านจาก store doc และปิดปุ่มโทรถ้าไม่มีเบอร์ แทนที่จะโทรเบอร์ปลอม
export const STORE_PHONE = "";

// PromptPay รับเงิน (นี่คือหมายเลข PromptPay สำหรับรับชำระเงิน — คนละอย่างกับเบอร์โทรร้าน)
export const PROMPTPAY_ID = "0830000000";
export const PROMPTPAY_ACCOUNT_NAME = "LK Fried Chicken";

// เวลาเตรียมอาหารโดยประมาณ (นาที) ใช้รวมกับเวลาเดินทางเป็น "เวลาจัดส่งโดยประมาณ"
export const EST_PREP_MINUTES = 15;

// Cloudinary (unsigned upload) — ใช้เก็บรูปแทน Firebase Storage
// cloud name + unsigned upload preset ตั้งค่าไว้ใน Cloudinary dashboard แล้ว
export const CLOUDINARY_CLOUD_NAME = "eby8jpys";
export const CLOUDINARY_UPLOAD_PRESET = "lk-fried-chicken";

// เวอร์ชันแอป (แสดงในหน้า Device Check / About) — อัปเดตเมื่อ release
export const APP_VERSION = "1.0.0";
