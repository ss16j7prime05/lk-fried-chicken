export const Badge = ({ children, color = "green" }) => {
  const colors = {
    green: "bg-primary-light text-primary",
    orange: "bg-orange-100 text-orange-600",
    blue: "bg-blue-100 text-blue-600",
    red: "bg-red-100 text-red-600",
    gray: "bg-gray-100 text-gray-500",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  );
};
