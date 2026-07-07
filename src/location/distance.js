import { getRoute, haversineKm } from "./locationUtils";

// Road distance (km) from the store to a point using OSRM routing, falling back to
// straight-line haversine if routing is unavailable. Reuses the shared locationUtils
// helpers so distance is computed the same way everywhere (Checkout, address save).
export async function distanceFromStore(storeLat, storeLng, lat, lng) {
  try {
    const { distanceKm } = await getRoute(storeLat, storeLng, lat, lng);
    return distanceKm;
  } catch {
    return haversineKm(storeLat, storeLng, lat, lng);
  }
}
