import { card } from "./adminStyles";

// Top 10 เมนูขายดี รับ items = [[name, qty], ...] (เรียงมาแล้ว)
export default function TopMenuChart({ items }) {
  const maxQty = Math.max(1, ...items.map(([, qty]) => qty));
  return (
    <div style={card}>
      <div style={{ color: "#999", fontSize: "14px", marginBottom: "10px" }}>
        🏆 เมนูขายดี Top 10
      </div>
      {items.length === 0 && <div style={{ color: "#777" }}>ยังไม่มีข้อมูล</div>}
      {items.map(([name, qty], i) => (
        <div key={name} style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "2px" }}>
            <span>{i + 1}. {name}</span>
            <span style={{ color: "#ff8c00" }}>{qty} จาน</span>
          </div>
          <div style={{ background: "#2a2a2a", borderRadius: "6px", height: "8px" }}>
            <div
              style={{
                width: `${(qty / maxQty) * 100}%`,
                background: "#ff8c00",
                height: "8px",
                borderRadius: "6px",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
