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

// Matches the rider list-card footprint (order no. / meta / status / footer) so the
// switch from loading → loaded doesn't jump. Used by the rider History / Jobs / Earnings
// lists in place of a bare centered spinner.
export const RiderCardSkeleton = () => (
  <div className="bg-white rounded-3xl shadow-soft border border-gray-50 p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-28 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
      </div>
      <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-3 w-40 bg-gray-100 rounded-full animate-pulse" />
      <div className="h-3 w-32 bg-gray-100 rounded-full animate-pulse" />
    </div>
    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
      <div className="h-3 w-16 bg-gray-100 rounded-full animate-pulse" />
      <div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse" />
    </div>
  </div>
);

// A responsive grid of rider card skeletons — drops into any rider list while loading.
export const RiderCardGridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <RiderCardSkeleton key={i} />
    ))}
  </div>
);
