import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function VenuesLoading() {
  return (
    <Card className="shadow-none">
      <CardContent className="p-0">
        <div className="flex justify-between items-center px-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-50" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="px-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-20" />
              <div className="flex-1" />
              <div className="flex gap-1">
                <Skeleton className="h-7 w-7" />
                <Skeleton className="h-7 w-7" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
