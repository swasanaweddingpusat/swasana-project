"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { UsersGroupRounded, Crown, Star } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
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

const groupChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

interface TooltipPayloadEntry {
  payload: {
    name: string;
    revenue: number;
    leaderName: string;
    confirmedBookings: number;
    memberCount: number;
  };
}

function GroupTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="mt-1 text-muted-foreground">Leader: {d.leaderName}</p>
      <p className="text-muted-foreground">{d.confirmedBookings} booking confirmed</p>
      <p className="text-muted-foreground">{d.memberCount} anggota</p>
      <p className="mt-1 font-semibold text-foreground">{formatCurrency(d.revenue)}</p>
    </div>
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

export function GroupAchievementSection({
  initialGroups,
  dealFrom,
  dealTo,
  eventFrom,
  eventTo,
}: GroupAchievementSectionProps) {
  const { data } = useDashboardGroups(dealFrom, dealTo, eventFrom, eventTo, initialGroups);
  const groups = data ?? initialGroups;
  const sorted = useMemo(
    () => [...groups].sort((a, b) => b.revenue - a.revenue),
    [groups],
  );

  const chartData = useMemo(
    () =>
      sorted.map((g) => ({
        name: g.name,
        revenue: g.revenue,
        leaderName: g.leaderName,
        confirmedBookings: g.confirmedBookings,
        memberCount: g.memberCount,
      })),
    [sorted],
  );

  const chartHeight = Math.max(sorted.length * 48 + 32, 120);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">Achievement per Group</h2>

      {sorted.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <ChartContainer config={groupChartConfig} className="aspect-auto" style={{ height: chartHeight }}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatCurrency(v)}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={90}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip content={<GroupTooltipContent />} />
              <Bar
                dataKey="revenue"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {sorted.map((g, idx) => {
          const isTop = idx === 0;
          const isRunnerUp = idx === 1 || idx === 2;
          return (
            <li
              key={g.id}
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
                {idx + 1}
              </span>

              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {getInitials(g.name)}
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
                  <p className="truncate text-sm font-semibold text-foreground">{g.name}</p>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <UsersGroupRounded weight="BoldDuotone" className="h-3.5 w-3.5" />
                    {g.memberCount}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {g.leaderName} · {g.confirmedBookings} booking confirmed
                </p>
              </div>

              <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                {formatCurrency(g.revenue)}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
