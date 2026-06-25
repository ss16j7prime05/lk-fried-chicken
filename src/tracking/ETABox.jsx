// แสดงระยะทางที่เหลือ + เวลาคาดว่าจะถึง ใช้ร่วมกันทั้งฝั่ง Customer และ Store
export default function ETABox({ remainingDistance, estimatedArrival }) {
  if (remainingDistance == null && !estimatedArrival) return null;

  const arrivalTime = estimatedArrival
    ? new Date(estimatedArrival).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      style={{
        background: "#161616",
        borderRadius: "10px",
        padding: "10px",
        marginTop: "8px",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
        fontSize: "14px",
        color: "#ffb74d",
      }}
    >
      {remainingDistance != null && <div>📏 เหลือ {remainingDistance.toFixed(1)} กม.</div>}
      {arrivalTime && <div>⏱️ คาดว่าจะถึงเวลา {arrivalTime} น.</div>}
    </div>
  );
}
