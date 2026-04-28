"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { SalesLeader } from "@/types/finance";

interface LeaderboardSalesProps {
  leaders: SalesLeader[];
  loading: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

export function LeaderboardSales({ leaders, loading }: LeaderboardSalesProps) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-6">
      <h3 className="text-base font-bold text-[#1D1D1D] mb-4">Leaderboard Sales</h3>
      {loading ? (
        <div className="flex flex-col gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <div className="flex flex-col gap-1 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {leaders.map((leader, idx) => (
            <li key={leader.id} className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground w-5 shrink-0">{idx + 1}.</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{leader.name}</span>
                <span className="text-sm text-muted-foreground">{formatCurrency(leader.totalSales)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
