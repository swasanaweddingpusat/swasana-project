import { Skeleton } from "@/components/ui/skeleton";

export function RolesLoading() {
  return (
    <div className="flex flex-col mb-6 px-2">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Roles List */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-7 w-7" />
            </div>
            <div className="p-2 space-y-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-lg">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Permission Matrix */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-7 w-14" />
              </div>
            </div>
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-3">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <Skeleton key={j} className="h-5 w-16" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
