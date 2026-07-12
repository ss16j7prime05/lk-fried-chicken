// Shared Route + ETA Engine (SSOT, Phase 5.0D) — one place to get a route, ETA,
// distance, or polyline between two points. Reuses the existing OSRM implementation
// (locationUtils.getRoute) and haversine, plus mapsService.calculateDistance/
// calculateETA — so distance/ETA/route math is never re-implemented. Pure routing over
// coordinates: it touches no Firestore (read-only, no writes, no new collection).
// FeatureFlags/AppConfig remain the separate SSOTs; routing here is provider-agnostic
// (OSRM) and needs no config, so it is not coupled to them.
import { haversineKm, getRoute as osrmRoute } from "./locationUtils";
import { calculateDistance, calculateETA } from "./mapsService";

const norm = (p) => (p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null);

// Straight-line distance (km). Reuses mapsService (haversine SSOT).
export function getDistance(from, to) {
  const a = norm(from), b = norm(to);
  return a && b ? calculateDistance(a.lat, a.lng, b.lat, b.lng) : null;
}

// ETA (minutes). Reuses mapsService (OSRM route + haversine fallback).
export async function getETA(from, to) {
  const a = norm(from), b = norm(to);
  return a && b ? calculateETA(a.lat, a.lng, b.lat, b.lng) : null;
}

// Full route { distanceKm, durationMin }. Reuses the existing OSRM implementation;
// falls back to haversine so callers always get a value (no duplicate route logic).
export async function getRoute(from, to) {
  const a = norm(from), b = norm(to);
  if (!a || !b) return null;
  try {
    return await osrmRoute(a.lat, a.lng, b.lat, b.lng);
  } catch {
    const distanceKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
    return { distanceKm, durationMin: Math.max(1, Math.round((distanceKm / 30) * 60)) };
  }
}

// Route geometry as [[lat,lng], ...]. Requests OSRM geometry (locationUtils.getRoute
// uses overview=false, so this is the only geometry path — no duplicate parser).
// Falls back to a straight line between the two points.
export async function getPolyline(from, to) {
  const a = norm(from), b = norm(to);
  if (!a || !b) return [];
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const coords = (await res.json())?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length) return coords.map(([lng, lat]) => [lat, lng]);
    throw new Error("no geometry");
  } catch {
    return [[a.lat, a.lng], [b.lat, b.lng]];
  }
}

// Poll route + polyline on an interval (realtime-ish, since OSRM has no push channel).
// Returns a stop() cleanup that cancels the interval (verify cleanup).
export function subscribeRoute(from, to, cb, { intervalMs = 15000 } = {}) {
  let stopped = false;
  const tick = async () => {
    const [route, polyline] = await Promise.all([getRoute(from, to), getPolyline(from, to)]);
    if (!stopped) cb({ route, polyline });
  };
  tick();
  const id = setInterval(tick, intervalMs);
  return () => { stopped = true; clearInterval(id); };
}
