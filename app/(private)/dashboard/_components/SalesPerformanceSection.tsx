"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  CupStar,
  Crown,
  Buildings2,
  CalendarDate,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { SalesPerformanceCardItem } from "@/lib/queries/salesPerformance";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000)
    return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
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

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  revenue: {
    label: "Revenue Confirmed",
    color: "var(--brand-ink)",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AvatarCircle({
  name,
  avatarUrl,
  rank,
}: {
  name: string;
  avatarUrl: string | null;
  rank: number;
}) {
  const isTop = rank === 0;
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold",
          "bg-primary text-primary-foreground",
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          getInitials(name)
        )}
      </div>
      {isTop && (
        <Crown
          weight="BoldDuotone"
          className="h-4 w-4 absolute -top-2 -right-1 text-[var(--brand-gold)]"
        />
      )}
    </div>
  );
}

function AchievementBar({
  pct,
  hasTarget,
}: {
  pct: number;
  hasTarget: boolean;
}) {
  if (!hasTarget) {
    return (
      <span className="text-xs text-muted-foreground italic">
        Target belum diset
      </span>
    );
  }

  const capped = Math.min(pct, 100);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Achievement</span>
        <span className="text-xs font-semibold text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  );
}

function CategoryBadge({
  label,
  count,
  revenue,
  colorClass,
}: {
  label: string;
  count: number;
  revenue: number;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
      <div className="flex items-center gap-1">
        <span className={cn("h-2 w-2 rounded-full shrink-0", colorClass)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xs font-semibold text-foreground">{formatCurrency(revenue)}</p>
      <p className="text-xs text-muted-foreground">{count} booking</p>
    </div>
  );
}

function SalesCard({
  item,
  rank,
}: {
  item: SalesPerformanceCardItem;
  rank: number;
}) {
  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-5 flex flex-col gap-4",
        "shadow-sm hover:shadow-md transition-shadow",
        rank === 0 && "border-[var(--brand-gold)]/40",
      )}
    >
      {/* Header: avatar + name + booking count */}
      <div className="flex items-center gap-3">
        <AvatarCircle name={item.name} avatarUrl={item.avatarUrl} rank={rank} />
        <div className="flex flex-col flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.confirmedBookings} booking confirmed
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          #{rank + 1}
        </span>
      </div>

      {/* Revenue */}
      <div>
        <p className="text-xs text-muted-foreground">Revenue Confirmed</p>
        <p className="text-xl font-heading font-bold text-foreground">
          {formatCurrency(item.revenue)}
        </p>
        {item.hasTarget && (
          <p className="text-xs text-muted-foreground mt-0.5">
            dari {formatCurrency(item.target)}
          </p>
        )}
      </div>

      {/* Achievement bar */}
      <AchievementBar pct={item.achievementPct} hasTarget={item.hasTarget} />

      {/* Category breakdown */}
      <div className="border-t pt-3 flex gap-4">
        <CategoryBadge
          label="Wedding"
          count={item.breakdown.weddings.count}
          revenue={item.breakdown.weddings.revenue}
          colorClass="bg-primary"
        />
        <div className="w-px bg-border shrink-0" />
        <CategoryBadge
          label="MICE"
          count={item.breakdown.mice.count}
          revenue={item.breakdown.mice.revenue}
          colorClass="bg-[var(--brand-gold)]"
        />
      </div>
    </div>
  );
}

// ─── Bar chart sub-section ────────────────────────────────────────────────────

function RevenueBarChart({ data }: { data: SalesPerformanceCardItem[] }) {
  const chartData = data.map((item) => ({
    name:
      item.name.split(" ").slice(0, 2).join(" "),
    revenue: item.revenue,
    profileId: item.profileId,
  }));

  const COLORS = [
    "var(--brand-ink)",
    "oklch(0.40 0 0)",
    "oklch(0.55 0 0)",
    "oklch(0.65 0 0)",
    "oklch(0.75 0 0)",
  ];

  return (
    <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CupStar weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">
          Revenue per Sales
        </h3>
      </div>

      <ChartContainer config={chartConfig} className="h-52 w-full">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <YAxis
            dataKey="name"
            type="category"
            width={80}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <XAxis
            type="number"
            tickFormatter={(v: number) =>
              v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}Jt` : String(v)
            }
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  typeof value === "number" ? formatCurrency(value) : String(value)
                }
              />
            }
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ─── Category split summary ───────────────────────────────────────────────────

function CategorySplitSummary({ data }: { data: SalesPerformanceCardItem[] }) {
  const totals = data.reduce(
    (acc, item) => ({
      weddingCount: acc.weddingCount + item.breakdown.weddings.count,
      weddingRevenue: acc.weddingRevenue + item.breakdown.weddings.revenue,
      miceCount: acc.miceCount + item.breakdown.mice.count,
      miceRevenue: acc.miceRevenue + item.breakdown.mice.revenue,
    }),
    { weddingCount: 0, weddingRevenue: 0, miceCount: 0, miceRevenue: 0 },
  );

  const totalRevenue = totals.weddingRevenue + totals.miceRevenue;
  const weddingPct =
    totalRevenue > 0
      ? Math.round((totals.weddingRevenue / totalRevenue) * 100)
      : 0;
  const micePct = totalRevenue > 0 ? 100 - weddingPct : 0;

  return (
    <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Buildings2 weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Split Wedding vs MICE
        </h3>
      </div>

      {/* Stacked bar */}
      <div className="flex flex-col gap-2">
        <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
          {weddingPct > 0 && (
            <div
              className="bg-primary rounded-l-full"
              style={{ width: `${weddingPct}%` }}
            />
          )}
          {micePct > 0 && (
            <div
              className="bg-[var(--brand-gold)] rounded-r-full"
              style={{ width: `${micePct}%` }}
            />
          )}
          {totalRevenue === 0 && (
            <div className="bg-secondary rounded-full w-full" />
          )}
        </div>

        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Wedding</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(totals.weddingRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totals.weddingCount} booking · {weddingPct}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-gold)] shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">MICE</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(totals.miceRevenue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {totals.miceCount} booking · {micePct}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SalesPerformanceSection({
  data,
}: {
  data: SalesPerformanceCardItem[];
}) {
  if (data.length === 0) {
    return (
      <div className="bg-card border rounded-2xl p-6 flex flex-col items-center gap-3 text-center shadow-sm">
        <CalendarDate weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Belum ada data booking di periode ini.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <CupStar weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h2 className="text-base font-semibold text-foreground">
          Achievement & Performance Sales
        </h2>
        <span className="text-xs text-muted-foreground ml-1">
          (top {data.length} sales terbaru)
        </span>
      </div>

      {/* Cards per sales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {data.map((item, idx) => (
          <SalesCard key={item.profileId} item={item} rank={idx} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueBarChart data={data} />
        <CategorySplitSummary data={data} />
      </div>
    </div>
  );
}
