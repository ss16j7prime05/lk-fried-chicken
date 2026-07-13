// Production LINE Flex Message (SSOT, Phase 6.0C) — ONE shared Flex builder for the
// order lifecycle, wired into the EXISTING notification pipeline (orderEngine
// notificationTrigger) — no new listener, builder, or collection. Reuses the order
// model + orderStatus formatters, the AppConfig `lineOA` config, lineAuth (LIFF), the
// FeatureFlags SSOT (enableLineOA gate) and ErrorCenter. LIFF/Messaging API ready:
// buildOrderFlex is pure; sendOrderFlex delivers via LIFF when present and otherwise
// no-ops. Feature-flagged + fail-soft, so with the flag OFF behavior is unchanged
// (backward compatible).
import { fmtMoney } from "../store/orderStatus";
import { NOTIF_TYPE } from "./notificationUtils";
import { loadLineConfig } from "../login/lineAuth";
import { isFeatureEnabled } from "../featureFlags";
import { logError } from "../errorCenter";

// Lifecycle event -> Flex content descriptor. Keys reuse the pipeline event vocabulary
// (notificationTrigger) so there is one mapping, not a duplicate one. Each maps to the
// canonical NOTIF_TYPE for consistency with the in-app notification.
export const FLEX_EVENT = {
  confirmed:          { type: NOTIF_TYPE.NEW_ORDER,        title: "ยืนยันคำสั่งซื้อ",   status: "รับออเดอร์เข้าระบบแล้ว",  color: "#ff8c00" },
  accepted:           { type: NOTIF_TYPE.STORE_ACCEPTED,   title: "ร้านรับออเดอร์",      status: "ร้านกำลังเตรียมอาหาร",   color: "#22c55e" },
  assigned:           { type: NOTIF_TYPE.RIDER_ASSIGNED,   title: "ไรเดอร์รับงาน",       status: "ไรเดอร์กำลังไปรับอาหาร", color: "#4fc3f7" },
  ready_for_delivery: { type: NOTIF_TYPE.COOKED,           title: "อาหารพร้อมส่ง",       status: "ทำอาหารเสร็จแล้ว",       color: "#ff9800" },
  delivering:         { type: NOTIF_TYPE.RIDER_DELIVERING, title: "กำลังจัดส่ง",         status: "ไรเดอร์กำลังจัดส่ง",     color: "#4fc3f7" },
  completed:          { type: NOTIF_TYPE.DELIVERED,        title: "จัดส่งสำเร็จ",        status: "ส่งถึงปลายทางแล้ว",      color: "#22c55e" },
};

const kv = (label, value) => ({
  type: "box", layout: "baseline", spacing: "sm",
  contents: [
    { type: "text", text: label, color: "#8c8c8c", size: "sm", flex: 2 },
    { type: "text", text: String(value ?? "—"), wrap: true, color: "#111111", size: "sm", flex: 4 },
  ],
});

// The ONE shared Flex builder. Pure — returns a LINE Flex Message object (or null for
// an unmapped event). Reuses the order model + fmtMoney; safe defaults keep it working
// for partial order docs (backward compatible).
export function buildOrderFlex(order = {}, event) {
  const e = FLEX_EVENT[event];
  if (!e) return null;
  const no = order.orderNo || order.id || "";
  const total = order.total ?? order.grandTotal ?? order.amount ?? 0;
  const count = Array.isArray(order.items) ? order.items.length : (order.itemCount ?? null);
  return {
    type: "flex",
    altText: `${e.title} • ออเดอร์ ${no}`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: e.color,
        contents: [
          { type: "text", text: "LK Fried Chicken", color: "#ffffff", size: "xs", weight: "bold" },
          { type: "text", text: e.title, color: "#ffffff", size: "xl", weight: "bold" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md", paddingAll: "16px",
        contents: [
          { type: "text", text: e.status, wrap: true, weight: "bold", color: e.color, size: "md" },
          { type: "separator" },
          kv("ออเดอร์", `#${no}`),
          ...(count != null ? [kv("รายการ", `${count} รายการ`)] : []),
          kv("ยอดรวม", `฿${fmtMoney(total)}`),
        ],
      },
      ...(order.actionUrl ? {
        footer: {
          type: "box", layout: "vertical", paddingAll: "12px",
          contents: [{
            type: "button", style: "primary", color: e.color, height: "sm",
            action: { type: "uri", label: "ดูรายละเอียด", uri: order.actionUrl },
          }],
        },
      } : {}),
    },
  };
}

// Whether Flex delivery is active (flag on AND LINE configured). Reuses FeatureFlags +
// lineAuth config — no duplicate flag/config.
export async function isFlexEnabled() {
  if (!(await isFeatureEnabled("enableLineOA"))) return false;
  const c = await loadLineConfig();
  return Boolean(c.channelId || c.liffId);
}

// Send the Flex for a lifecycle event. LIFF/Messaging API ready: delivers via the LIFF
// SDK when present (in-app LINE); otherwise builds + no-ops (server Messaging API sends
// out-of-band). Feature-flagged + fail-soft — flag OFF returns false, changing nothing.
export async function sendOrderFlex(order = {}, event) {
  try {
    const flex = buildOrderFlex(order, event);
    if (!flex) return false;
    if (!(await isFlexEnabled())) return false;
    if (typeof window !== "undefined" && window.liff?.isLoggedIn?.() && window.liff.sendMessages) {
      await window.liff.sendMessages([flex]);
      return true;
    }
    return false; // Messaging API path handled server-side; nothing to do client-side
  } catch (err) {
    logError(err, "sendOrderFlex");
    return false;
  }
}
