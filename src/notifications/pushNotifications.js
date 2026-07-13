// Production Push Notification (SSOT, Phase 6.0A) — surfaces new in-app notifications
// as native OS/browser push via the Web Notifications API. Driven ENTIRELY by the one
// existing new-notification signal (useNotifications `onNew`, consumed in
// NotificationBell) — no new Firestore collection, query, or listener. Gated by the
// FeatureFlags SSOT (enableNotification); all failures route through ErrorCenter.
// Additive only: the existing in-app notification pipeline is unchanged.
import { isFeatureEnabled } from "../featureFlags";
import { logError } from "../errorCenter";

const supported = () => typeof window !== "undefined" && "Notification" in window;

// Ask once for OS permission. Safe to call repeatedly; no-op if already decided.
export async function ensurePushPermission() {
  if (!supported()) return "unsupported";
  try {
    if (Notification.permission === "default") return await Notification.requestPermission();
    return Notification.permission;
  } catch (e) {
    logError(e, "ensurePushPermission");
    return "denied";
  }
}

// Show a native push for one in-app notification, reusing its own title/message/type.
// `tag` collapses duplicates natively (same type+order). Deep-links via actionUrl.
export async function showPush(n = {}) {
  if (!supported() || Notification.permission !== "granted") return false;
  if (!(await isFeatureEnabled("enableNotification"))) return false;
  try {
    const note = new Notification(n.title || "LK Fried Chicken", {
      body: n.message || "",
      tag: `${n.type || ""}|${n.orderId || ""}`,
    });
    if (n.actionUrl) {
      note.onclick = () => {
        try { window.focus(); window.location.assign(n.actionUrl); } catch { /* ignore */ }
        note.close();
      };
    }
    return true;
  } catch (e) {
    logError(e, "showPush");
    return false;
  }
}

// Fan out a batch of freshly-added notifications (the `onNew` payload). Single call
// site in NotificationBell — no extra listener.
export async function pushNew(added = []) {
  for (const n of added || []) await showPush(n);
}
