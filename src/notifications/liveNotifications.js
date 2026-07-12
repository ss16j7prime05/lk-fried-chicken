// Shared Live Notification (SSOT, Phase 5.5) — deduplicated realtime notifications for
// every role (customer/rider/store/admin). Reuses the existing notification pipeline:
// createNotification (the ONE writer) + useNotifications (the ONE realtime listener) +
// badgeCount, plus the FeatureFlags gate and ErrorCenter. Adds only a dedupe layer on
// both the write side (emitOnce) and read side (dedupeNotifications). No new collection,
// query, or listener. Additive: the existing emit/subscribe paths are unchanged.
import { useMemo } from "react";
import { createNotification, badgeCount } from "./notificationUtils";
import { useNotifications } from "../hooks/useNotifications";
import { isFeatureEnabled } from "../featureFlags";
import { logError } from "../errorCenter";

const ms = (t) => t?.toMillis?.() ?? t?.getTime?.() ?? (typeof t === "number" ? t : 0);

// Same recipient + type + order == the same logical notification.
export const notifKey = (n) => `${n?.role || ""}|${n?.userId || ""}|${n?.type || ""}|${n?.orderId || ""}`;

// Read-side dedup: collapse duplicates, keeping the newest per key. Preserves order.
export function dedupeNotifications(list = []) {
  const byKey = new Map();
  for (const n of list || []) {
    const k = notifKey(n);
    const prev = byKey.get(k);
    if (!prev || ms(n.createdAt) >= ms(prev.createdAt)) byKey.set(k, n);
  }
  return [...byKey.values()];
}

// Write-side dedup: skip creating a notification identical to one emitted within the
// TTL window (races / double emits). Reuses createNotification + FeatureFlags gate.
const DEDUPE_TTL_MS = 15000;
const recent = new Map(); // key -> last emit ms
export async function emitOnce(args = {}, { ttlMs = DEDUPE_TTL_MS } = {}) {
  if (!args.role || !args.type) return null;
  if (!(await isFeatureEnabled("enableNotification"))) return null;
  const key = notifKey(args);
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < ttlMs) return null; // duplicate within window -> skip
  recent.set(key, now);
  if (recent.size > 500) for (const [k, t] of recent) if (now - t > ttlMs) recent.delete(k);
  try {
    return await createNotification(args);
  } catch (e) {
    recent.delete(key);
    logError(e, "emitOnce");
    return null;
  }
}

// Live hook: realtime notifications for the current viewer (any role), deduplicated.
// Reuses useNotifications entirely — one listener, no duplicate query. Recomputes the
// unread badge over the deduped list.
export function useLiveNotifications(opts) {
  const state = useNotifications(opts);
  const notifications = useMemo(() => dedupeNotifications(state.notifications), [state.notifications]);
  const unreadCount = useMemo(() => badgeCount(notifications), [notifications]);
  return { ...state, notifications, unreadCount };
}
