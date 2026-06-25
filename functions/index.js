import { setGlobalOptions } from "firebase-functions/v2";
import "./firebaseAdmin.js";

setGlobalOptions({ region: "asia-southeast1" });

// ตั้งค่าผ่าน environment variables ตอน deploy เท่านั้น ห้าม hardcode:
//   LINE_CHANNEL_ACCESS_TOKEN  = channel access token ของ LINE OA
//   LINE_CHANNEL_SECRET        = channel secret ของ LINE OA (ใช้ตรวจ signature webhook)
//   STORE_LINE_USER_ID         = LINE userId/groupId ของร้าน fallback ถ้ายังไม่ได้ตั้ง stores/{id}.lineGroupId
//   TRACK_BASE_URL             = URL หน้า track เช่น https://your-app.web.app/track
//   STORE_DASHBOARD_URL        = URL หน้า Store Dashboard

export { onNewOrder, onOrderStatusChange } from "./orderNotification.js";
export { lineWebhook } from "./lineWebhook.js";
