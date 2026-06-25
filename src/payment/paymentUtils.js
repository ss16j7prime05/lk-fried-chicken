// สถานะการชำระเงิน (nested ใน order.payment.status)
export const PAYMENT_STATUS = {
  UNPAID: "unpaid", // เงินสด ไม่ต้องตรวจสลิป
  PENDING_VERIFICATION: "pending_verification", // แนบสลิปแล้ว รอร้านตรวจสอบ
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const PAYMENT_STATUS_LABEL = {
  [PAYMENT_STATUS.UNPAID]: "ชำระเงินสดปลายทาง",
  [PAYMENT_STATUS.PENDING_VERIFICATION]: "รอตรวจสอบสลิป",
  [PAYMENT_STATUS.APPROVED]: "ยืนยันการชำระเงินแล้ว",
  [PAYMENT_STATUS.REJECTED]: "สลิปถูกปฏิเสธ กรุณาชำระเงินใหม่",
};

export const PAYMENT_STATUS_COLOR = {
  [PAYMENT_STATUS.UNPAID]: "#999",
  [PAYMENT_STATUS.PENDING_VERIFICATION]: "#ffb74d",
  [PAYMENT_STATUS.APPROVED]: "#22c55e",
  [PAYMENT_STATUS.REJECTED]: "#e53935",
};
