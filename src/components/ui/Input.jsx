export const Input = ({
  label,
  className = "",
  ...props
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          {label}
        </label>
      )}

      <input
        {...props}
        className={`w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`}
      />
    </div>
  );
};
