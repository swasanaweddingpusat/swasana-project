"use client";

import { UsersGroupRounded } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useDashboardGroups } from "@/hooks/useDashboardGroups";
import type { GroupAchievementData } from "@/lib/queries/dashboard";

export type { GroupAchievementData } from "@/lib/queries/dashboard";

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}Jt`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function GroupAchievementCard({ group }: { group: GroupAchievementData }) {
  const pct = group.target > 0 ? Math.min(Math.round((group.revenue / group.target) * 100), 100) : 0;

  return (
    <div className={cn("bg-card", "border", "rounded-xl", "p-5", "flex", "flex-col", "gap-4")}>
      <div className={cn("flex", "items-start", "justify-between", "gap-2")}>
        <div>
          <p className={cn("font-semibold", "text-foreground", "text-sm")}>{group.name}</p>
          <p className={cn("text-xs", "text-muted-foreground", "mt-0.5")}>{group.leaderName}</p>
        </div>
        <div className={cn("flex", "items-center", "gap-1", "text-xs", "text-muted-foreground")}>
          <UsersGroupRounded weight="BoldDuotone" className={cn("h-3.5", "w-3.5")} />
          <span>{group.memberCount}</span>
        </div>
      </div>

      {/* Progress */}
      <div className={cn("flex", "flex-col", "gap-1.5")}>
        <div className={cn("flex", "items-center", "justify-between")}>
          <span className={cn("text-xs", "text-muted-foreground")}>Achievement</span>
          <span className={cn("text-xs", "font-semibold", "text-foreground")}>{pct}%</span>
        </div>
        <div className={cn("h-2", "bg-secondary", "rounded-full", "overflow-hidden")}>
          <div
            className={cn("h-full", "bg-primary", "rounded-full", "transition-all")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className={cn("flex", "items-center", "justify-between", "text-xs", "text-muted-foreground")}>
          <span>{formatCurrency(group.revenue)}</span>
          <span>Target: {formatCurrency(group.target)}</span>
        </div>
      </div>

      <div className={cn("text-xs", "text-muted-foreground", "border-t", "pt-3")}>
        <span className={cn("font-medium", "text-foreground")}>{group.confirmedBookings}</span> booking confirmed
      </div>
    </div>
  );
}

interface GroupAchievementSectionProps {
  initialGroups: GroupAchievementData[];
  year: number;
  month: number;
}

export function GroupAchievementSection({ initialGroups, year, month }: GroupAchievementSectionProps) {
  const { data } = useDashboardGroups(year, month, initialGroups);
  const groups = data ?? initialGroups;

  return (
    <div className={cn("flex", "flex-col", "gap-4")}>
      <h2 className={cn("text-base", "font-semibold", "text-foreground")}>Achievement per Group</h2>
      <div className={cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2")}>
        {groups.map((g) => (
          <GroupAchievementCard key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}
