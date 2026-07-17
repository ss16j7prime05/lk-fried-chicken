// Dynamic delivery service area — a road-based (isochrone-style) polygon around the
// store, generated from the store owner's configurable delivery distance (3–20 km).
//
// Why a polygon, not a circle: a straight-line radius over-promises where roads are
// indirect (rivers, highways, dead-ends). We sample N compass bearings and, per bearing,
// binary-search the farthest point whose *road* distance (OSRM, the routing engine the
// app already uses) is within the target km. Connecting those points gives a service
// area that follows real road reach.
//
// Storage: stores/{STORE_ID}.serviceArea = { km, ring: [{lat,lng}, …], generatedAt }.
// Firestore rejects nested arrays, so the ring is an array of {lat,lng} objects.
//
// Safety: every consumer falls back to the radius (store.deliveryRadius, clamped) when
// no polygon is stored, so the order flow behaves exactly as before if generation never
// ran or failed — this feature can never harden the boundary into a broken state.
import { haversineKm, getRoute } from "./locationUtils.js";

export const DELIVERY_MIN_KM = 3;
export const DELIVERY_MAX_KM = 20;
export const DELIVERY_DEFAULT_KM = 8;

// Clamp any stored/typed distance into the supported 3–20 km range.
export const clampDeliveryKm = (km, fallback = DELIVERY_DEFAULT_KM) => {
  const n = Number(km);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(DELIVERY_MAX_KM, Math.max(DELIVERY_MIN_KM, n));
};

const EARTH_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

// Destination point from (lat,lng) along bearing (deg) for distKm — great-circle.
export function destinationPoint(lat, lng, bearingDeg, distKm) {
  const d = distKm / EARTH_KM;
  const th = toRad(bearingDeg);
  const p1 = toRad(lat);
  const l1 = toRad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: toDeg(p2), lng: ((toDeg(l2) + 540) % 360) - 180 };
}

// Ray-casting point-in-polygon. ring = [{lat,lng}, …]. Returns bool.
export function pointInPolygon(lat, lng, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i].lat, xi = ring[i].lng;
    const yj = ring[j].lat, xj = ring[j].lng;
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Leaflet <Polygon positions={...} /> helper — ring objects → [lat,lng] pairs.
export const ringToLatLngs = (ring = []) => ring.map((p) => [p.lat, p.lng]);

// Generate the service-area ring by sampling `bearings` directions. Per bearing, binary
// search the farthest straight-line distance whose road distance ≤ targetKm. getRouteFn
// is injectable so this is unit-testable without the network; on a routing error for a
// sample we fall back to the straight-line distance for that point (conservative).
export async function generateServiceArea(store, km, opts = {}) {
  const { bearings = 16, iterations = 5, getRouteFn = getRoute } = opts;
  if (store?.lat == null || store?.lng == null) return null;
  const targetKm = clampDeliveryKm(km);
  const step = 360 / bearings;

  const reachAlong = async (bearingDeg) => {
    let lo = 0;
    let hi = targetKm; // straight-line ≤ road, so the reachable straight-line ≤ targetKm
    let best = destinationPoint(store.lat, store.lng, bearingDeg, lo);
    for (let i = 0; i < iterations; i++) {
      const mid = (lo + hi) / 2;
      const p = destinationPoint(store.lat, store.lng, bearingDeg, mid);
      let road;
      try {
        const r = await getRouteFn(store.lat, store.lng, p.lat, p.lng);
        road = r?.distanceKm;
      } catch {
        road = mid; // routing failed → treat as straight-line (conservative)
      }
      if (road != null && road <= targetKm) {
        best = p;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return { lat: best.lat, lng: best.lng };
  };

  const ring = await Promise.all(
    Array.from({ length: bearings }, (_, i) => reachAlong(i * step))
  );
  return { km: targetKm, ring, generatedAt: Date.now() };
}

// Is a destination inside the store's delivery service area?
// Prefers the stored polygon; otherwise falls back to the road/straight-line radius
// (store.deliveryRadius, clamped) — identical to the previous behaviour.
export function isInsideServiceArea({ lat, lng, distanceKm = null, store }) {
  const ring = store?.serviceArea?.ring;
  if (Array.isArray(ring) && ring.length >= 3 && lat != null && lng != null) {
    return pointInPolygon(lat, lng, ring);
  }
  const km = clampDeliveryKm(store?.deliveryRadius);
  const d =
    distanceKm != null
      ? Number(distanceKm)
      : store?.lat != null && lat != null
      ? haversineKm(store.lat, store.lng, lat, lng)
      : null;
  return d != null && d <= km;
}
