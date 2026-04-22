import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-md" />
        </div>
      </div>

      {/* List skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex gap-4">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="h-3 w-72" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
