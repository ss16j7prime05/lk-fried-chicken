import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { reverseGeocode, searchAddress } from "../location/locationUtils";

const storeIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:28px;line-height:28px">🏪</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function DraggableMarker({ position, onChange }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return (
    <Marker
      draggable
      icon={storeIcon}
      position={[position.lat, position.lng]}
      eventHandlers={{
        dragend(e) {
          const m = e.target.getLatLng();
          onChange(m.lat, m.lng);
        },
      }}
    >
      <Popup>ตำแหน่งร้าน (ลากเพื่อย้าย)</Popup>
    </Marker>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "8px",
  borderRadius: "10px",
  border: "none",
  background: "#2a2a2a",
  color: "#fff",
  boxSizing: "border-box",
};

// ตัวเลือกตำแหน่งร้านบนแผนที่ (Google Maps Location) ใช้ในหน้าสมัครร้านค้าเท่านั้น
// ลากหมุด/แตะแผนที่/ค้นหาที่อยู่/ใช้ตำแหน่งปัจจุบัน -> onChange({lat, lng, address})
export default function StoreLocationPicker({ value, onChange }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);

  const position = value?.lat != null ? value : { lat: 13.7563, lng: 100.5018 };

  const movePosition = async (lat, lng, knownAddress) => {
    setSearchResults([]);
    if (knownAddress) {
      onChange({ lat, lng, address: knownAddress });
      return;
    }
    setResolving(true);
    try {
      const addr = await reverseGeocode(lat, lng);
      onChange({ lat, lng, address: addr });
    } finally {
      setResolving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("อุปกรณ์ไม่รองรับ GPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => movePosition(pos.coords.latitude, pos.coords.longitude),
      () => alert("ไม่สามารถดึงตำแหน่งได้")
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchAddress(searchQuery);
      setSearchResults(results);
      if (results.length === 0) alert("ไม่พบที่อยู่ที่ค้นหา");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
        ตำแหน่งร้านบน Google Maps
      </label>
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <input
          type="text"
          placeholder="ค้นหาที่อยู่..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            border: "none",
            background: "#ff8c00",
            color: "#fff",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {searching ? "..." : "ค้นหา"}
        </button>
      </div>
      {searchResults.length > 0 && (
        <div style={{ border: "1px solid #444", borderRadius: "10px", marginBottom: "8px", maxHeight: "120px", overflowY: "auto" }}>
          {searchResults.map((r, i) => (
            <div
              key={i}
              onClick={() => movePosition(r.lat, r.lng, r.displayName)}
              style={{ padding: "8px 10px", fontSize: "13px", cursor: "pointer", borderTop: i === 0 ? "none" : "1px solid #333" }}
            >
              📍 {r.displayName}
            </div>
          ))}
        </div>
      )}
      <MapContainer
        center={[position.lat, position.lng]}
        zoom={14}
        style={{ width: "100%", height: "220px", borderRadius: "12px", marginBottom: "8px" }}
      >
        <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <DraggableMarker position={position} onChange={movePosition} />
      </MapContainer>
      <div style={{ fontSize: "13px", color: "#999", marginBottom: "8px" }}>
        {resolving ? "กำลังค้นหาที่อยู่..." : value?.address || "แตะ/ลากหมุดเพื่อเลือกตำแหน่งร้าน"}
      </div>
      <button
        type="button"
        onClick={useCurrentLocation}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "10px",
          border: "none",
          background: "#2a2a2a",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        📍 ใช้ตำแหน่งปัจจุบัน
      </button>
    </div>
  );
}
