import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const riderIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:26px;line-height:26px">🛵</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// หมุดไรเดอร์ ใช้ร่วมกันใน LiveMap ของ Customer/Store
export default function RiderMarker({ lat, lng, label = "ไรเดอร์" }) {
  if (lat == null || lng == null) return null;
  return (
    <Marker position={[lat, lng]} icon={riderIcon}>
      <Popup>{label}</Popup>
    </Marker>
  );
}
