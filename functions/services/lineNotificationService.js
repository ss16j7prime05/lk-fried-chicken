import crypto from "crypto";
import { db } from "../firebaseAdmin.js";

// ตั้งค่าผ่าน environment variables ตอน deploy เท่านั้น ห้าม hardcode:
//   LINE_CHANNEL_ACCESS_TOKEN
//   LINE_CHANNEL_SECRET
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;
const REQUEST_TIMEOUT_MS = 8000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callLinePush(to, text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LINE push failed (${res.status}): ${body}`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`LINE push timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function writeLog({ type, receiver, status, message, orderId, error }) {
  try {
    await db.collection("notificationLogs").add({
      type,
      receiver: receiver || "",
      status,
      message,
      orderId: orderId || "",
      error: error || "",
      createdAt: new Date(),
    });
  } catch (e) {
    // ไม่ปล่อยให้การบันทึก log ทำให้ฟังก์ชันหลัก crash
    console.error("เขียน notificationLogs ไม่สำเร็จ", e);
  }
}

// ส่งข้อความ LINE แบบ push พร้อม retry + timeout + log ผลทุกครั้ง ไม่ throw เพื่อไม่ให้ Cloud Function ล้ม
export async function sendLineMessage({ to, message, type, orderId }) {
  if (!LINE_TOKEN || !to) {
    await writeLog({
      type,
      receiver: to,
      status: "skipped",
      message,
      orderId,
      error: !LINE_TOKEN ? "missing LINE_CHANNEL_ACCESS_TOKEN" : "missing receiver",
    });
    return { ok: false, skipped: true };
  }

  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await callLinePush(to, message);
      await writeLog({ type, receiver: to, status: "sent", message, orderId });
      return { ok: true };
    } catch (err) {
      lastError = err.message || String(err);
      console.error(`ส่ง LINE ไม่สำเร็จ (ครั้งที่ ${attempt + 1})`, lastError);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  await writeLog({ type, receiver: to, status: "failed", message, orderId, error: lastError });
  return { ok: false, error: lastError };
}

// ตรวจสอบ LINE Signature ของ webhook (HMAC-SHA256 ด้วย Channel Secret) - ป้องกันคนแอบยิง webhook ปลอม
export function verifyLineSignature(rawBody, signature) {
  if (!LINE_CHANNEL_SECRET || !signature) return false;
  const expected = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ระยะทางตรง (กม.) ระหว่างสองพิกัด ใช้สำหรับเช็คว่าไรเดอร์ใกล้ถึงลูกค้าหรือยัง (< 300 ม.)
export function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
