import { onRequest } from "firebase-functions/v2/https";
import { verifyLineSignature } from "./services/lineNotificationService.js";

// Webhook สำหรับยืนยัน Webhook URL ใน LINE Developers Console เท่านั้น (ตรวจ signature ทุกครั้ง)
// ระบบนี้ส่งแจ้งเตือนทางเดียว (push) ไม่มีฟีเจอร์ขาเข้า เช่น Rich Menu / LINE Login / Reply / Broadcast
export const lineWebhook = onRequest(async (req, res) => {
  const signature = req.get("x-line-signature");

  if (!verifyLineSignature(req.rawBody, signature)) {
    console.error("LINE webhook signature ไม่ถูกต้อง");
    res.status(401).send("invalid signature");
    return;
  }

  res.status(200).send("OK");
});
