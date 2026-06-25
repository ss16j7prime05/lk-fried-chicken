import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { reverseGeocode, searchAddress } from "./locationUtils";

const storeDivIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:28px;line-height:28px">🏪</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});
const customerDivIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// หมุดลูกค้าที่ลากได้ + แตะบนแผนที่เพื่อย้าย
function DraggableMarker({ position, onChange }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return (
    <Marker
      draggable
      icon={customerDivIcon}
      position={[position.lat, position.lng]}
      eventHandlers={{
        dragend(e) {
          const m = e.target.getLatLng();
          onChange(m.lat, m.lng);
        },
      }}
    />
  );
}

const input = {
  width: "100%",
  padding: "10px",
  marginBottom: "8px",
  borderRadius: "10px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

// Modal เลือกตำแหน่งจัดส่ง: แผนที่ลากหมุด + ตำแหน่งปัจจุบัน + ค้นหาที่อยู่ + แสดงที่อยู่เต็ม + ยืนยัน
// onConfirm({ lat, lng, address }) เรียกเมื่อกดยืนยัน
export default function LocationPicker({ isOpen, storeLocation, initialPosition, onConfirm, onClose }) {
  const [position, setPosition] = useState(
    initialPosition || { lat: storeLocation.lat, lng: storeLocation.lng }
  );
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  if (!isOpen) return null;

  const movePosition = async (lat, lng, knownAddress) => {
    setPosition({ lat, lng });
    setSearchResults([]);
    if (knownAddress) {
      setAddress(knownAddress);
      return;
    }
    setResolving(true);
    try {
      const addr = await reverseGeocode(lat, lng);
      setAddress(addr);
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

  const pickSearchResult = (result) => {
    movePosition(result.lat, result.lng, result.displayName);
  };

  const handleConfirm = () => {
    if (position.lat == null || position.lng == null) {
      alert("กรุณาลากหมุดก่อน");
      return;
    }
    onConfirm({ lat: position.lat, lng: position.lng, address });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.7)",
        zIndex: 3000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#fff",
          color: "#222",
          borderRadius: "20px",
          padding: "16px",
          width: "100%",
          maxWidth: "480px",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🗺️ ลากหมุดเพื่อเลือกตำแหน่ง</h3>

        {/* ค้นหาที่อยู่ */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input
            type="text"
            placeholder="ค้นหาที่อยู่..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{ ...input, marginBottom: 0, flex: 1 }}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              border: "none",
              background: "#ff9800",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {searching ? "..." : "ค้นหา"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              marginBottom: "10px",
              maxHeight: "140px",
              overflowY: "auto",
            }}
          >
            {searchResults.map((r, i) => (
              <div
                key={i}
                onClick={() => pickSearchResult(r)}
                style={{
                  padding: "8px 10px",
                  fontSize: "13px",
                  cursor: "pointer",
                  borderTop: i === 0 ? "none" : "1px solid #eee",
                }}
              >
                📍 {r.displayName}
              </div>
            ))}
          </div>
        )}

        <MapContainer
          center={[position.lat, position.lng]}
          zoom={14}
          style={{ width: "100%", height: "320px", borderRadius: "12px", marginBottom: "12px" }}
        >
          <TileLayer
            attribution="© OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[storeLocation.lat, storeLocation.lng]} icon={storeDivIcon}>
            <Popup>{storeLocation.name || "ร้าน"}</Popup>
          </Marker>
          <DraggableMarker position={position} onChange={movePosition} />
        </MapContainer>

        {/* แสดงที่อยู่เต็ม */}
        <div
          style={{
            background: "#f5f5f5",
            borderRadius: "10px",
            padding: "10px",
            marginBottom: "10px",
            fontSize: "13px",
            color: "#444",
            minHeight: "20px",
          }}
        >
          {resolving ? "กำลังค้นหาที่อยู่..." : address || "แตะ/ลากหมุดเพื่อดูที่อยู่"}
        </div>

        <button
          onClick={useCurrentLocation}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "8px",
            borderRadius: "10px",
            border: "none",
            background: "#444",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          📍 ใช้ตำแหน่งปัจจุบัน
        </button>
        <button
          onClick={handleConfirm}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            background: "#ff9800",
            color: "#fff",
            border: "none",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "8px",
          }}
        >
          ยืนยันหมุด
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "12px",
            background: "#fff",
            color: "#666",
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
