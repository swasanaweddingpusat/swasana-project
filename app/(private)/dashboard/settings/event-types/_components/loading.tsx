import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EventTypeLoading() {
  return (
    <div className="pb-6">
      <Card>
        <CardContent className="p-0">
          <div className={cn("flex", "items-center", "justify-between", "px-6", "pb-4", "border-b")}>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
