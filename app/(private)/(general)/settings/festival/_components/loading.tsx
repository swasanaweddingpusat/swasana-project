import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FestivalLoading() {
  return (
    <div className={cn('px-2', 'sm:px-6', 'pb-6')}>
      <div className={cn('flex', 'items-center', 'justify-between', 'pb-4')}>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          <Skeleton className={cn('h-5', 'w-32')} />
          <Skeleton className={cn('h-4', 'w-8')} />
        </div>
        <Skeleton className={cn('h-9', 'w-24', 'rounded-full')} />
      </div>
      <Card className="rounded-2xl overflow-hidden py-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={cn('flex', 'items-center', 'gap-4', 'p-4', 'border-b', 'border-border', 'last:border-b-0')}>
            <Skeleton className={cn('h-14', 'w-20', 'rounded-lg', 'shrink-0')} />
            <CardContent className={cn('p-0', 'flex-1', 'space-y-2')}>
              <Skeleton className={cn('h-4', 'w-2/3')} />
              <Skeleton className={cn('h-3', 'w-1/2')} />
            </CardContent>
          </div>
        ))}
      </Card>
    </div>
  );
}
