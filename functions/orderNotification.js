import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "./firebaseAdmin.js";
import { sendLineMessage, haversineKm } from "./services/lineNotificationService.js";

// ตั้งค่าผ่าน environment variables ตอน deploy:
//   STORE_LINE_USER_ID  = LINE userId/groupId ของร้าน fallback ถ้ายังไม่ได้ตั้ง stores/{id}.lineGroupId
//   TRACK_BASE_URL      = URL หน้า track เช่น https://your-app.web.app/track
//   STORE_DASHBOARD_URL = URL หน้า Store Dashboard
const STORE_LINE_USER_ID_FALLBACK = process.env.STORE_LINE_USER_ID || "";
const TRACK_BASE_URL =
  process.env.TRACK_BASE_URL || "https://lk-fried-chicken.web.app/track";
const STORE_DASHBOARD_URL =
  process.env.STORE_DASHBOARD_URL ||
  "https://lk-fried-chicken.web.app/store/orders";

const NEAR_DISTANCE_KM = 0.3; // 300 เมตร

const formatDate = (value) => {
  if (!value) return "-";
  const d = value.toDate ? value.toDate() : new Date(value);
  return d.toLocaleString("th-TH");
};

// หา lineUserId ของลูกค้า (จาก order หรือจาก users ตามเบอร์) - validate ก่อนใช้เสมอ
async function getCustomerLineId(order) {
  if (typeof order?.lineUserId === "string" && order.lineUserId) return order.lineUserId;
  if (!order?.phone) return "";
  const snap = await db
    .collection("users")
    .where("phone", "==", order.phone)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].data().lineUserId || "";
  return "";
}

// หา lineGroupId ของร้าน จาก stores/{storeId} (fallback ไป STORE_LINE_USER_ID ถ้ายังไม่ได้ตั้งค่า)
async function getStoreLineReceiver(order) {
  const storeId = order?.storeId;
  if (storeId) {
    const snap = await db.collection("stores").doc(storeId).get();
    const lineGroupId = snap.exists ? snap.data().lineGroupId : "";
    if (typeof lineGroupId === "string" && lineGroupId) return lineGroupId;
  }
  return STORE_LINE_USER_ID_FALLBACK;
}

// กันยิงซ้ำ: เช็ค flag บน order.notified.<key> ก่อนส่ง แล้ว set กลับเป็น true หลังส่ง
async function alreadyNotified(orderId, key) {
  const snap = await db.collection("orders").doc(orderId).get();
  return !!snap.data()?.notified?.[key];
}

async function markNotified(orderId, key) {
  await db
    .collection("orders")
    .doc(orderId)
    .set({ notified: { [key]: true } }, { merge: true });
}

// ----- Notification 1: ลูกค้าสร้างออเดอร์ใหม่ (status: pending) -> แจ้งร้าน -----
export const onNewOrder = onDocumentCreated("orders/{orderId}", async (event) => {
  const order = event.data?.data();
  const orderId = event.params.orderId;
  if (!order) return;
  if (await alreadyNotified(orderId, "newOrder")) return;

  const to = await getStoreLineReceiver(order);
  const items = (order.items || [])
    .map((it) => `- ${it.name} x${it.qty || 1}`)
    .join("\n");

  const message =
    `🔔 มีออเดอร์ใหม่\n` +
    `เลขออเดอร์: ${order.orderNo || orderId}\n` +
    `Customer Name: ${order.customerName || "-"}\n` +
    `Phone: ${order.phone || "-"}\n` +
    `Items:\n${items || "-"}\n` +
    `Total Price: ${order.grandTotal ?? order.subtotal ?? 0} บาท\n` +
    `Payment Method: ${order.paymentMethod || "-"}\n` +
    `Time: ${formatDate(order.createdAt)}\n` +
    `เปิด Store Dashboard: ${STORE_DASHBOARD_URL}`;

  await sendLineMessage({ to, message, type: "new_order", orderId });
  await markNotified(orderId, "newOrder");
});

// ----- Notification 2-8: ความเปลี่ยนแปลงสถานะออเดอร์ -----
export const onOrderStatusChange = onDocumentUpdated(
  "orders/{orderId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const orderId = event.params.orderId;
    if (!before || !after) return;

    const statusChangedTo = (status) =>
      before.status !== status && after.status === status;

    // Notification 2: ร้านเปลี่ยนสถานะเป็น accepted -> แจ้งลูกค้า
    if (statusChangedTo("accepted") && !(await alreadyNotified(orderId, "accepted"))) {
      const to = await getCustomerLineId(after);
      const message =
        `✅ ร้านรับออเดอร์แล้ว\n` +
        `กำลังเริ่มทำอาหาร\n` +
        `Order #: ${after.orderNo || orderId}\n` +
        `Estimated Time: ${after.estimatedMinutes ? `${after.estimatedMinutes} นาที` : "กำลังคำนวณ"}`;
      await sendLineMessage({ to, message, type: "accepted", orderId });
      await markNotified(orderId, "accepted");
    }

    // Notification 3: ร้านเปลี่ยนสถานะเป็น cooking -> แจ้งลูกค้า
    if (statusChangedTo("cooking") && !(await alreadyNotified(orderId, "cooking"))) {
      const to = await getCustomerLineId(after);
      const message =
        `🍳 ร้านกำลังทำอาหาร\n` +
        `Order #: ${after.orderNo || orderId}\n` +
        `Estimated Remaining Time: ${after.estimatedMinutes ? `${after.estimatedMinutes} นาที` : "กำลังคำนวณ"}`;
      await sendLineMessage({ to, message, type: "cooking", orderId });
      await markNotified(orderId, "cooking");
    }

    // Notification 4: ร้านเปลี่ยนสถานะเป็น ready_for_delivery -> แจ้งลูกค้า
    if (
      statusChangedTo("ready_for_delivery") &&
      !(await alreadyNotified(orderId, "readyForDelivery"))
    ) {
      const to = await getCustomerLineId(after);
      const message =
        `📦 อาหารพร้อมจัดส่ง\n` +
        `ไรเดอร์กำลังรับงาน\n` +
        `Order #: ${after.orderNo || orderId}`;
      await sendLineMessage({ to, message, type: "ready_for_delivery", orderId });
      await markNotified(orderId, "readyForDelivery");
    }

    // Notification 5: ไรเดอร์รับงานแล้ว ออกเดินทางส่ง (status -> delivering) -> แจ้งลูกค้า
    if (statusChangedTo("delivering") && !(await alreadyNotified(orderId, "delivering"))) {
      const to = await getCustomerLineId(after);
      const message =
        `🛵 ไรเดอร์รับงานแล้ว\n` +
        `Rider Name: ${after.riderName || "-"}\n` +
        `Phone: ${after.riderPhone || "-"}\n` +
        `Vehicle: ${after.riderVehicle || "-"}\n` +
        `ETA: ${after.estimatedArrival || "กำลังคำนวณ"}\n` +
        `ติดตามการจัดส่งในแอป: ${TRACK_BASE_URL}`;
      await sendLineMessage({ to, message, type: "delivering", orderId });
      await markNotified(orderId, "delivering");
    }

    // Notification 6: ระยะห่างไรเดอร์-ลูกค้า <= 300 เมตร (จาก riderLocation ใหม่ หรือ riderLat/riderLng เดิม)
    // หรือไรเดอร์กดปุ่ม "ใกล้ถึงแล้ว"
    const beforeRiderLat = before.riderLocation?.lat ?? before.riderLat;
    const beforeRiderLng = before.riderLocation?.lng ?? before.riderLng;
    const afterRiderLat = after.riderLocation?.lat ?? after.riderLat;
    const afterRiderLng = after.riderLocation?.lng ?? after.riderLng;
    const riderMoved =
      afterRiderLat != null &&
      afterRiderLng != null &&
      (beforeRiderLat !== afterRiderLat || beforeRiderLng !== afterRiderLng);
    const nearPressed = !before.nearPressed && after.nearPressed === true;

    if ((riderMoved || nearPressed) && !(await alreadyNotified(orderId, "near"))) {
      const destLat = after.deliveryLocation?.lat ?? after.lat ?? after.latitude;
      const destLng = after.deliveryLocation?.lng ?? after.lng ?? after.longitude;
      const distanceKm = nearPressed
        ? 0
        : haversineKm(afterRiderLat, afterRiderLng, destLat, destLng);

      if (nearPressed || (distanceKm != null && distanceKm <= NEAR_DISTANCE_KM)) {
        const to = await getCustomerLineId(after);
        const message = `📍 ไรเดอร์ใกล้ถึงแล้ว\nกรุณาเตรียมรับอาหาร`;
        await sendLineMessage({ to, message, type: "near", orderId });
        await markNotified(orderId, "near");
      }
    }

    // Notification 7: ส่งสำเร็จ (status -> completed) -> แจ้งลูกค้า
    if (statusChangedTo("completed") && !(await alreadyNotified(orderId, "completed"))) {
      const to = await getCustomerLineId(after);
      const message = `✅ ส่งอาหารเรียบร้อยแล้ว\nขอบคุณที่ใช้บริการ`;
      await sendLineMessage({ to, message, type: "completed", orderId });
      await markNotified(orderId, "completed");
    }

    // Notification 8: ยกเลิกออเดอร์ (status -> cancelled) -> แจ้งลูกค้า
    if (statusChangedTo("cancelled") && !(await alreadyNotified(orderId, "cancelled"))) {
      const to = await getCustomerLineId(after);
      const message =
        `❌ ร้านยกเลิกออเดอร์\n` +
        `Reason: ${after.cancelReason || "-"}\n` +
        `Refund Status: ${after.refundStatus || "-"}`;
      await sendLineMessage({ to, message, type: "cancelled", orderId });
      await markNotified(orderId, "cancelled");
    }
  }
);
