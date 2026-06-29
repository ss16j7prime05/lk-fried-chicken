export const EmptyState = ({
  title = "No Data",
  description = "Nothing to display.",
  icon = "📦",
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-6">
        {icon}
      </div>

      <h2 className="text-2xl font-black text-dark">
        {title}
      </h2>

      <p className="mt-2 text-gray-500 font-medium max-w-sm">
        {description}
      </p>
    </div>
  );
};
