import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function BannerLoading() {
  return (
    <div className={cn('px-2', 'sm:px-6', 'pb-6')}>
      <div className={cn('flex', 'items-center', 'justify-between', 'pb-4')}>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          <Skeleton className={cn('h-5', 'w-32')} />
          <Skeleton className={cn('h-4', 'w-8')} />
        </div>
        <Skeleton className={cn('h-9', 'w-24', 'rounded-full')} />
      </div>
      <div className={cn('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-4')}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-2xl overflow-hidden">
            <Skeleton className={cn('h-32', 'w-full', 'rounded-none')} />
            <CardContent className={cn('p-4', 'space-y-2')}>
              <Skeleton className={cn('h-4', 'w-2/3')} />
              <Skeleton className={cn('h-3', 'w-1/2')} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
