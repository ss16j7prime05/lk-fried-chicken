// Lightweight skeleton placeholders (CSS-only pulse, no deps) used for premium
// loading states in place of a bare spinner.
export const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-100 rounded-2xl ${className}`} />
);

// Matches the FoodCard footprint (same radius / aspect / padding) so the grid
// doesn't shift when real cards replace the skeletons.
export const FoodCardSkeleton = () => (
  <div className="bg-white rounded-3xl shadow-soft border border-gray-50 overflow-hidden">
    <div className="aspect-[4/3] bg-gray-100 animate-pulse" />
    <div className="p-3 sm:p-4 space-y-2.5">
      <div className="h-4 w-3/4 bg-gray-100 rounded-full animate-pulse" />
      <div className="h-3 w-full bg-gray-100 rounded-full animate-pulse" />
      <div className="flex items-center justify-between pt-3">
        <div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-9 w-9 bg-gray-100 rounded-full animate-pulse" />
      </div>
    </div>
  </div>
);
