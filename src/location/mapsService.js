// Shared MapsService (SSOT, Phase 5.0A) — one place for Google Maps loading, browser
// geolocation, and distance/ETA. Reuses the existing distance SSOT (haversineKm +
// OSRM getRoute in ./locationUtils) so distance/ETA math is never re-implemented, the
// AppConfig SSOT for the Maps API key, and the FeatureFlags SSOT to gate loading.
// Additive foundation: the Google Maps loader is new (app currently uses Leaflet), and
// the geolocation wrappers centralize the navigator.geolocation calls duplicated across
// screens. Backward compatible — with no key / flag off, loadGoogleMaps() returns null
// and nothing else changes.
import { useCallback, useEffect, useState } from "react";
import { haversineKm, getRoute } from "./locationUtils";
import { loadAppConfig } from "../appConfig";
import { isFeatureEnabled } from "../featureFlags";

const hasGeo = () => typeof navigator !== "undefined" && !!navigator.geolocation;
const mapsReady = () => (typeof window !== "undefined" ? window.google?.maps || null : null);
const toCoords = (pos) => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  heading: pos.coords.heading ?? null,
  speed: pos.coords.speed ?? null,
});
const GEO_OPTS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 4000 };

// ── Distance / ETA (reuse locationUtils — no duplicate math) ──
// Straight-line km.
export const calculateDistance = (lat1, lng1, lat2, lng2) => haversineKm(lat1, lng1, lat2, lng2);

// Minutes. Prefers real road duration (OSRM); falls back to haversine @ ~30 km/h.
export async function calculateETA(fromLat, fromLng, toLat, toLng) {
  try {
    const { durationMin } = await getRoute(fromLat, fromLng, toLat, toLng);
    return durationMin;
  } catch {
    return Math.max(1, Math.round((haversineKm(fromLat, fromLng, toLat, toLng) / 30) * 60));
  }
}

// ── Google Maps loader (single shared promise — no duplicate loader) ──
let mapsPromise = null;
export async function loadGoogleMaps() {
  const ready = mapsReady();
  if (ready) return ready;
  if (mapsPromise) return mapsPromise;
  if (!(await isFeatureEnabled("enableGoogleMaps"))) return null;
  const config = await loadAppConfig();
  const apiKey = config?.googleMaps?.apiKey;
  if (!apiKey || typeof document === "undefined") return null;
  mapsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(mapsReady());
    s.onerror = (e) => { mapsPromise = null; reject(e); };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

// React hook: resolves to window.google.maps once loaded (null while unavailable).
// Reuses loadGoogleMaps (shared promise) — no duplicate loader/hook.
export function useGoogleMaps() {
  const [maps, setMaps] = useState(mapsReady);
  useEffect(() => {
    if (maps) return;
    let alive = true;
    loadGoogleMaps().then((m) => { if (alive) setMaps(m); }).catch(() => {});
    return () => { alive = false; };
  }, [maps]);
  return maps;
}

// ── Google Maps deep links (SSOT — MapButton สร้าง URL เองไม่ได้) ──
// ใช้ Google Maps URLs API (https) ตัวเดียว: บนมือถือ ลิงก์นี้จะเปิด "แอป Google Maps" จริง
// ถ้าติดตั้งไว้ ไม่ใช่หน้าเว็บ — และบนเดสก์ท็อปก็ยังเปิดเว็บได้ ไม่ต้องแยก scheme ราย OS
const MAPS_BASE = "https://www.google.com/maps";

// พิกัดใช้ได้ไหม — เก็บ semantics เดิมของ MapButton ไว้เป๊ะ (บาง doc เก็บ lat/lng เป็น string
// ถ้าเปลี่ยนไปใช้ Number.isFinite จะทำให้ร้าน/ลูกค้าที่ข้อมูลเป็น string พังทันที)
export const hasCoords = (lat, lng) =>
  lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

// นำทางจริง (turn-by-turn): dir_action=navigate สั่งให้ Google Maps "เริ่มนำทางเลย"
// ไม่ใช่แค่โชว์เส้นทางให้ดูแล้วรอกดเริ่มอีกที — ไรเดอร์กดครั้งเดียวได้เสียงนำทางทันที
// ไม่ส่ง origin: ปล่อยให้ Google Maps ใช้ตำแหน่งปัจจุบันของเครื่องเอง (แม่นกว่าและไม่ต้องขอสิทธิ์ในแอปเรา)
export function buildNavigationUrl({ lat, lng, address } = {}) {
  const dest = hasCoords(lat, lng)
    ? `${lat},${lng}`
    : address
    ? encodeURIComponent(address)
    : null;
  if (!dest) return null;
  return `${MAPS_BASE}/dir/?api=1&destination=${dest}&travelmode=driving&dir_action=navigate`;
}

// เปิดดูตำแหน่งเฉย ๆ (พฤติกรรมเดิมทุกประการ — ใช้ร่วมกับ Store/Admin/Customer อยู่ ห้ามเปลี่ยน)
export function buildViewUrl({ lat, lng, address, mapLink } = {}) {
  if (mapLink) return mapLink;
  if (hasCoords(lat, lng)) return `${MAPS_BASE}?q=${lat},${lng}`;
  if (address) return `${MAPS_BASE}/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
}

// ── Geolocation permission / error state (SSOT) ──
// ทำไมต้องมี: การกระจายตำแหน่งของไรเดอร์ (useDeliveryBroadcast) ล้มเหลว "เงียบ ๆ" ได้
// ถ้า GPS ถูกปิด/ถูกบล็อก ลูกค้าจะไม่เห็นไรเดอร์เลย แต่ไรเดอร์เองไม่รู้ตัว ต้องบอกให้รู้
export const GEO_STATE = {
  GRANTED: "granted",
  DENIED: "denied",
  PROMPT: "prompt",
  UNAVAILABLE: "unavailable", // GPS ปิดอยู่ / หาตำแหน่งไม่เจอ
  TIMEOUT: "timeout",
  UNSUPPORTED: "unsupported",
  UNKNOWN: "unknown",
};

// แปลง GeolocationPositionError -> สาเหตุที่สื่อความหมาย (ค่า code ตามสเปกเบราว์เซอร์)
export function classifyGeoError(err) {
  if (!err) return null;
  if (err.code === 1) return GEO_STATE.DENIED; // PERMISSION_DENIED
  if (err.code === 2) return GEO_STATE.UNAVAILABLE; // POSITION_UNAVAILABLE (GPS ปิด)
  if (err.code === 3) return GEO_STATE.TIMEOUT; // TIMEOUT
  if (!hasGeo()) return GEO_STATE.UNSUPPORTED;
  return GEO_STATE.UNKNOWN;
}

// อ่านสิทธิ์ location แบบไม่เด้ง prompt — Permissions API ไม่มีใน Safari/iOS บางเวอร์ชัน
// จึงต้องมี fallback เป็น UNKNOWN (ห้าม assume ว่า denied ไม่งั้น iPhone จะขึ้นเตือนผิด ๆ ทั้งที่ใช้ได้)
export async function getGeolocationPermission() {
  if (!hasGeo()) return GEO_STATE.UNSUPPORTED;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state; // granted | denied | prompt
  } catch {
    return GEO_STATE.UNKNOWN;
  }
}

// Hook: สถานะสิทธิ์ location + ช่องให้ผู้เรียก "รายงานความจริง" จากการอ่าน GPS จริง
// (บน iOS ที่ไม่มี Permissions API ค่า error จริงจาก getCurrentLocation คือแหล่งเดียวที่เชื่อได้)
export function useGeolocationStatus() {
  const [state, setState] = useState(GEO_STATE.UNKNOWN);

  useEffect(() => {
    let alive = true;
    let status = null;
    const sync = () => { if (alive && status) setState(status.state); };
    getGeolocationPermission().then((s) => { if (alive) setState(s); });
    // ผู้ใช้กดสลับสิทธิ์ใน browser ระหว่างใช้งาน -> อัปเดตทันทีโดยไม่ต้องรีเฟรช
    navigator.permissions?.query?.({ name: "geolocation" })
      .then((s) => { status = s; s.addEventListener?.("change", sync); })
      .catch(() => {});
    return () => {
      alive = false;
      status?.removeEventListener?.("change", sync);
    };
  }, []);

  // ขอสิทธิ์จริง (เด้ง prompt) — ใช้กับปุ่ม "เปิดการเข้าถึงตำแหน่ง"
  const request = useCallback(async () => {
    try {
      await getCurrentLocation();
      setState(GEO_STATE.GRANTED);
      return GEO_STATE.GRANTED;
    } catch (err) {
      const s = classifyGeoError(err) || GEO_STATE.UNKNOWN;
      setState(s);
      return s;
    }
  }, []);

  // ให้ผู้เรียกป้อนผลลัพธ์จริงจากการอ่าน GPS (สำเร็จ = granted, ล้มเหลว = สาเหตุที่แท้จริง)
  const report = useCallback((err) => {
    setState(err ? classifyGeoError(err) || GEO_STATE.UNKNOWN : GEO_STATE.GRANTED);
  }, []);

  return { state, request, report };
}

// ── Geolocation (single SSOT wrapper — no duplicate navigator.geolocation) ──
export function getCurrentLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!hasGeo()) { reject(new Error("Geolocation unsupported")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toCoords(pos)),
      reject,
      { ...GEO_OPTS, ...options }
    );
  });
}

// Returns a watchId (pass to stopWatching). Returns null if geolocation is unavailable.
export function watchLocation(onUpdate, onError, options = {}) {
  if (!hasGeo()) { onError?.(new Error("Geolocation unsupported")); return null; }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate?.(toCoords(pos)),
    (err) => onError?.(err),
    { ...GEO_OPTS, ...options }
  );
}

export function stopWatching(watchId) {
  if (watchId != null && hasGeo()) navigator.geolocation.clearWatch(watchId);
}
