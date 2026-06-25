import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const storeIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:28px;line-height:28px">🏪</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// หมุดร้าน ใช้ร่วมกันใน LiveMap ของ Customer/Store
export default function StoreMarker({ lat, lng, label = "ร้าน" }) {
  if (lat == null || lng == null) return null;
  return (
    <Marker position={[lat, lng]} icon={storeIcon}>
      <Popup>{label}</Popup>
    </Marker>
  );
}
