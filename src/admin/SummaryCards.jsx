import { card } from "./adminStyles";

function StatCard({ label, value, color }) {
  return (
    <div style={card}>
      <div style={{ color: "#999", fontSize: "13px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: "bold", color: color || "#fff" }}>
        {value}
      </div>
    </div>
  );
}

// กริดสรุปตัวเลขภาพรวม รับ array ของ {label, value, color} มา render เป็นการ์ด
export default function SummaryCards({ stats }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
        gap: "12px",
      }}
    >
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />
      ))}
    </div>
  );
}
