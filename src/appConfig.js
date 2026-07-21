// Shared AppConfig (SSOT, Phase 4.2) — one cached, read-once load of the existing
// stores/{STORE_ID} document (the system's config doc). Every role (Customer / Store /
// Rider / Admin) reads config from here instead of re-fetching stores/ or re-declaring
// constants. Reuses the Firebase service (db) and the static defaults in ./config.
// No new collection: the optional sections (googleMaps / lineOA / ai / delivery /
// features) are additive fields on the same doc, read with safe defaults so any
// pre-existing doc without them stays fully backward-compatible.
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  STORE_ID, PROMPTPAY_ID, PROMPTPAY_ACCOUNT_NAME, EST_PREP_MINUTES,
} from "./config";

// Normalize the raw stores/{STORE_ID} data into config sections. Missing fields fall
// back to the static defaults from ./config, so pre-existing docs keep working.
export function normalizeConfig(data) {
  const d = data || {};
  return {
    store: {
      id: STORE_ID,
      name: d.storeName || PROMPTPAY_ACCOUNT_NAME,
      phone: d.phone || "", // เบอร์ร้านจาก Firestore เท่านั้น — ไม่มี placeholder
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      isOpen: d.isOpen ?? true,
      storeHours: d.storeHours || null,
      deliveryHours: d.deliveryHours || null,
      holidays: d.holidays || [],
    },
    payment: {
      promptpayId: d.paymentSettings?.promptpayId || PROMPTPAY_ID,
      promptpayName: d.paymentSettings?.promptpayName || PROMPTPAY_ACCOUNT_NAME,
      ...(d.paymentSettings || {}),
    },
    googleMaps: d.googleMaps || {},
    lineOA: d.lineOA || {},
    ai: d.ai || {},
    notification: d.notificationSettings || {},
    delivery: {
      prepMinutes: d.delivery?.prepMinutes ?? EST_PREP_MINUTES,
      ...(d.delivery || {}),
    },
    features: d.features || {},
  };
}

let cache = null;     // resolved AppConfig (read once)
let inflight = null;  // shared promise so concurrent callers never double-fetch

// One-shot cached read. Concurrent callers share the same in-flight promise.
export async function loadAppConfig() {
  if (cache) return cache;
  if (!inflight) {
    inflight = getDoc(doc(db, "stores", STORE_ID))
      .then((snap) => {
        cache = normalizeConfig(snap.exists() ? snap.data() : null);
        inflight = null;
        return cache;
      })
      .catch((e) => { inflight = null; throw e; });
  }
  return inflight;
}

// Lets Settings drop the cache after saving config so the next read reflects edits.
export function clearAppConfigCache() { cache = null; inflight = null; }

// React hook: shared read-once config. Every role gets the same cached object, so
// there is no duplicate fetch, no duplicate constants, and no duplicate hook.
export function useAppConfig() {
  const [config, setConfig] = useState(cache);
  useEffect(() => {
    if (config) return;
    let alive = true;
    loadAppConfig().then((c) => { if (alive) setConfig(c); }).catch(() => {});
    return () => { alive = false; };
  }, [config]);
  return config;
}
