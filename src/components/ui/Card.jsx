export const Card = ({ children, className = "" }) => (
  <div
    className={`bg-white rounded-3xl shadow-soft border border-gray-50 overflow-hidden ${className}`}
  >
    {children}
  </div>
);
