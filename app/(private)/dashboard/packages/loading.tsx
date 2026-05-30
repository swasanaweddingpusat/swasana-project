import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function PackagesLoading() {
  return (
    <div className="flex flex-col mb-6 px-2">
      <Card>
        <CardContent className="p-0">
          {/* Header: title + count + search + btn */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-52 rounded-xl" />
              <Skeleton className="h-9 w-36 rounded-xl" />
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_2.5rem_1fr_1fr_5rem_7rem_6rem_7rem_6rem] items-center gap-3 px-6 py-3 border-b">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-5" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>

          {/* Table rows */}
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[2.5rem_2.5rem_1fr_1fr_5rem_7rem_6rem_7rem_6rem] items-center gap-3 px-6 py-3.5"
              >
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 w-5" />
                {/* Package name — sedikit varied biar natural */}
                <Skeleton className="h-4 rounded" style={{ width: `${55 + (i % 5) * 10}%` }} />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
