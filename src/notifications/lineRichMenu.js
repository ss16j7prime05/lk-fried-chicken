// Production LINE Rich Menu (SSOT, Phase 6.0D) — one shared Rich Menu helper for the
// customer LINE OA. Reuses the LINE SSOT: lineAuth (LIFF + config), AppConfig
// (lineOA / store), FeatureFlags (enableLineOA gate) and ErrorCenter. Additive: builds
// a Messaging-API Rich Menu object and resolves LIFF-ready target URLs — no new
// listener, builder, or collection. Feature-flagged + fail-soft -> backward compatible.
import { loadAppConfig } from "../appConfig";
import { loadLineConfig } from "../login/lineAuth";
import { isFeatureEnabled } from "../featureFlags";
import { logError } from "../errorCenter";

// The 5 shared menu items. `path` resolves against the app origin; Contact Store uses
// the store phone (tel:) from AppConfig. Config (lineOA.richMenu) can override any path.
export const RICH_MENU_ITEMS = [
  { key: "home",     label: "หน้าแรก",     path: "/" },
  { key: "orders",   label: "ออเดอร์",      path: "/shop/orders" },
  { key: "tracking", label: "ติดตามสถานะ",  path: "/shop/tracking" },
  { key: "profile",  label: "โปรไฟล์",      path: "/shop/profile" },
  { key: "contact",  label: "ติดต่อร้าน",   path: "contact" }, // special -> tel:
];

const originOf = (c) => {
  if (c?.redirectUri) { try { return new URL(c.redirectUri).origin; } catch { /* ignore */ } }
  return typeof window !== "undefined" ? window.location.origin : "";
};

// Resolve one item's target URL. Reuses AppConfig (store phone for Contact Store,
// optional lineOA.richMenu path overrides) + lineAuth config for the origin.
export async function resolveRichMenuTarget(key) {
  const cfg = await loadAppConfig();
  const line = await loadLineConfig();
  const item = RICH_MENU_ITEMS.find((i) => i.key === key);
  if (!item) return "";
  const path = cfg?.lineOA?.richMenu?.[key] || item.path;
  if (key === "contact" && !/^https?:|^tel:/.test(path)) {
    const phone = cfg?.store?.phone || "";
    return phone ? `tel:${phone}` : `${originOf(line)}/`;
  }
  if (/^https?:|^tel:/.test(path)) return path;
  return `${originOf(line)}${path.startsWith("/") ? "" : "/"}${path}`;
}

// The ONE shared Rich Menu builder — Messaging-API object, 5 equal columns (2500x843).
// Area URIs come from resolveRichMenuTarget (config-derived), so no duplicate mapping.
export async function buildRichMenu() {
  const width = 2500, height = 843, cols = RICH_MENU_ITEMS.length;
  const cw = Math.floor(width / cols);
  const areas = await Promise.all(RICH_MENU_ITEMS.map(async (item, i) => ({
    bounds: { x: i * cw, y: 0, width: i === cols - 1 ? width - cw * (cols - 1) : cw, height },
    action: { type: "uri", label: item.label, uri: await resolveRichMenuTarget(item.key) },
  })));
  return { size: { width, height }, selected: true, name: "LKFC Main", chatBarText: "เมนู", areas };
}

// Enabled? flag on AND LINE configured (reuse lineAuth config) — no duplicate flag.
export async function isRichMenuEnabled() {
  if (!(await isFeatureEnabled("enableLineOA"))) return false;
  const c = await loadLineConfig();
  return Boolean(c.channelId || c.liffId);
}

// LIFF-ready navigation for a menu tap: liff.openWindow inside LINE, else normal
// navigation. Feature-flagged + fail-soft; flag OFF -> false (backward compatible).
export async function openRichMenuTarget(key) {
  try {
    if (!(await isRichMenuEnabled())) return false;
    const url = await resolveRichMenuTarget(key);
    if (!url) return false;
    if (typeof window !== "undefined" && window.liff?.openWindow) {
      window.liff.openWindow({ url, external: /^tel:/.test(url) });
    } else if (typeof window !== "undefined") {
      window.location.assign(url);
    }
    return true;
  } catch (e) {
    logError(e, "openRichMenuTarget");
    return false;
  }
}
