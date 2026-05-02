import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SalesPerformanceItem {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  revenue: number;
  confirmedBookings: number;
  target: number;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}Jt`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function SalesLeaderboard({ sales }: { sales: SalesPerformanceItem[] }) {
  const sorted = [...sales].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className={cn("bg-card", "border", "rounded-xl", "p-5", "flex", "flex-col", "gap-4")}>
      <h2 className={cn("text-base", "font-semibold", "text-foreground")}>Performance Sales</h2>

      <ol className={cn("flex", "flex-col", "gap-3")}>
        {sorted.map((item, idx) => {
          const isTop = idx === 0;
          const pct = item.target > 0 ? Math.min(Math.round((item.revenue / item.target) * 100), 100) : 0;

          return (
            <li
              key={item.profileId}
              className={cn(
                "flex",
                "items-center",
                "gap-3",
                "p-3",
                "rounded-lg",
                isTop ? "bg-secondary" : "bg-transparent"
              )}
            >
              {/* Rank */}
              <div className={cn("w-6", "shrink-0", "flex", "justify-center")}>
                {isTop ? (
                  <Crown className={cn("h-5", "w-5")} style={{ color: "#D97706" }} />
                ) : (
                  <span className={cn("text-sm", "font-medium", "text-muted-foreground")}>{idx + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <div
                className={cn(
                  "h-8",
                  "w-8",
                  "rounded-full",
                  "bg-primary",
                  "text-primary-foreground",
                  "flex",
                  "items-center",
                  "justify-center",
                  "text-xs",
                  "font-semibold",
                  "shrink-0"
                )}
              >
                {getInitials(item.name)}
              </div>

              {/* Info */}
              <div className={cn("flex", "flex-col", "flex-1", "min-w-0", "gap-1")}>
                <div className={cn("flex", "items-center", "justify-between", "gap-2")}>
                  <span className={cn("text-sm", "font-medium", "text-foreground", "truncate")}>{item.name}</span>
                  <span className={cn("text-xs", "text-muted-foreground", "shrink-0")}>
                    {item.confirmedBookings} booking
                  </span>
                </div>
                <div className={cn("flex", "items-center", "justify-between", "gap-2")}>
                  <span className={cn("text-xs", "font-semibold", "text-foreground")}>
                    {formatCurrency(item.revenue)}
                  </span>
                  <span className={cn("text-xs", "text-muted-foreground")}>{pct}%</span>
                </div>
                {/* Mini progress */}
                <div className={cn("h-1", "bg-border", "rounded-full", "overflow-hidden")}>
                  <div className={cn("h-full", "bg-primary", "rounded-full")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
