// Shared Health Dashboard (SSOT, Phase 4.6) — one place to read overall system
// health. Composes the existing SSOTs instead of adding new checks/reads:
//   firestore   -> loadAppConfig() (AppConfig's single cached read; success = reachable)
//   auth        -> the existing Firebase auth service
//   payment     -> AppConfig.payment (promptpay configured?)
//   notification-> FeatureFlags (enableNotification)
// Failures are routed through ErrorCenter. No new Firestore collection, no duplicate
// health check / read / config / hook.
import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { loadAppConfig } from "./appConfig";
import { resolveFlags } from "./featureFlags";
import { reportError } from "./errorCenter";

// Async system-health snapshot. Reuses the AppConfig cache for the Firestore probe,
// so this does not issue a duplicate read.
export async function getSystemHealth() {
  let config = null;
  let firestoreStatus = "ok";
  try {
    config = await loadAppConfig();
  } catch (e) {
    reportError(e, "healthCheck:firestore");
    firestoreStatus = "down";
  }

  const flags = resolveFlags(config?.features);
  const authStatus = auth ? "ok" : "down";
  const paymentStatus = config?.payment?.promptpayId ? "ok" : "unknown";
  const notificationStatus = flags.enableNotification ? "ok" : "disabled";

  const serviceStatus = {
    firestore: firestoreStatus,
    auth: authStatus,
    payment: paymentStatus,
    notification: notificationStatus,
  };

  const values = Object.values(serviceStatus);
  const healthSummary = values.includes("down")
    ? "down"
    : values.every((s) => s === "ok" || s === "disabled")
    ? "ok"
    : "degraded";

  return {
    healthSummary,
    serviceStatus,
    firestoreStatus,
    authStatus,
    paymentStatus,
    notificationStatus,
    signedIn: Boolean(auth?.currentUser),
    checkedAt: Date.now(),
  };
}

// React hook: runs one health snapshot on mount. Reuses getSystemHealth (which reuses
// the cached AppConfig), so mounting it costs no extra Firebase read.
export function useHealth() {
  const [health, setHealth] = useState(null);
  useEffect(() => {
    let alive = true;
    getSystemHealth().then((h) => { if (alive) setHealth(h); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return health;
}
