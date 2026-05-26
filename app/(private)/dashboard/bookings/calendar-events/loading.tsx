import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "../../../../../lib/utils";

export default function CalendarEventsLoading() {
  return (
    <div className={cn('flex', 'flex-col', 'mb-6', 'px-2', 'gap-4')}>
      <div className={cn('grid', 'grid-cols-4', 'gap-4')}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={cn('h-24', 'w-full')} />
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className={cn('grid', 'grid-cols-7', 'gap-2', 'mb-2')}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className={cn('h-8', 'w-full')} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className={cn('grid', 'grid-cols-7', 'gap-2', 'mb-2')}>
              {Array.from({ length: 7 }).map((_, col) => (
                <Skeleton key={col} className={cn('h-20', 'w-full')} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
