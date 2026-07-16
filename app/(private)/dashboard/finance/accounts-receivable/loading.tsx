import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsReceivableLoading(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="mt-3 h-6 w-32" />
            <Skeleton className="mt-1 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Skeleton className="h-8 w-full sm:w-60 rounded-full" />
        <Skeleton className="hidden sm:block h-8 w-36 rounded-full" />
        <Skeleton className="hidden sm:block h-8 w-32 rounded-full" />
        <Skeleton className="sm:hidden h-8 w-24 rounded-full" />
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden lg:block overflow-hidden rounded-2xl border border-border bg-card">
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <div className="flex-1" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile card skeleton */}
      <div className="lg:hidden flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mt-3 border-t border-border/60 pt-3 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
