import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import RiderMarker from "./RiderMarker.jsx";
import CustomerMarker from "./CustomerMarker.jsx";
import StoreMarker from "./StoreMarker.jsx";

// แผนที่ realtime: ร้าน + ลูกค้า + ไรเดอร์ + เส้นทาง ใช้ร่วมกันทั้งฝั่ง Customer และ Store
export default function LiveMap({ storeLocation, customerLocation, riderLocation, height = "240px" }) {
  const center = riderLocation || customerLocation || storeLocation;
  if (!center?.lat || !center?.lng) {
    return (
      <div style={{ color: "#888", fontSize: "13px", padding: "10px" }}>
        ยังไม่มีข้อมูลตำแหน่งให้แสดงบนแผนที่
      </div>
    );
  }

  const routePoints = [storeLocation, riderLocation, customerLocation]
    .filter((p) => p?.lat != null && p?.lng != null)
    .map((p) => [p.lat, p.lng]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ width: "100%", height, borderRadius: "12px" }}
      key={`${center.lat}-${center.lng}`}
    >
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {storeLocation && (
        <StoreMarker lat={storeLocation.lat} lng={storeLocation.lng} label={storeLocation.name || "ร้าน"} />
      )}
      {customerLocation && (
        <CustomerMarker lat={customerLocation.lat} lng={customerLocation.lng} label={customerLocation.address} />
      )}
      {riderLocation && <RiderMarker lat={riderLocation.lat} lng={riderLocation.lng} />}
      {routePoints.length >= 2 && (
        <Polyline positions={routePoints} pathOptions={{ color: "#ff9800", weight: 4, dashArray: "6 6" }} />
      )}
    </MapContainer>
  );
}
