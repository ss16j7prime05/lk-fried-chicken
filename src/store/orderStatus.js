// สถานะออเดอร์มาตรฐาน (อังกฤษ) ของ Store Dashboard ใหม่
export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "cooking",
  "delivering",
  "completed",
];

// แปลงสถานะเดิม (ภาษาไทย) จากระบบสั่งอาหารของลูกค้า ให้เข้ากลุ่มสถานะใหม่
// เพื่อให้ Dashboard นี้แสดงออเดอร์จริงได้ โดยไม่ต้องแก้ logic การสั่งอาหารของลูกค้า
const LEGACY_STATUS_MAP = {
  "ออเดอร์ใหม่": "pending",
  "กำลังทำ": "cooking",
  "ส่งให้ไรเดอร์": "delivering",
  "กำลังจัดส่ง": "delivering",
  "เสร็จสิ้น": "completed",
};

export const normalizeStatus = (status) => LEGACY_STATUS_MAP[status] || status;

export const STATUS_LABEL = {
  pending: "รอรับออเดอร์",
  accepted: "รับออเดอร์แล้ว",
  cooking: "กำลังปรุง",
  delivering: "กำลังจัดส่ง",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
};

export const STATUS_COLOR = {
  pending: "#e53935",
  accepted: "#ffb74d",
  cooking: "#ff9800",
  delivering: "#4fc3f7",
  completed: "#22c55e",
  cancelled: "#777",
};

// ปุ่ม action ที่แสดงในแต่ละสถานะ -> สถานะปลายทางที่จะบันทึก
export const NEXT_ACTION = {
  pending: { label: "✅ รับออเดอร์", to: "accepted", color: "#22c55e" },
  accepted: { label: "🍳 เริ่มปรุง", to: "cooking", color: "#ff9800" },
  cooking: { label: "🛵 พร้อมส่ง", to: "delivering", color: "#4fc3f7" },
  delivering: { label: "🎉 จบออเดอร์", to: "completed", color: "#22c55e" },
};
