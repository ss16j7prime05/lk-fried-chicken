// ปุ่มเปิด Google Maps แบบ reusable
// mode="view" เปิดดูตำแหน่งบนแผนที่ / mode="navigate" เปิดนำทางขับรถไปยังตำแหน่งนั้น
export default function MapButton({ lat, lng, address, mode = "view", label, style }) {
  const hasCoords = lat != null && lng != null;

  const href = hasCoords
    ? mode === "navigate"
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
      : `https://www.google.com/maps?q=${lat},${lng}`
    : address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  const defaultLabel = mode === "navigate" ? "🧭 นำทาง Google Maps" : "🗺️ เปิด Google Maps";

  if (!href) {
    return (
      <button
        disabled
        style={{
          padding: "10px 16px",
          borderRadius: "10px",
          border: "none",
          background: "#444",
          color: "#888",
          fontWeight: "bold",
          cursor: "not-allowed",
          ...style,
        }}
      >
        🗺️ ไม่มีตำแหน่ง
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
