// Shared Rider Live Tracking (SSOT, Phase 5.0B) — one place to broadcast and read a
// rider's live GPS. Reuses mapsService.watchLocation/stopWatching (no duplicate
// watchPosition), the FeatureFlags SSOT to gate tracking, and the existing rider doc.
// Rider records are users/{uid} (role==rider, where riderStatus already lives), so the
// location fields (currentLocation/heading/speed/accuracy/updatedAt) are ADDED to that
// doc — no new collection. Backward compatible: docs without these fields read as null.
import { useEffect, useState } from "react";
import { doc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { watchLocation, stopWatching } from "../location/mapsService";
import { useFeatureFlags } from "../featureFlags";

const riderRef = (riderId) => doc(db, "users", riderId);

// The ONE writer for rider live location (no duplicate firebase write).
export function updateRiderLocation(riderId, coords) {
  if (!riderId || !coords) return Promise.resolve();
  return updateDoc(riderRef(riderId), {
    currentLocation: { lat: coords.lat, lng: coords.lng },
    heading: coords.heading ?? null,
    speed: coords.speed ?? null,
    accuracy: coords.accuracy ?? null,
    updatedAt: serverTimestamp(),
  });
}

// Start broadcasting this device's GPS to the rider doc. Reuses mapsService.watchLocation.
// Returns a watchId to pass to stopTracking (null if geolocation is unavailable).
export function startTracking(riderId, onError) {
  if (!riderId) return null;
  return watchLocation(
    (coords) => { updateRiderLocation(riderId, coords).catch(() => {}); },
    onError
  );
}

// Stop broadcasting. Reuses mapsService.stopWatching.
export function stopTracking(watchId) {
  stopWatching(watchId);
}

// Subscribe to a rider's live location (read side). Returns an unsubscribe fn.
export function subscribeRiderLocation(riderId, cb) {
  if (!riderId) return () => {};
  return onSnapshot(riderRef(riderId), (snap) => {
    const d = snap.exists() ? snap.data() : null;
    cb(d ? {
      currentLocation: d.currentLocation || null,
      heading: d.heading ?? null,
      speed: d.speed ?? null,
      accuracy: d.accuracy ?? null,
      updatedAt: d.updatedAt || null,
    } : null);
  });
}

// Hook: read a rider's live location, and optionally broadcast this device's GPS.
// Cleanup stops the watch + subscription on unmount (verify unwatch/cleanup). Tracking
// is gated by the enableRealtimeTracking flag.
export function useRiderLocation(riderId, { track = false } = {}) {
  const flags = useFeatureFlags();
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!riderId) return undefined;
    return subscribeRiderLocation(riderId, setLocation);
  }, [riderId]);

  useEffect(() => {
    if (!track || !riderId || !flags.enableRealtimeTracking) return undefined;
    const id = startTracking(riderId);
    return () => stopTracking(id);
  }, [track, riderId, flags.enableRealtimeTracking]);

  return location;
}
