import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "../../../../lib/utils";

export default function ProfileLoading() {
  return (
    <div className={cn('space-y-6', 'p-6')}>
      <Card>
        <CardContent className={cn('p-6', 'space-y-6')}>
          {/* Avatar + name */}
          <div className={cn('flex', 'items-center', 'gap-4')}>
            <Skeleton className={cn('h-16', 'w-16', 'rounded-full')} />
            <div className="space-y-2">
              <Skeleton className={cn('h-5', 'w-40')} />
              <Skeleton className={cn('h-4', 'w-28')} />
            </div>
          </div>
          {/* Form fields */}
          <div className={cn('grid', 'grid-cols-2', 'gap-4')}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className={cn('h-4', 'w-24')} />
                <Skeleton className={cn('h-9', 'w-full')} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
