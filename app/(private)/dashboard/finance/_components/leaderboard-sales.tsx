"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { SalesLeader } from "@/types/finance";
import { cn } from "../../../../../lib/utils";

interface LeaderboardSalesProps {
  leaders: SalesLeader[];
  loading: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

export function LeaderboardSales({ leaders, loading }: LeaderboardSalesProps) {
  return (
    <div className={cn('bg-card', 'border', 'border-border', 'rounded-xl', 'px-4', 'py-6')}>
      <h3 className={cn('text-base', 'font-bold', 'text-[#1D1D1D]', 'mb-4')}>Leaderboard Sales</h3>
      {loading ? (
        <div className={cn('flex', 'flex-col', 'gap-4')}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={cn('flex', 'items-center', 'gap-3')}>
              <Skeleton className={cn('h-5', 'w-5', 'rounded-full')} />
              <div className={cn('flex', 'flex-col', 'gap-1', 'flex-1')}>
                <Skeleton className={cn('h-4', 'w-28')} />
                <Skeleton className={cn('h-4', 'w-36')} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ol className={cn('flex', 'flex-col', 'gap-4')}>
          {leaders.map((leader, idx) => (
            <li key={leader.id} className={cn('flex', 'items-center', 'gap-3')}>
              <span className={cn('text-sm', 'font-medium', 'text-foreground', 'w-5', 'shrink-0')}>{idx + 1}.</span>
              <div className={cn('flex', 'flex-col')}>
                <span className={cn('text-sm', 'font-medium', 'text-foreground')}>{leader.name}</span>
                <span className={cn('text-sm', 'text-muted-foreground')}>{formatCurrency(leader.totalSales)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
