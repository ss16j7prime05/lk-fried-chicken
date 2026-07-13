// Production LINE Login (SSOT, Phase 6.0B) — LIFF/OAuth-ready helper wired into the
// EXISTING auth flow. No new auth logic, listener, or collection: it only obtains a
// LINE profile (userId + displayName) that the current customer flow already stores on
// users/{uid}.lineUserId (see CustomerLogin) and uses for LINE notifications. Config
// comes from the AppConfig SSOT (lineOA section); gated by the FeatureFlags SSOT
// (enableLineOA). All failures route through ErrorCenter. Additive only — Firebase
// Auth stays the auth mechanism; LINE only supplies the LINE identity.
import { loadAppConfig } from "../appConfig";
import { isFeatureEnabled } from "../featureFlags";
import { logError } from "../errorCenter";

const LINE_AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";
const STATE_KEY = "lkfc_line_state";

// Resolve LINE config once from AppConfig. Safe defaults keep pre-existing docs valid.
export async function loadLineConfig() {
  const l = (await loadAppConfig())?.lineOA || {};
  return {
    channelId: l.channelId || l.loginChannelId || "",
    liffId: l.liffId || "",
    redirectUri: l.redirectUri || (typeof window !== "undefined" ? `${window.location.origin}/login` : ""),
    scope: l.scope || "profile openid",
  };
}

// Usable now? (flag on AND a channel/LIFF id configured.)
export async function isLineLoginEnabled() {
  if (!(await isFeatureEnabled("enableLineOA"))) return false;
  const c = await loadLineConfig();
  return Boolean(c.channelId || c.liffId);
}

// Begin LINE login. Uses LIFF if the SDK is present (in-app LINE browser), else the
// standard OAuth 2.1 authorize redirect — hence "LIFF/OAuth ready".
export async function startLineLogin() {
  try {
    if (!(await isLineLoginEnabled())) return false;
    const c = await loadLineConfig();
    if (typeof window !== "undefined" && window.liff && c.liffId) {
      if (!window.liff.__lkfcInit) { await window.liff.init({ liffId: c.liffId }); window.liff.__lkfcInit = true; }
      if (!window.liff.isLoggedIn()) window.liff.login({ redirectUri: c.redirectUri });
      return true;
    }
    const state = Math.random().toString(36).slice(2);
    try { sessionStorage.setItem(STATE_KEY, state); } catch { /* ignore */ }
    const url = `${LINE_AUTHORIZE}?response_type=code`
      + `&client_id=${encodeURIComponent(c.channelId)}`
      + `&redirect_uri=${encodeURIComponent(c.redirectUri)}`
      + `&state=${state}&scope=${encodeURIComponent(c.scope)}`;
    window.location.assign(url);
    return true;
  } catch (e) {
    logError(e, "startLineLogin");
    return false;
  }
}

// After redirect/inside LIFF: read the LINE profile so the existing flow can store
// lineUserId. LIFF returns it directly (no backend); the OAuth code path completes
// server-side, so callers just fall back to null when no profile is available yet.
export async function getLineProfile() {
  try {
    if (typeof window !== "undefined" && window.liff && window.liff.isLoggedIn?.()) {
      const p = await window.liff.getProfile();
      return { lineUserId: p?.userId || "", displayName: p?.displayName || "" };
    }
    return null;
  } catch (e) {
    logError(e, "getLineProfile");
    return null;
  }
}
