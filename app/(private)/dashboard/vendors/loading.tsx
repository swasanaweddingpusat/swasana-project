import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function VendorsLoading() {
  return (
    <div className="flex flex-col mb-6 w-full">
      {/* Top buttons */}
      <div className="flex justify-end items-center mb-4 gap-2">
        <Skeleton className="h-9 w-30" />
        <Skeleton className="h-9 w-34" />
      </div>
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-55" />
            </div>
          </div>
          {/* Table rows */}
          <div className="px-6 space-y-3 py-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <div className="flex-1" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))}
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
