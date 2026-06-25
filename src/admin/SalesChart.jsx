const card = {
  background: "#1e1e1e",
  borderRadius: "16px",
  padding: "16px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
};

// กราฟแท่งยอดขาย 7 วันล่าสุด รับ days = [{label, total}]
export default function SalesChart({ days }) {
  const maxSale = Math.max(1, ...days.map((d) => d.total));
  return (
    <div style={card}>
      <div style={{ color: "#999", fontSize: "14px", marginBottom: "10px" }}>
        📊 ยอดขาย 7 วันล่าสุด
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "160px" }}>
        {days.map((d) => (
          <div key={d.label} style={{ flex: 1, textAlign: "center" }}>
            <div
              title={`${d.total} ฿`}
              style={{
                height: `${(d.total / maxSale) * 120}px`,
                background: "#ff8c00",
                borderRadius: "6px 6px 0 0",
                minHeight: "2px",
              }}
            />
            <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
              {d.label}
            </div>
            <div style={{ fontSize: "11px" }}>{d.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
