export const Loading = ({
  text = "Loading..."
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-primary animate-spin"></div>

      <p className="mt-6 text-sm font-bold text-gray-500">
        {text}
      </p>
    </div>
  );
};
