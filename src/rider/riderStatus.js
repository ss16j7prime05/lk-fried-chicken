// สถานะของออเดอร์ในมุมไรเดอร์ (English canonical) - ใช้ enum เดียวกันทั้งระบบ
// ready_for_delivery -> [Accept Delivery] -> picked_up -> [Start Delivering] -> delivering -> [Delivered] -> completed
export const READY_STATUS = "ready_for_delivery";
export const PICKED_UP_STATUS = "picked_up";
export const DELIVERING_STATUS = "delivering";
export const DELIVERED_STATUS = "completed";

// สถานะเดิม (จากระบบสั่งอาหารของลูกค้า / Store Dashboard) ที่หมายถึง "พร้อมส่ง / รอไรเดอร์รับ"
// ใช้แค่ฝั่งอ่านเพื่อให้ Rider Dashboard เห็นออเดอร์จริงได้ ไม่รวม "delivering" เพราะตอนนี้หมายถึง
// งานที่มีไรเดอร์รับแล้วเท่านั้น (ต้องไม่เปิดให้ไรเดอร์คนอื่นเห็น/แย่งงาน)
const READY_ALIASES = ["กำลังจัดส่ง", "ส่งให้ไรเดอร์"];

export const isReadyForDelivery = (status) =>
  status === READY_STATUS || READY_ALIASES.includes(status);

// สถานะทั้งหมดที่ query พูลงานว่างต้องดึง — ต้องครอบ alias ด้วย ไม่งั้นออเดอร์สถานะเดิม
// ถึงมือไรเดอร์ไม่ได้เลย (firestore.rules ก็อนุญาตอ่าน 3 ค่านี้เหมือนกัน)
export const READY_QUERY_STATUSES = [READY_STATUS, ...READY_ALIASES];

export const STATUS_LABEL = {
  [READY_STATUS]: "พร้อมส่ง",
  [PICKED_UP_STATUS]: "รับอาหารแล้ว",
  [DELIVERING_STATUS]: "กำลังจัดส่ง",
  [DELIVERED_STATUS]: "ส่งสำเร็จ",
};
