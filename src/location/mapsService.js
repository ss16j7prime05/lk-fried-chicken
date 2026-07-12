// Shared MapsService (SSOT, Phase 5.0A) — one place for Google Maps loading, browser
// geolocation, and distance/ETA. Reuses the existing distance SSOT (haversineKm +
// OSRM getRoute in ./locationUtils) so distance/ETA math is never re-implemented, the
// AppConfig SSOT for the Maps API key, and the FeatureFlags SSOT to gate loading.
// Additive foundation: the Google Maps loader is new (app currently uses Leaflet), and
// the geolocation wrappers centralize the navigator.geolocation calls duplicated across
// screens. Backward compatible — with no key / flag off, loadGoogleMaps() returns null
// and nothing else changes.
import { useEffect, useState } from "react";
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
