"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GraphUp } from "@solar-icons/react";
import { cn } from "@/lib/utils";

// ─── Dummy data ───────────────────────────────────────────────────────────────

const DUMMY_TREND = [
  { bulan: "Jan", totalAR: 1_850_000_000, collected: 1_200_000_000 },
  { bulan: "Feb", totalAR: 2_100_000_000, collected: 1_650_000_000 },
  { bulan: "Mar", totalAR: 1_750_000_000, collected: 1_400_000_000 },
  { bulan: "Apr", totalAR: 2_400_000_000, collected: 1_900_000_000 },
  { bulan: "Mei", totalAR: 2_200_000_000, collected: 1_750_000_000 },
  { bulan: "Jun", totalAR: 2_650_000_000, collected: 2_100_000_000 },
];

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  totalAR: {
    label: "Total AR",
    color: "var(--brand-ink)",
  },
  collected: {
    label: "Collected",
    color: "var(--brand-gold)",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAxisRupiah(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}Jt`;
  return String(v);
}

function formatRupiah(v: number): string {
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(2)}M`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(0)}Jt`;
  return `Rp ${v.toLocaleString("id-ID")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CollectionTrendChart() {
  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4 flex-1",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <GraphUp
          weight="BoldDuotone"
          className="h-5 w-5 text-[var(--brand-gold)]"
        />
        <h3 className="text-sm font-semibold text-foreground">
          Tren Collection 6 Bulan
        </h3>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-ink)] shrink-0" />
          <span className="text-xs text-muted-foreground">Total AR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-gold)] shrink-0" />
          <span className="text-xs text-muted-foreground">Collected</span>
        </div>
      </div>

      {/* Chart */}
      <ChartContainer config={chartConfig} className="h-52 w-full">
        <AreaChart
          data={DUMMY_TREND}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="gradAR" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--brand-ink)"
                stopOpacity={0.15}
              />
              <stop
                offset="95%"
                stopColor="var(--brand-ink)"
                stopOpacity={0}
              />
            </linearGradient>
            <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--brand-gold)"
                stopOpacity={0.2}
              />
              <stop
                offset="95%"
                stopColor="var(--brand-gold)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="bulan"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={formatAxisRupiah}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            width={50}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) =>
                  typeof value === "number" ? formatRupiah(value) : String(value)
                }
              />
            }
          />
          <Area
            type="monotone"
            dataKey="totalAR"
            stroke="var(--brand-ink)"
            strokeWidth={2}
            fill="url(#gradAR)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="collected"
            stroke="var(--brand-gold)"
            strokeWidth={2}
            fill="url(#gradCollected)"
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
