import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";

// สถานะการชำระเงิน (nested ใน order.payment.status)
export const PAYMENT_STATUS = {
  UNPAID: "unpaid", // เงินสด ไม่ต้องตรวจสลิป
  WAITING_PAYMENT: "waiting_payment", // รอลูกค้าชำระ (มี countdown) — PromptPay / โอน
  PENDING_VERIFICATION: "pending_verification", // แนบสลิปแล้ว รอร้านตรวจสอบ
  PENDING_REVIEW: "pending_verification", // alias (Phase 3.7D) — สถานะเดียวกับ PENDING_VERIFICATION
  APPROVED: "approved",
  PAID: "approved", // alias — ชำระเงินยืนยันแล้ว (ร้านอนุมัติใน Phase 3.7E)
  REJECTED: "rejected",
  EXPIRED: "expired", // หมดเวลาชำระ → order ถูกยกเลิกอัตโนมัติ
};

// เหตุผลการยกเลิก (order.payment.cancelReason)
export const CANCEL_REASON = { PAYMENT_TIMEOUT: "payment_timeout" };

// ช่วงเวลาให้ชำระเงิน = 10 นาที
export const PAYMENT_WINDOW_MS = 10 * 60 * 1000;

// วิธีชำระที่ต้องมี countdown (เงินสดไม่ต้อง)
export const requiresCountdown = (method) => method === "promptpay" || method === "transfer";

// expireAt = now + window เป็น Firestore Timestamp (ใช้ตอนสร้าง order)
export const paymentExpireTimestamp = (fromMs = Date.now()) =>
  Timestamp.fromMillis(fromMs + PAYMENT_WINDOW_MS);

// Firestore Timestamp / Date / string → millis
export const toMillis = (ts) => ts?.toMillis?.() ?? (ts ? new Date(ts).getTime() : 0);

// เวลาคงเหลือจนหมดอายุ (คำนวณจาก expireAt เสมอ → รีเฟรชแล้วยังตรง)
export const countdownFrom = (expireAt, nowMs = Date.now()) => {
  const remaining = Math.max(0, toMillis(expireAt) - nowMs);
  const totalSec = Math.floor(remaining / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return { remainingMs: remaining, expired: remaining <= 0, label: `${mm}:${ss}` };
};

// อัปโหลดสลิปไป Storage แล้วคืน URL (ใช้ร่วมกันระหว่าง Checkout และ Order Detail)
export async function uploadSlip(file) {
  const r = ref(storage, `slips/${Date.now()}_${file.name}`);
  await uploadBytes(r, file);
  return getDownloadURL(r);
}

// Idempotent: ยกเลิกออเดอร์ที่หมดเวลาชำระ (WAITING_PAYMENT → EXPIRED + CANCELLED).
// เขียนเฉพาะเมื่อยังเป็น WAITING_PAYMENT อยู่ กัน write ซ้ำจากหลายผู้ชม.
export async function expireOrderPayment(order) {
  if (!order?.id || order.payment?.status !== PAYMENT_STATUS.WAITING_PAYMENT) return;
  await updateDoc(doc(db, "orders", order.id), {
    "payment.status": PAYMENT_STATUS.EXPIRED,
    "payment.cancelReason": CANCEL_REASON.PAYMENT_TIMEOUT,
    "payment.updatedAt": serverTimestamp(),
    status: "cancelled",
    cancelledAt: serverTimestamp(),
  });
}

// ลูกค้าแนบสลิประหว่าง countdown → PENDING_REVIEW (countdown หยุด, รอร้านตรวจใน 3.7E)
export async function submitSlip(orderId, slipUrl) {
  await updateDoc(doc(db, "orders", orderId), {
    "payment.status": PAYMENT_STATUS.PENDING_REVIEW,
    "payment.slip": slipUrl,
    "payment.slipUrl": slipUrl,
    "payment.updatedAt": serverTimestamp(),
  });
}

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
