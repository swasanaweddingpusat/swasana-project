import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "../../../../lib/utils";

export default function FinanceLoading() {
  return (
    <div className={cn('space-y-6', 'p-6')}>
      {/* Stat cards */}
      <div className={cn('grid', 'grid-cols-2', 'lg:grid-cols-4', 'gap-4')}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className={cn('p-4', 'space-y-2')}>
              <Skeleton className={cn('h-4', 'w-28')} />
              <Skeleton className={cn('h-8', 'w-16')} />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Tabs */}
      <div className={cn('flex', 'gap-2')}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className={cn('h-9', 'w-28', 'rounded-md')} />
        ))}
      </div>
      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className={cn('px-6', 'space-y-3', 'py-4')}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn('flex', 'items-center', 'gap-4', 'py-3')}>
                <Skeleton className={cn('h-4', 'w-28')} />
                <Skeleton className={cn('h-4', 'w-28')} />
                <Skeleton className={cn('h-4', 'w-24')} />
                <Skeleton className={cn('h-5', 'w-16', 'rounded-full')} />
                <Skeleton className={cn('h-4', 'w-28')} />
                <div className="flex-1" />
                <Skeleton className={cn('h-4', 'w-20')} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
