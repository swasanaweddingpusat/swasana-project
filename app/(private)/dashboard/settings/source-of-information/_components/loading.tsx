import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function SourceOfInformationLoading() {
  return (
    <div className="pb-6">
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-8" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-36" />
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
    </div>
  );
}
