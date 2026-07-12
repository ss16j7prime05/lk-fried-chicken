// Shared Feature Flags (SSOT, Phase 4.4) — one place for every system feature toggle.
// Reuses the AppConfig SSOT (Phase 4.2): flags live in the `features` section of the
// existing stores/{STORE_ID} config doc, loaded ONCE and cached by loadAppConfig — so
// there is no duplicate fetch, config, hook, or constant here. Permission stays the
// separate SSOT (permissions.js); call sites compose feature + permission as needed.
import { useMemo } from "react";
import { loadAppConfig, useAppConfig } from "./appConfig";

// Defaults mirror current live behavior, so a config doc WITHOUT a `features` field
// keeps working unchanged (backward compatible). Config overrides these per flag.
export const DEFAULT_FLAGS = {
  enableAI: false,
  enableLineOA: false,
  enableGoogleMaps: true,
  enableRealtimeTracking: true,
  enableAnalytics: true,
  enableRefund: true,
  enableNotification: true,
  enableMaintenance: false,
  enableStoreRegister: true,
  enableRiderRegister: true,
  enableAutoDispatch: false,
};

// Merge defaults <- config.features. Single resolver reused by both the async check
// and the hook, so flag logic is never duplicated.
export const resolveFlags = (features) => ({ ...DEFAULT_FLAGS, ...(features || {}) });

// Async one-shot check (non-React callers). Shares the AppConfig cache — read once.
export async function isFeatureEnabled(flag) {
  const config = await loadAppConfig();
  return Boolean(resolveFlags(config?.features)[flag]);
}

// React hook: resolved flags for the current config. Reuses useAppConfig (cached),
// falling back to DEFAULT_FLAGS while config loads — no extra fetch, no duplicate hook.
export function useFeatureFlags() {
  const config = useAppConfig();
  return useMemo(() => resolveFlags(config?.features), [config]);
}
