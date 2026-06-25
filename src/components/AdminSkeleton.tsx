export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ${className}`} />
}

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card space-y-3">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-8 w-16" />
          </div>
        ))}
      </div>
      {/* list */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card flex items-center gap-4">
          <SkeletonBox className="w-12 h-12 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-4 w-48" />
            <SkeletonBox className="h-3 w-32" />
          </div>
          <SkeletonBox className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function AdminDetailSkeleton() {
  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <SkeletonBox className="w-9 h-9 rounded-xl" />
        <SkeletonBox className="h-7 w-48" />
        <SkeletonBox className="h-7 w-24 rounded-full ml-auto" />
      </div>
      <div className="card space-y-4">
        <SkeletonBox className="h-5 w-32" />
        <SkeletonBox className="h-48 w-full rounded-xl" />
        <SkeletonBox className="h-4 w-40" />
        <SkeletonBox className="h-4 w-56" />
      </div>
      <div className="card space-y-4">
        <SkeletonBox className="h-5 w-32" />
        {[...Array(4)].map((_, i) => (
          <SkeletonBox key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
