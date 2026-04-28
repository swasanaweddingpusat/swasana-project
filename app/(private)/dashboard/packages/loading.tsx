import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "../../../../lib/utils";

export default function PackagesLoading() {
  return (
    <div className={cn('flex', 'flex-col', 'mb-6', 'px-2')}>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'items-center', 'justify-between', 'px-6', 'pb-4', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-3')}>
              <Skeleton className={cn('h-5', 'w-28')} />
              <Skeleton className={cn('h-6', 'w-20', 'rounded-full')} />
            </div>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <Skeleton className={cn('h-9', 'w-55')} />
              <Skeleton className={cn('h-9', 'w-32')} />
            </div>
          </div>
          {/* Table rows */}
          <div className={cn('px-6', 'space-y-3', 'py-4')}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn('flex', 'items-center', 'gap-4', 'py-3')}>
                <Skeleton className={cn('h-4', 'w-4')} />
                <Skeleton className={cn('h-4', 'w-8')} />
                <Skeleton className={cn('h-4', 'w-36')} />
                <Skeleton className={cn('h-4', 'w-24')} />
                <Skeleton className={cn('h-4', 'w-32')} />
                <Skeleton className={cn('h-4', 'w-20')} />
                <div className="flex-1" />
                <Skeleton className={cn('h-7', 'w-16')} />
              </div>
            ))}
          </div>
          {/* Pagination */}
          <div className={cn('flex', 'items-center', 'justify-between', 'px-6', 'py-3', 'border-t')}>
            <Skeleton className={cn('h-4', 'w-32')} />
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <Skeleton className={cn('h-8', 'w-8')} />
              <Skeleton className={cn('h-4', 'w-20')} />
              <Skeleton className={cn('h-8', 'w-8')} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
