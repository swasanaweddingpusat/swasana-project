"use client";

import { UsersGroupRounded, Crown, Star } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useDashboardGroups } from "@/hooks/useDashboardGroups";
import type { GroupAchievementData } from "@/lib/queries/dashboard";

export type { GroupAchievementData } from "@/lib/queries/dashboard";

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

function GroupListRow({ group, rank }: { group: GroupAchievementData; rank: number }) {
  const pct = group.target > 0 ? Math.min(Math.round((group.revenue / group.target) * 100), 100) : 0;
  const isTop = rank === 0;
  const isRunnerUp = rank === 1 || rank === 2;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4",
        isTop && "bg-[var(--brand-gold)]/5",
      )}
    >
      <span
        className={cn(
          "w-4 shrink-0 text-center font-mono text-xs",
          isTop ? "font-semibold text-[var(--brand-gold)]" : "text-muted-foreground",
        )}
      >
        {rank + 1}
      </span>

      <div className="relative shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {getInitials(group.name)}
        </div>
        {isTop && (
          <Crown
            weight="BoldDuotone"
            className="absolute -top-3 -right-1.5 h-6 w-6 text-[var(--brand-gold)]"
          />
        )}
        {isRunnerUp && (
          <Star
            weight="BoldDuotone"
            className="absolute -top-3 -right-1.5 h-5 w-5 text-[var(--brand-gold)]"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <UsersGroupRounded weight="BoldDuotone" className="h-3.5 w-3.5" />
            {group.memberCount}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {group.leaderName} · {group.confirmedBookings} booking confirmed
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-foreground">{pct}%</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatCurrency(group.revenue)} dari target {formatCurrency(group.target)}
        </p>
      </div>
    </li>
  );
}

interface GroupAchievementSectionProps {
  initialGroups: GroupAchievementData[];
  /** Dealing-date (createdAt) range, calendar-day strings (YYYY-MM-DD). */
  dealFrom: string;
  dealTo: string;
  /** Event-date (eventDate) range, calendar-day strings (YYYY-MM-DD). */
  eventFrom: string;
  eventTo: string;
}

export function GroupAchievementSection({ initialGroups, dealFrom, dealTo, eventFrom, eventTo }: GroupAchievementSectionProps) {
  const { data } = useDashboardGroups(dealFrom, dealTo, eventFrom, eventTo, initialGroups);
  const groups = data ?? initialGroups;
  const sorted = [...groups].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className={cn("flex", "flex-col", "gap-4")}>
      <h2 className={cn("text-base", "font-semibold", "text-foreground")}>Achievement per Group</h2>
      <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {sorted.map((g, idx) => (
          <GroupListRow key={g.id} group={g} rank={idx} />
        ))}
      </ol>
    </div>
  );
}
