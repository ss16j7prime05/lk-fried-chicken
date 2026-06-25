import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const storeDivIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:26px;line-height:26px">🏪</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const customerDivIcon = L.divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// แผนที่แสดงตำแหน่งจัดส่งแบบ read-only (Store/Rider/Admin ใช้ดูตำแหน่งลูกค้า)
// แสดงตำแหน่งร้าน (ถ้ามี storeLocation) คู่กับตำแหน่งลูกค้า
export default function DeliveryMap({ lat, lng, address, storeLocation, height = "220px" }) {
  if (lat == null || lng == null) {
    return (
      <div
        style={{
          width: "100%",
          height,
          borderRadius: "12px",
          background: "#2a2a2a",
          color: "#888",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "13px",
        }}
      >
        ไม่มีตำแหน่งจัดส่ง
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ width: "100%", height, borderRadius: "12px" }}
        key={`${lat}-${lng}`}
      >
        <TileLayer
          attribution="© OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {storeLocation && (
          <Marker position={[storeLocation.lat, storeLocation.lng]} icon={storeDivIcon}>
            <Popup>{storeLocation.name || "ร้าน"}</Popup>
          </Marker>
        )}
        <Marker position={[lat, lng]} icon={customerDivIcon}>
          <Popup>{address || "ตำแหน่งจัดส่ง"}</Popup>
        </Marker>
      </MapContainer>
      {address && (
        <div style={{ fontSize: "12px", color: "#999", marginTop: "6px" }}>📍 {address}</div>
      )}
    </div>
  );
}
