// Shared ErrorCenter (SSOT, Phase 4.5) — one error parser + one user-message map +
// one log path for the whole system. Replaces the ad-hoc `console.error(err)` +
// hardcoded Thai strings scattered across catch blocks. Reuses the existing logger
// (console) and the FeatureFlags SSOT (Phase 4.4, which reads the cached AppConfig).
// No new Firestore collection/write, and no new toast system — the hook holds the
// user message so each screen surfaces it through its existing inline error / alert.
import { useState, useCallback } from "react";
import { useFeatureFlags } from "./featureFlags";

// code -> Thai user-facing message. Single source; getUserMessage reads this only.
const ERROR_MESSAGES = {
  "auth/invalid-email": "อีเมลไม่ถูกต้อง",
  "auth/user-not-found": "ไม่พบบัญชีผู้ใช้นี้",
  "auth/wrong-password": "รหัสผ่านไม่ถูกต้อง",
  "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/email-already-in-use": "อีเมลนี้ถูกใช้งานแล้ว",
  "auth/weak-password": "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัว)",
  "auth/too-many-requests": "พยายามหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง",
  "auth/network-request-failed": "เชื่อมต่อเครือข่ายไม่สำเร็จ",
  "permission-denied": "คุณไม่มีสิทธิ์ดำเนินการนี้",
  "unavailable": "ระบบไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่",
  "not-found": "ไม่พบข้อมูลที่ต้องการ",
  "already-exists": "ข้อมูลนี้มีอยู่แล้ว",
  "deadline-exceeded": "หมดเวลาเชื่อมต่อ กรุณาลองใหม่",
  default: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
};

// The ONE error parser. Handles Error / Firebase error / string / unknown.
export function normalizeError(err) {
  if (!err) return { code: "unknown", message: "", raw: err };
  if (typeof err === "string") return { code: "unknown", message: err, raw: err };
  return { code: err.code || err.name || "unknown", message: err.message || String(err), raw: err };
}

// Thai user message from any error. Reuses normalizeError + the single message map.
export function getUserMessage(err) {
  return ERROR_MESSAGES[normalizeError(err).code] || ERROR_MESSAGES.default;
}

// The ONE log path. Reuses the existing logger (console) — no duplicate logger/write.
export function logError(err, context = "") {
  const info = normalizeError(err);
  console.error(`[ErrorCenter]${context ? ` ${context}` : ""}`, info.code, info.message, info.raw);
  return info;
}

// Main entry: normalize + log, and return the user message for the UI. No toast/
// Firestore side effects here — callers decide how to surface userMessage.
export function reportError(err, context = "") {
  logError(err, context);
  return { ...normalizeError(err), userMessage: getUserMessage(err) };
}

// React hook: report an error and hold its user message for inline display. Reuses
// FeatureFlags (cached AppConfig) so screens can adapt messaging without a new fetch.
export function useErrorCenter() {
  const flags = useFeatureFlags();
  const [error, setError] = useState(null);
  const report = useCallback((err, context = "") => {
    const info = reportError(err, context);
    setError(info.userMessage);
    return info;
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { error, reportError: report, clearError, flags };
}
