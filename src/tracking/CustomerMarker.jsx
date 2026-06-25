import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

const customerIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// หมุดลูกค้า (จุดส่งอาหาร) ใช้ร่วมกันใน LiveMap ของ Customer/Store
export default function CustomerMarker({ lat, lng, label = "ตำแหน่งจัดส่ง" }) {
  if (lat == null || lng == null) return null;
  return (
    <Marker position={[lat, lng]} icon={customerIcon}>
      <Popup>{label}</Popup>
    </Marker>
  );
}
