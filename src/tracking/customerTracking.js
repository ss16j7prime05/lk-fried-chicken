// Shared Customer Live Tracking (SSOT, Phase 5.0C) — one place for the customer side
// of live rider tracking. Reuses mapsService.calculateDistance/calculateETA (no
// duplicate distance/ETA math), riderLocationService.subscribeRiderLocation for the
// rider-doc fallback (no duplicate listener/service), Firebase onSnapshot, and the
// FeatureFlags SSOT. Reads existing fields only — orders.riderLocation (legacy
// riderLat/riderLng) and users/{rider}.currentLocation. No new collection; additive.
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { calculateDistance, calculateETA } from "../location/mapsService";
import { subscribeRiderLocation } from "../rider/riderLocationService";
import { useFeatureFlags } from "../featureFlags";
import { logError } from "../errorCenter";

// Subscribe to an order's live rider location (reuses the existing order listener
// pattern). cb gets { riderLocation, riderId, estimatedArrival, remainingDistance }.
export function subscribeOrderLocation(orderId, cb) {
  if (!orderId) return () => {};
  return onSnapshot(doc(db, "orders", orderId), (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const o = snap.data();
    const rl = o.riderLocation;
    const riderLocation = rl?.lat != null
      ? { lat: rl.lat, lng: rl.lng }
      : (o.riderLat != null && o.riderLng != null ? { lat: o.riderLat, lng: o.riderLng } : null);
    cb({
      riderLocation,
      riderId: o.riderId || null,
      estimatedArrival: rl?.estimatedArrival ?? null,
      remainingDistance: rl?.remainingDistance ?? null,
    });
  }, (e) => logError(e, "subscribeOrderLocation"));
}

// Straight-line remaining distance (km). Reuses mapsService (haversine SSOT).
export function calculateRemainingDistance(riderLoc, destLoc) {
  if (!riderLoc?.lat || !destLoc?.lat) return null;
  return calculateDistance(riderLoc.lat, riderLoc.lng, destLoc.lat, destLoc.lng);
}

// Remaining ETA (minutes). Reuses mapsService (OSRM route + haversine fallback).
export async function calculateRemainingETA(riderLoc, destLoc) {
  if (!riderLoc?.lat || !destLoc?.lat) return null;
  return calculateETA(riderLoc.lat, riderLoc.lng, destLoc.lat, destLoc.lng);
}

// Hook: live rider location for an order + remaining distance/ETA to the customer.
// Prefers the per-order riderLocation, falling back to the rider doc's currentLocation
// (reusing riderLocationService). Cleans up all listeners on unmount. Gated by the
// enableRealtimeTracking flag.
export function useCustomerTracking(orderId, customerLocation) {
  const flags = useFeatureFlags();
  const [orderLoc, setOrderLoc] = useState(null);
  const [riderDocLoc, setRiderDocLoc] = useState(null);
  const [metrics, setMetrics] = useState({ remainingDistance: null, remainingETA: null });

  useEffect(() => {
    if (!orderId || !flags.enableRealtimeTracking) return undefined;
    return subscribeOrderLocation(orderId, setOrderLoc);
  }, [orderId, flags.enableRealtimeTracking]);

  const riderId = orderLoc?.riderId || null;
  const orderRiderLoc = orderLoc?.riderLocation || null;

  useEffect(() => {
    if (!riderId || orderRiderLoc) return undefined;
    const unsub = subscribeRiderLocation(riderId, (d) => setRiderDocLoc(d?.currentLocation || null));
    return () => { unsub(); setRiderDocLoc(null); };
  }, [riderId, orderRiderLoc]);

  const riderLocation = orderRiderLoc || riderDocLoc || null;
  const rLat = riderLocation?.lat;
  const rLng = riderLocation?.lng;
  const cLat = customerLocation?.lat;
  const cLng = customerLocation?.lng;

  useEffect(() => {
    let alive = true;
    if (rLat != null && cLat != null) {
      const remainingDistance = calculateDistance(rLat, rLng, cLat, cLng);
      calculateETA(rLat, rLng, cLat, cLng).then((remainingETA) => {
        if (alive) setMetrics({ remainingDistance, remainingETA });
      });
    }
    return () => { alive = false; };
  }, [rLat, rLng, cLat, cLng]);

  return { riderLocation, ...metrics };
}
