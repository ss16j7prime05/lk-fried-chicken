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
import { MapPin, Search, Navigation, Check, AlertCircle, Loader2 } from "lucide-react";
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

// หมุดลูกค้าที่ลากได้ + แตะบนแผนที่เพื่อย้าย — map events (click/dragend) เดิมทุกประการ ห้ามแก้
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

// GPS error code -> ข้อความที่สื่อความหมาย (สิทธิ์/GPS ปิด/หมดเวลา) — แสดงในการ์ด error
const gpsErrorMessage = (err) => {
  if (err?.code === 1) return "ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์";
  if (err?.code === 2) return "ไม่สามารถระบุตำแหน่งได้ (GPS ปิดอยู่หรือสัญญาณอ่อน)";
  if (err?.code === 3) return "หมดเวลาในการค้นหาตำแหน่ง กรุณาลองใหม่";
  return "ไม่สามารถดึงตำแหน่งได้ กรุณาลองใหม่";
};

// Bottom-sheet เลือกตำแหน่งจัดส่ง: แผนที่ลากหมุด + ตำแหน่งปัจจุบัน + ค้นหาที่อยู่ + แสดงที่อยู่เต็ม + ยืนยัน
// onConfirm({ lat, lng, address }) เรียกเมื่อกดยืนยัน — สัญญากับ parent เดิมทุกประการ
export default function LocationPicker({ isOpen, storeLocation, initialPosition, onConfirm, onClose }) {
  const [position, setPosition] = useState(
    initialPosition || { lat: storeLocation.lat, lng: storeLocation.lng }
  );
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // UI-only state (no backend/logic change): GPS loading, inline error card, confirm animation.
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmPhase, setConfirmPhase] = useState("idle"); // idle | saving | done
  const busy = confirmPhase !== "idle";

  if (!isOpen) return null;

  // ── core logic (unchanged) ──────────────────────────────────────────────
  const movePosition = async (lat, lng, knownAddress) => {
    setPosition({ lat, lng });
    setSearchResults([]);
    setErrorMsg(null);
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
    setErrorMsg(null);
    if (!navigator.geolocation) {
      setErrorMsg("อุปกรณ์นี้ไม่รองรับ GPS");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { movePosition(pos.coords.latitude, pos.coords.longitude); setLocating(false); },
      (err) => { setErrorMsg(gpsErrorMessage(err)); setLocating(false); }
    );
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setErrorMsg(null);
    setSearching(true);
    try {
      const results = await searchAddress(searchQuery);
      setSearchResults(results);
      if (results.length === 0) setErrorMsg("ไม่พบที่อยู่ที่ค้นหา ลองใช้คำค้นอื่น");
    } catch {
      setErrorMsg("ค้นหาที่อยู่ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSearching(false);
    }
  };

  const pickSearchResult = (result) => {
    movePosition(result.lat, result.lng, result.displayName);
  };

  const handleConfirm = () => {
    if (position.lat == null || position.lng == null) {
      setErrorMsg("กรุณาลากหมุดเลือกตำแหน่งก่อน");
      return;
    }
    setErrorMsg(null);
    // Success feedback (saving -> done), then hand the confirmed point to the parent, which
    // closes the sheet. Both buttons are disabled throughout so nothing races the sequence.
    setConfirmPhase("saving");
    window.setTimeout(() => {
      setConfirmPhase("done");
      window.setTimeout(() => onConfirm({ lat: position.lat, lng: position.lng, address }), 480);
    }, 380);
  };

  const closeIfIdle = () => { if (!busy) onClose(); };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center">
      {/* backdrop */}
      <button
        type="button"
        aria-label="ปิด"
        onClick={closeIfIdle}
        className="absolute inset-0 bg-black/60 animate-[lpFade_.2s_ease-out] cursor-default"
      />

      {/* sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="เลือกตำแหน่งจัดส่ง"
        className="relative w-full sm:max-w-lg bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-[lpSheetUp_.3s_cubic-bezier(.22,1,.36,1)] pb-[env(safe-area-inset-bottom)]"
      >
        {/* drag handle */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
        </div>

        {/* header (compact) */}
        <div className="px-5 pb-3 shrink-0">
          <h3 className="flex items-center gap-2 text-lg font-black text-gray-900">
            <MapPin size={20} className="text-primary shrink-0" /> เลือกตำแหน่งจัดส่ง
          </h3>
          <p className="text-xs font-medium text-gray-400 mt-0.5">ลากหมุดหรือค้นหาที่อยู่</p>
        </div>

        {/* scrollable body */}
        <div className="px-5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-3 pb-2">
          {/* search row */}
          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0 h-12 px-3.5 rounded-2xl border border-gray-200 bg-gray-50 transition-colors focus-within:border-primary focus-within:bg-white">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="ค้นหาที่อยู่"
                aria-label="ค้นหาที่อยู่"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium text-gray-800 placeholder:text-gray-400"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="h-12 px-4 rounded-2xl bg-secondary text-white font-bold text-sm flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              ค้นหา
            </button>
          </div>

          {/* search results */}
          {searchResults.length > 0 && (
            <ul className="rounded-2xl border border-gray-100 overflow-hidden max-h-40 overflow-y-auto divide-y divide-gray-50 animate-[lpFade_.2s_ease-out]">
              {searchResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickSearchResult(r)}
                    className="w-full flex items-start gap-2 text-left px-3.5 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-primary-light transition-colors"
                  >
                    <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                    <span className="min-w-0">{r.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* error card */}
          {errorMsg && (
            <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-red-600 animate-[lpFade_.2s_ease-out]">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm font-bold min-w-0">{errorMsg}</p>
            </div>
          )}

          {/* map — large, rounded, soft shadow. Leaflet logic + events unchanged. */}
          <div className="rounded-[20px] overflow-hidden shadow-soft border border-gray-100 animate-[lpFade_.4s_ease-out]">
            <MapContainer
              center={[position.lat, position.lng]}
              zoom={14}
              style={{ width: "100%", height: "300px" }}
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
          </div>

          {/* live address card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">
              <MapPin size={13} className="text-primary" /> ที่อยู่ที่เลือก
            </p>
            {resolving ? (
              <div className="space-y-2 animate-pulse" aria-hidden="true">
                <div className="h-3.5 w-11/12 rounded-full bg-gray-100" />
                <div className="h-3.5 w-3/4 rounded-full bg-gray-100" />
              </div>
            ) : address ? (
              <p className="text-sm font-bold text-gray-800 leading-relaxed">{address}</p>
            ) : (
              <p className="text-sm font-medium text-gray-400">ยังไม่พบที่อยู่</p>
            )}
          </div>

          {/* current location button — white, gray border, green accent */}
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="w-full h-12 rounded-2xl border border-gray-200 bg-white text-gray-700 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98] hover:border-primary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {locating ? (
              <><Loader2 size={18} className="animate-spin text-primary" /> กำลังค้นหาตำแหน่ง…</>
            ) : (
              <><Navigation size={18} className="text-primary" /> ใช้ตำแหน่งปัจจุบัน</>
            )}
          </button>
        </div>

        {/* sticky footer actions */}
        <div className="shrink-0 border-t border-gray-100 bg-white p-4 pt-3 space-y-2.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-secondary text-white font-black text-base flex items-center justify-center gap-2 transition-transform active:scale-[.98] disabled:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
          >
            {confirmPhase === "saving" && <Loader2 size={20} className="animate-spin" />}
            {confirmPhase === "done" && <Check size={20} className="animate-[lpPop_.3s_ease-out]" strokeWidth={3} />}
            {confirmPhase === "done" ? "บันทึกแล้ว" : "ยืนยันตำแหน่ง"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full h-12 rounded-2xl border border-gray-200 bg-white text-gray-600 font-bold text-sm transition-all active:scale-[.98] hover:border-gray-300 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-200"
          >
            ยกเลิก
          </button>
        </div>
      </div>

      {/* micro-animations (scoped keyframes) */}
      <style>{`
        @keyframes lpFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lpSheetUp { from { transform: translateY(24px); opacity: .6 } to { transform: translateY(0); opacity: 1 } }
        @keyframes lpPop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}
