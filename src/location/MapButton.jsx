// ปุ่มเปิด Google Maps แบบ reusable
// mode="view" เปิดดูตำแหน่งบนแผนที่ / mode="navigate" เปิดนำทางขับรถไปยังตำแหน่งนั้น
// URL ทั้งหมดสร้างที่ mapsService (SSOT) — ที่นี่ทำหน้าที่แสดงผลอย่างเดียว
import { buildNavigationUrl, buildViewUrl } from "./mapsService";

const DISABLED_STYLE = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#444",
  color: "#888",
  fontWeight: "bold",
  cursor: "not-allowed",
};

export default function MapButton({
  lat,
  lng,
  address,
  mapLink,
  mode = "view",
  label,
  style,
  disabled = false,
  disabledLabel,
}) {
  const href =
    mode === "navigate"
      ? buildNavigationUrl({ lat, lng, address })
      : buildViewUrl({ lat, lng, address, mapLink });

  const defaultLabel = mode === "navigate" ? "🧭 นำทาง Google Maps" : "🗺️ เปิด Google Maps";

  // ไม่มีปลายทาง = กดไปก็ไม่มีอะไรให้เปิด / ผู้เรียกสั่งปิดเอง (เช่น ออฟไลน์ — Maps โหลดไม่ได้อยู่ดี)
  if (!href || disabled) {
    return (
      <button disabled style={{ ...DISABLED_STYLE, ...style }}>
        {!href ? "🗺️ ไม่มีตำแหน่ง" : disabledLabel || defaultLabel}
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-block",
        textAlign: "center",
        textDecoration: "none",
        padding: "10px 16px",
        borderRadius: "10px",
        border: "none",
        background: mode === "navigate" ? "#22c55e" : "#4fc3f7",
        color: mode === "navigate" ? "#fff" : "#000",
        fontWeight: "bold",
        cursor: "pointer",
        ...style,
      }}
    >
      {label || defaultLabel}
    </a>
  );
}
