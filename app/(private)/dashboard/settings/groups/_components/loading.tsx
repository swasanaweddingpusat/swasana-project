import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "../../../../../../lib/utils";

export function GroupsLoading() {
  return (
    <div className={cn('px-6', 'pb-4', 'w-full')}>
      <div className={cn('flex', 'items-center', 'justify-between', 'mb-6')}>
        <div className="space-y-1">
          <Skeleton className={cn('h-5', 'w-40')} />
          <Skeleton className={cn('h-4', 'w-56')} />
        </div>
        <Skeleton className={cn('h-9', 'w-28')} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn('border', 'border-gray-200', 'rounded-lg', 'px-4', 'py-3', 'flex', 'items-center', 'gap-3')}>
            <Skeleton className={cn('h-4', 'w-4')} />
            <Skeleton className={cn('h-8', 'w-8', 'rounded-full')} />
            <div className={cn('flex-1', 'space-y-1')}>
              <Skeleton className={cn('h-4', 'w-32')} />
              <Skeleton className={cn('h-3', 'w-48')} />
            </div>
            <Skeleton className={cn('h-4', 'w-4')} />
          </div>
        ))}
      </div>
    </div>
  );
}
