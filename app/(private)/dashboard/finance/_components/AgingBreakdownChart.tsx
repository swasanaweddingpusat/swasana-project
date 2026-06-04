"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ClockCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";

// ─── Dummy data ───────────────────────────────────────────────────────────────

const DUMMY_AGING = [
  { bucket: "1–30 hari", amount: 980_000_000, fill: "var(--brand-ink)" },
  { bucket: "31–60 hari", amount: 620_000_000, fill: "oklch(0.45 0 0)" },
  { bucket: "61–90 hari", amount: 340_000_000, fill: "oklch(0.60 0 0)" },
  { bucket: "> 90 hari", amount: 180_000_000, fill: "var(--destructive)" },
];

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartConfig: ChartConfig = {
  amount: {
    label: "Outstanding",
    color: "var(--brand-ink)",
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

export function AgingBreakdownChart() {
  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4 flex-1",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClockCircle
          weight="BoldDuotone"
          className="h-5 w-5 text-destructive"
        />
        <h3 className="text-sm font-semibold text-foreground">
          Aging Breakdown
        </h3>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {DUMMY_AGING.map((item) => (
          <div
            key={item.bucket}
            className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1"
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: item.fill }}
            />
            <span className="text-xs text-muted-foreground">{item.bucket}</span>
            <span className="text-xs font-semibold text-foreground ml-1">
              {formatAxisRupiah(item.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ChartContainer config={chartConfig} className="h-44 w-full">
        <BarChart
          data={DUMMY_AGING}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            tickFormatter={formatAxisRupiah}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            width={42}
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
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {DUMMY_AGING.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
