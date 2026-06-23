import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({ region: "asia-southeast1" });

const db = getFirestore();

// ตั้งค่าผ่าน environment variables ตอน deploy:
//   LINE_CHANNEL_ACCESS_TOKEN  = channel access token ของ LINE OA
//   STORE_LINE_USER_ID         = LINE userId ของร้าน (ผู้รับแจ้งเตือนออเดอร์ใหม่)
//   TRACK_BASE_URL             = URL หน้า track เช่น https://your-app.web.app/track
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const STORE_LINE_USER_ID = process.env.STORE_LINE_USER_ID || "";
const TRACK_BASE_URL =
  process.env.TRACK_BASE_URL || "https://lk-fried-chicken.web.app/track";

// ส่งข้อความผ่าน LINE Messaging API (push)
async function pushLine(to, text) {
  if (!LINE_TOKEN || !to) {
    console.log("ข้าม push LINE (ไม่มี token หรือ userId)", { to: !!to });
    return;
  }
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      console.error("LINE push error", res.status, await res.text());
    }
  } catch (err) {
    console.error("LINE push exception", err);
  }
}

// หา lineUserId ของลูกค้า (จาก order หรือจาก users ตามเบอร์)
async function getCustomerLineId(order) {
  if (order.lineUserId) return order.lineUserId;
  if (!order.phone) return "";
  const snap = await db
    .collection("users")
    .where("phone", "==", order.phone)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].data().lineUserId || "";
  return "";
}

const STATUS_TEXT = {
  "ออเดอร์ใหม่": "ได้รับออเดอร์แล้ว",
  "ร้านรับออเดอร์": "ร้านรับออเดอร์แล้ว ✅",
  "กำลังทำ": "กำลังทำอาหาร 👨‍🍳",
  "กำลังจัดส่ง": "กำลังจัดส่ง 🛵",
  "ส่งให้ไรเดอร์": "กำลังจัดส่ง 🛵",
  "เสร็จสิ้น": "จัดส่งสำเร็จ 🎉",
  "ยกเลิก": "ออเดอร์ถูกยกเลิก ❌",
};

// 1. มีออเดอร์ใหม่ -> แจ้งร้าน
export const onNewOrder = onDocumentCreated("orders/{id}", async (event) => {
  const order = event.data?.data();
  if (!order) return;
  const text =
    `🔔 ออเดอร์ใหม่\n${order.orderNo || ""}\n` +
    `ชื่อ: ${order.customerName || "-"}\n` +
    `เบอร์: ${order.phone || "-"}\n` +
    `ยอด: ${order.grandTotal || 0} บาท`;
  await pushLine(STORE_LINE_USER_ID, text);
});

// 2-3. สถานะเปลี่ยน -> แจ้งลูกค้า (พร้อมข้อมูลไรเดอร์เมื่อกำลังจัดส่ง)
export const onOrderStatusChange = onDocumentUpdated(
  "orders/{id}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    const to = await getCustomerLineId(after);
    let text =
      `📦 ออเดอร์ ${after.orderNo || ""}\n` +
      `สถานะ: ${STATUS_TEXT[after.status] || after.status}`;

    if (after.status === "กำลังจัดส่ง" || after.status === "ส่งให้ไรเดอร์") {
      text +=
        `\n🛵 ไรเดอร์: ${after.riderName || "-"}` +
        `\n📞 โทร: ${after.riderPhone || "-"}` +
        `\n🔗 ติดตามสถานะ: ${TRACK_BASE_URL}`;
    }

    if (after.status === "ยกเลิก" && after.cancelReason) {
      text += `\nเหตุผล: ${after.cancelReason}`;
    }

    await pushLine(to, text);
  }
);
