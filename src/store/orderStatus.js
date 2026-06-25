// สถานะออเดอร์มาตรฐาน (อังกฤษ) ของ Store Dashboard ใหม่ - ตรงกับ lifecycle เต็มของระบบ
export const ORDER_STATUSES = [
  "pending",
  "accepted",
  "cooking",
  "ready_for_delivery",
  "picked_up",
  "delivering",
  "completed",
];

// แปลงสถานะเดิม (ภาษาไทย) จากระบบสั่งอาหารของลูกค้า ให้เข้ากลุ่มสถานะใหม่
// เพื่อให้ Dashboard นี้แสดงออเดอร์จริงได้ โดยไม่ต้องแก้ logic การสั่งอาหารของลูกค้า
const LEGACY_STATUS_MAP = {
  "ออเดอร์ใหม่": "pending",
  "กำลังทำ": "cooking",
  "ส่งให้ไรเดอร์": "ready_for_delivery",
  "กำลังจัดส่ง": "ready_for_delivery",
  "เสร็จสิ้น": "completed",
};

export const normalizeStatus = (status) => LEGACY_STATUS_MAP[status] || status;

export const STATUS_LABEL = {
  pending: "รอรับออเดอร์",
  accepted: "รับออเดอร์แล้ว",
  cooking: "กำลังปรุง",
  ready_for_delivery: "พร้อมส่ง (รอไรเดอร์)",
  picked_up: "ไรเดอร์รับอาหารแล้ว",
  delivering: "กำลังจัดส่ง",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว",
};

export const STATUS_COLOR = {
  pending: "#e53935",
  accepted: "#ffb74d",
  cooking: "#ff9800",
  ready_for_delivery: "#4fc3f7",
  picked_up: "#4fc3f7",
  delivering: "#4fc3f7",
  completed: "#22c55e",
  cancelled: "#777",
};

// ปุ่ม action ที่ฝั่งร้านกดได้ -> สถานะปลายทางที่จะบันทึก
// (ready_for_delivery -> picked_up -> delivering -> completed เป็นขั้นตอนของไรเดอร์ ร้านไม่มีปุ่มเปลี่ยนเอง)
export const NEXT_ACTION = {
  pending: { label: "✅ รับออเดอร์ (Accept)", to: "accepted", color: "#22c55e" },
  accepted: { label: "🍳 เริ่มปรุง (Cooking)", to: "cooking", color: "#ff9800" },
  cooking: { label: "🛵 พร้อมส่ง (Ready for Delivery)", to: "ready_for_delivery", color: "#4fc3f7" },
};
