// ค่าคงที่/ฟังก์ชันกลางสำหรับระบบตำแหน่งจัดส่ง ใช้ร่วมกันทั้ง Customer/Store/Rider/Admin

export const calcDeliveryFee = (distanceKm) =>
  distanceKm <= 3 ? 20 : 20 + Math.round((distanceKm - 3) * 10);

// ระยะทางแบบเส้นตรง (กม.) - ใช้เป็น fallback เมื่อ routing API ใช้ไม่ได้
export const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ระยะทาง + เวลาเดินทางจริงตามถนน (OSRM) จากร้าน -> ปลายทาง
// คืนค่า { distanceKm, durationMin } หรือ throw ถ้า routing ใช้ไม่ได้ (ให้ผู้เรียก fallback เป็น haversine เอง)
export async function getRoute(storeLat, storeLng, destLat, destLng) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${storeLng},${storeLat};${destLng},${destLat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("OSRM error: " + res.status);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error("No route in response");
  return {
    distanceKm: route.distance / 1000,
    durationMin: Math.round(route.duration / 60),
  };
}

export const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await res.json();
    return data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
};

// ค้นหาที่อยู่ด้วยข้อความ (forward geocoding) คืนค่า [{lat, lng, displayName}]
export const searchAddress = async (queryText) => {
  if (!queryText?.trim()) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        queryText.trim()
      )}&limit=5`
    );
    const data = await res.json();
    return (data || []).map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
    }));
  } catch {
    return [];
  }
};
