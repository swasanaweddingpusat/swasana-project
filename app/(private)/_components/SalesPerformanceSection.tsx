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
  Star,
  CalendarDate,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useDashboardSalesPerformance } from "@/hooks/useDashboardSalesPerformance";
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

// Podium — juara 1 mahkota, juara 2 & 3 bintang. Semua gold, ukuran diperbesar.
function PodiumIcon({ rank }: { rank: number }): React.ReactElement | null {
  if (rank === 0)
    return (
      <Crown
        weight="BoldDuotone"
        className="h-6 w-6 absolute -top-3 -right-1.5 text-[var(--brand-gold)]"
      />
    );
  if (rank === 1 || rank === 2)
    return (
      <Star
        weight="BoldDuotone"
        className="h-5 w-5 absolute -top-2.5 -right-1.5 text-[var(--brand-gold)]"
      />
    );
  return null;
}

function AvatarCircle({
  name,
  avatarUrl,
  rank,
}: {
  name: string;
  avatarUrl: string | null;
  rank: number;
}) {
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
      <PodiumIcon rank={rank} />
    </div>
  );
}

// Dummy target sales — placeholder sampai fitur target-per-sales beneran dipasang.
// Kalau item udah punya target asli (hasTarget), pakai itu; kalau belum, generate
// target dummy dari revenue biar progress bar tetep kelihatan masuk akal.
const DUMMY_TARGET_MULTIPLIER = 1.35;
const DUMMY_TARGET_FLOOR = 1_000_000;

function resolveDummyTarget(item: SalesPerformanceCardItem): number {
  if (item.hasTarget && item.target > 0) return item.target;
  if (item.revenue <= 0) return DUMMY_TARGET_FLOOR;
  return Math.round((item.revenue * DUMMY_TARGET_MULTIPLIER) / 100_000) * 100_000;
}

function SalesListRow({
  item,
  rank,
}: {
  item: SalesPerformanceCardItem;
  rank: number;
}) {
  const target = resolveDummyTarget(item);
  const collected = item.revenue;
  const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4",
        rank === 0 && "bg-[var(--brand-gold)]/5",
      )}
    >
      <span
        className={cn(
          "w-4 shrink-0 text-center font-mono text-xs",
          rank === 0 ? "font-semibold text-[var(--brand-gold)]" : "text-muted-foreground",
        )}
      >
        {rank + 1}
      </span>
      <AvatarCircle name={item.name} avatarUrl={item.avatarUrl} rank={rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        <p className="text-xs text-muted-foreground">{item.confirmedBookings} booking confirmed</p>
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
          {formatCurrency(collected)} dari target {formatCurrency(target)}
        </p>
      </div>
    </li>
  );
}

function SalesPerformanceTable({ data }: { data: SalesPerformanceCardItem[] }) {
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {data.map((item, idx) => (
        <SalesListRow key={item.profileId} item={item} rank={idx} />
      ))}
    </ol>
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

  // Grow height with the number of sales so bars stay legible (≈40px/row).
  const chartHeight = Math.max(208, chartData.length * 40 + 32);

  return (
    <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CupStar weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">
          Revenue per Sales
        </h3>
      </div>

      <ChartContainer
        config={chartConfig}
        className="aspect-auto w-full"
        style={{ height: chartHeight }}
      >
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

// ─── Main export ──────────────────────────────────────────────────────────────

interface SalesPerformanceSectionProps {
  initialData: SalesPerformanceCardItem[];
  /** Dealing-date (createdAt) range, calendar-day strings (YYYY-MM-DD). */
  dealFrom: string;
  dealTo: string;
  /** Event-date (eventDate) range, calendar-day strings (YYYY-MM-DD). */
  eventFrom: string;
  eventTo: string;
}

export function SalesPerformanceSection({
  initialData,
  dealFrom,
  dealTo,
  eventFrom,
  eventTo,
}: SalesPerformanceSectionProps) {
  const { data: liveData } = useDashboardSalesPerformance(dealFrom, dealTo, eventFrom, eventTo, initialData);
  const data = liveData ?? initialData;

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
          (semua sales, by revenue)
        </span>
      </div>

      {/* Table per sales */}
      <SalesPerformanceTable data={data} />

      {/* Revenue chart — full width */}
      <RevenueBarChart data={data} />
    </div>
  );
}
