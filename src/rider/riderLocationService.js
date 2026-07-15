// Shared Rider Live Tracking (SSOT, Phase 5.0B) — one place to broadcast and read a
// rider's live GPS. Reuses mapsService.watchLocation/stopWatching (no duplicate
// watchPosition), the FeatureFlags SSOT to gate tracking, and the existing rider doc.
// Rider records are users/{uid} (role==rider, where riderStatus already lives), so the
// location fields (currentLocation/heading/speed/accuracy/updatedAt) are ADDED to that
// doc — no new collection. Backward compatible: docs without these fields read as null.
import { useEffect, useRef, useState } from "react";
import { doc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { getCurrentLocation, watchLocation, stopWatching } from "../location/mapsService";
import { getRoute, haversineKm } from "../location/locationUtils";
import { useFeatureFlags } from "../featureFlags";
import { logError } from "../errorCenter";

const riderRef = (riderId) => doc(db, "users", riderId);

// จังหวะกระจายตำแหน่งระหว่างส่ง (เท่าเดิมกับที่ RiderOrderCard เคยใช้ ไม่เปลี่ยนพฤติกรรม)
const BROADCAST_INTERVAL_MS = 5000;

// จุดส่งของออเดอร์ รองรับทั้ง schema ใหม่ (deliveryLocation) และฟิลด์เดิม
// อยู่ที่นี่เพราะทั้งการ์ด (วาดแผนที่) และ Dashboard (กระจายตำแหน่ง) ต้องใช้ตัวเดียวกัน
export const getDestination = (order) => ({
  lat: order.deliveryLocation?.lat ?? order.lat ?? order.latitude,
  lng: order.deliveryLocation?.lng ?? order.lng ?? order.longitude,
  address: order.deliveryLocation?.address || order.deliveryAddress || order.address,
});

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
  }, (e) => logError(e, "subscribeRiderLocation"));
}

// ── Per-delivery broadcast (orders/{id}.riderLocation) ──
// คนละฟิลด์กับ currentLocation ข้างบน: อันนี้ผูกกับ "ออเดอร์" และมีระยะทาง/ETA ถึงจุดส่งด้วย
// เป็นสิ่งที่หน้า /shop/orders/:orderId ของลูกค้าอ่านไปวาดแผนที่ติดตาม + ETA
// เดิม logic นี้ฝังอยู่ใน RiderOrderCard (เรียก navigator.geolocation เอง = ซ้ำกับ mapsService)
// ย้ายมารวมที่นี่ซึ่งเป็น SSOT ของตำแหน่งไรเดอร์ และใช้ mapsService/locationUtils แทนของซ้ำ

// ระยะทาง + ETA ที่เหลือถึงจุดส่ง: ใช้เส้นทางจริง (OSRM) ถ้าได้ ไม่ได้ก็ตกไปเป็นเส้นตรง
async function routeToDest(coords, dest) {
  try {
    const r = await getRoute(coords.lat, coords.lng, dest.lat, dest.lng);
    return {
      remainingDistance: r.distanceKm,
      estimatedArrival: new Date(Date.now() + r.durationMin * 60000).toISOString(),
    };
  } catch {
    return {
      remainingDistance: haversineKm(coords.lat, coords.lng, dest.lat, dest.lng),
      estimatedArrival: null,
    };
  }
}

// The ONE writer for orders/{id}.riderLocation (รูปร่างฟิลด์เท่าเดิมกับของเดิมทุกประการ)
export async function updateOrderLocation(orderId, coords, dest) {
  if (!orderId || !coords) return;
  const { remainingDistance, estimatedArrival } = await routeToDest(coords, dest);
  await updateDoc(doc(db, "orders", orderId), {
    riderLocation: {
      lat: coords.lat,
      lng: coords.lng,
      heading: coords.heading ?? null,
      speed: coords.speed ?? null,
      updatedAt: serverTimestamp(),
      estimatedArrival,
      remainingDistance,
    },
  });
}

// กุญแจของรอบกระจายตำแหน่ง: เปลี่ยนก็ต่อเมื่อ "ชุดงาน/จุดส่ง" เปลี่ยนจริงเท่านั้น
// สำคัญมาก: การเขียน riderLocation ทุก 5 วิ ทำให้ order snapshot เด้งและ array ถูกสร้างใหม่ทุกครั้ง
// ถ้าเอา array ไปเป็น dependency ตรง ๆ interval จะถูก clear/set ใหม่ไม่รู้จบ (ยิงถี่กว่าที่ตั้งไว้)
export const broadcastSignature = (deliveries = []) =>
  deliveries.map((d) => `${d.id}:${d.lat},${d.lng}`).join("|");

// Hook: กระจายตำแหน่งของงานที่ "กำลังจัดส่ง" อยู่ ให้ลูกค้าติดตามได้
// deliveries = [{ id, lat, lng }] (จุดส่งของแต่ละออเดอร์)
// สำคัญ: ต้องถูกเรียกจากที่ที่ไม่ unmount ตามแท็บ ไม่งั้นไรเดอร์สลับแท็บแล้วแผนที่ลูกค้าค้าง
// อ่านพิกัดครั้งเดียวต่อรอบแล้วเขียนให้ทุกออเดอร์ (เดิมการ์ดแต่ละใบอ่าน GPS แยกกันเอง)
export function useDeliveryBroadcast(deliveries, enabled = true) {
  // เก็บ list ล่าสุดไว้ใน ref: ออเดอร์ถูกเขียน riderLocation ทุก 5 วิ -> snapshot เด้ง ->
  // array identity เปลี่ยนทุกครั้ง ถ้า effect ผูกกับ identity ตรง ๆ interval จะถูกรีเซ็ตไม่รู้จบ
  const latest = useRef(deliveries);
  useEffect(() => {
    latest.current = deliveries;
  }, [deliveries]);

  // ผูก effect กับ signature (id+จุดส่ง) เท่านั้น — เนื้อหาเปลี่ยนจริงถึงจะเริ่มรอบใหม่
  const signature = broadcastSignature(deliveries);

  useEffect(() => {
    if (!enabled || !signature) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const coords = await getCurrentLocation();
        if (cancelled) return;
        // ออเดอร์ใบไหนพังไม่ควรทำให้ใบอื่นไม่ได้อัปเดต
        await Promise.all(
          latest.current.map((d) =>
            updateOrderLocation(d.id, coords, { lat: d.lat, lng: d.lng }).catch((e) =>
              logError(e, "useDeliveryBroadcast.write")
            )
          )
        );
      } catch (e) {
        // GPS ปฏิเสธ/หมดเวลา — log แล้วปล่อยให้รอบถัดไปลองใหม่ (เดิม await ลอย = unhandled rejection)
        logError(e, "useDeliveryBroadcast.position");
      }
    };

    tick();
    const id = setInterval(tick, BROADCAST_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, signature]);
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
