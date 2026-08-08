export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

export function RecipeCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <Skeleton className="w-full h-28 rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    </div>
  )
}

export function RecipeLibrarySkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function RecipeDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] max-w-md mx-auto">
      <Skeleton className="w-full h-56 rounded-none" />
      <div className="px-4 pt-5 space-y-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-3">
          <Skeleton className="h-16 flex-1" />
          <Skeleton className="h-16 flex-1" />
          <Skeleton className="h-16 flex-1" />
        </div>
        <Skeleton className="h-4 w-1/4 mt-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 pt-8 pb-8 max-w-md mx-auto space-y-4">
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}

export function PlannerSkeleton() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] px-4 pt-8 pb-8 max-w-md mx-auto space-y-5">
      <Skeleton className="h-8 w-1/2" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
      <div className="flex gap-3">
        <Skeleton className="h-28 w-36 flex-shrink-0" />
        <Skeleton className="h-28 w-36 flex-shrink-0" />
        <Skeleton className="h-28 w-36 flex-shrink-0" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
