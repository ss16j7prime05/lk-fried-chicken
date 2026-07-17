// Offline unit tests for the dynamic delivery service-area logic.
// Run with: npm test   (plain node — no test framework needed)
// The OSRM network call is dependency-injected (getRouteFn), so the road-based
// generation is exercised without any network access.
import {
  destinationPoint, pointInPolygon, generateServiceArea, isInsideServiceArea, clampDeliveryKm,
} from "../src/location/serviceArea.js";
import { haversineKm } from "../src/location/locationUtils.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };

// 1. destinationPoint direction + distance
const east = destinationPoint(13.8, 100.0, 90, 1);
ok(Math.abs(east.lat - 13.8) < 0.01 && east.lng > 100.0, "bearing 90 -> east");
const north = destinationPoint(13.8, 100.0, 0, 1);
ok(north.lat > 13.8 && Math.abs(north.lng - 100.0) < 0.001, "bearing 0 -> north");
ok(Math.abs(haversineKm(13.8, 100.0, east.lat, east.lng) - 1) < 0.02, "destination ~1km away");

// 2. point-in-polygon (square)
const sq = [{ lat: 13.79, lng: 99.99 }, { lat: 13.81, lng: 99.99 }, { lat: 13.81, lng: 100.01 }, { lat: 13.79, lng: 100.01 }];
ok(pointInPolygon(13.8, 100.0, sq) === true, "center inside square");
ok(pointInPolygon(13.9, 100.2, sq) === false, "far point outside square");
ok(pointInPolygon(13.8, 100.0, [{ lat: 0, lng: 0 }]) === false, "degenerate ring -> false");

// 3. generateServiceArea with mocked OSRM (road = 1.3x straight-line)
const store = { lat: 13.8294, lng: 100.0529 };
const mockRoute = async (sl, sn, dl, dn) => ({ distanceKm: haversineKm(sl, sn, dl, dn) * 1.3 });
const area = await generateServiceArea(store, 8, { bearings: 16, iterations: 8, getRouteFn: mockRoute });
ok(area.ring.length === 16, "ring has 16 vertices");
ok(area.km === 8, "area.km = 8");
const dists = area.ring.map((p) => haversineKm(store.lat, store.lng, p.lat, p.lng));
ok(dists.every((d) => d > 5.5 && d < 6.6), "each vertex ~6.15km (8/1.3) straight-line");

// 4. isInsideServiceArea via polygon
const near = destinationPoint(store.lat, store.lng, 45, 4);
const far = destinationPoint(store.lat, store.lng, 45, 7);
ok(isInsideServiceArea({ lat: near.lat, lng: near.lng, store: { serviceArea: area } }) === true, "polygon: near inside");
ok(isInsideServiceArea({ lat: far.lat, lng: far.lng, store: { serviceArea: area } }) === false, "polygon: far outside");

// 5. fallback radius (no polygon) + clamping
ok(isInsideServiceArea({ lat: 0, lng: 0, distanceKm: 5, store: { deliveryRadius: 8 } }) === true, "radius 8: 5km inside");
ok(isInsideServiceArea({ lat: 0, lng: 0, distanceKm: 9, store: { deliveryRadius: 8 } }) === false, "radius 8: 9km outside");
ok(clampDeliveryKm(100) === 20 && clampDeliveryKm(1) === 3 && clampDeliveryKm("x") === 8, "clamp to 3-20");
ok(isInsideServiceArea({ lat: 0, lng: 0, distanceKm: 15, store: { deliveryRadius: 100 } }) === true, "radius clamped to 20: 15km inside");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
