export const EmptyState = ({
  title = "No Data",
  description = "Nothing to display.",
  icon = "📦",
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center text-4xl mb-5">
        {icon}
      </div>

      <h2 className="text-lg font-black text-gray-900">
        {title}
      </h2>

      <p className="mt-1.5 text-sm text-gray-400 font-medium max-w-xs leading-relaxed">
        {description}
      </p>
    </div>
  );
};
