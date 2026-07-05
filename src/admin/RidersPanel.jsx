import { adminNormalizeStatus, toDate } from "./adminUtils";

const th = { textAlign: "left", padding: "8px", color: "#999", fontSize: "12px" };
const td = { padding: "8px", fontSize: "13px" };

// คำนวณสถิติรายไรเดอร์จาก orders ที่มี riderId ตรงกัน
const buildRiderStats = (riderId, orders) => {
  const own = orders.filter((o) => o.riderId === riderId);
  const completed = own.filter((o) => adminNormalizeStatus(o.status) === "completed");
  const earnings = completed.reduce((s, o) => s + (o.deliveryFee || 0), 0);

  const durations = completed
    .map((o) => {
      const a = toDate(o.acceptedAt);
      const d = toDate(o.deliveredAt);
      if (!a || !d) return null;
      return (d.getTime() - a.getTime()) / 60000; // นาที
    })
    .filter((v) => v != null && v >= 0);

  const avgMinutes =
    durations.length > 0
      ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)
      : null;

  return {
    totalDeliveries: completed.length,
    earnings,
    avgMinutes,
  };
};

// รายชื่อไรเดอร์ + สถานะออนไลน์ (อ่านจาก users.riderStatus) + สถิติการจัดส่ง/รายได้/เวลาเฉลี่ย
export default function RidersPanel({ riders, orders }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={th}>ชื่อ</th>
            <th style={th}>เบอร์โทร</th>
            <th style={th}>สถานะ</th>
            <th style={th}>งานที่ส่งสำเร็จ</th>
            <th style={th}>รายได้รวม</th>
            <th style={th}>เวลาส่งเฉลี่ย</th>
          </tr>
        </thead>
        <tbody>
          {riders.map((r) => {
            const stats = buildRiderStats(r.id, orders);
            const online = r.riderStatus === "online";
            return (
              <tr key={r.id} style={{ borderBottom: "1px solid #2a2a2a" }}>
                <td style={td}>{r.name || r.riderName || "-"}</td>
                <td style={td}>{r.phone || "-"}</td>
                <td style={td}>
                  <span style={{ color: online ? "#22c55e" : "#888", fontWeight: "bold" }}>
                    {online ? "🟢 ออนไลน์" : "⚪ ออฟไลน์"}
                  </span>
                </td>
                <td style={td}>{stats.totalDeliveries}</td>
                <td style={td}>{stats.earnings} ฿</td>
                <td style={td}>{stats.avgMinutes != null ? `${stats.avgMinutes} นาที` : "-"}</td>
              </tr>
            );
          })}
          {riders.length === 0 && (
            <tr><td style={td} colSpan={6}><span style={{ color: "#888" }}>ยังไม่มีไรเดอร์</span></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
