import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function UsersLoading() {
  return (
    <Card className="p-0 shadow-none">
      <CardContent className="p-0">
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-65" />
            <Skeleton className="h-8 w-27.5" />
            <Skeleton className="h-8 w-27.5" />
            <Skeleton className="h-8 w-27.5" />
          </div>
        </div>
        <div className="px-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <div className="flex-1" />
              <Skeleton className="h-7 w-7" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
