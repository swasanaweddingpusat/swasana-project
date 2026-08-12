"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { GraphUp, PieChart as PieChartIcon, AltArrowDown } from "@solar-icons/react";
import { formatAxisRupiah, formatRupiah } from "./format";
import { REVENUE_TREND_2026, REVENUE_BREAKDOWN } from "./report-analytics-mock-data";

const trendChartConfig: ChartConfig = {
  omset: {
    label: "Omset Net",
    color: "var(--brand-ink)",
  },
};

const breakdownChartConfig: ChartConfig = {
  wedding: { label: "Paket Wedding", color: "var(--brand-ink)" },
  venueOnly: { label: "Venue Only", color: "var(--brand-gold)" },
  mice: { label: "MICE Event", color: "oklch(0.62 0 0)" },
};

function RevenueTrendChart() {
  return (
    <div className="flex flex-1 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md lg:basis-2/3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraphUp weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
          <h3 className="text-sm font-semibold text-foreground">Revenue Trend (Net)</h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs text-foreground">
          Tahun 2026
          <AltArrowDown weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      <ChartContainer config={trendChartConfig} className="h-72 w-full">
        <AreaChart data={REVENUE_TREND_2026} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradOmsetTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--brand-ink)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--brand-ink)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="bulan" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={formatAxisRupiah}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            width={44}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (typeof value === "number" ? formatRupiah(value) : String(value))}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="omset"
            stroke="var(--brand-ink)"
            strokeWidth={2}
            fill="url(#gradOmsetTrend)"
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function RevenueBreakdownDonut() {
  const total = REVENUE_BREAKDOWN.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md lg:basis-1/3">
      <div className="flex items-center gap-2">
        <PieChartIcon weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">Revenue Breakdown</h3>
      </div>

      <div className="relative mx-auto">
        <ChartContainer config={breakdownChartConfig} className="h-44 w-44">
          <PieChart>
            <Pie
              data={REVENUE_BREAKDOWN}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              dataKey="value"
              nameKey="label"
            >
              {REVENUE_BREAKDOWN.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (typeof value === "number" ? formatRupiah(value) : String(value))}
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-heading text-lg font-bold text-foreground">{formatRupiah(total)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {REVENUE_BREAKDOWN.map((item) => {
          const pct = Math.round((item.value / total) * 100);
          return (
            <div key={item.key} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <span className="flex-1 text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-semibold text-foreground">{formatRupiah(item.value)}</span>
              <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RevenueTrendSection() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <RevenueTrendChart />
      <RevenueBreakdownDonut />
    </div>
  );
}
