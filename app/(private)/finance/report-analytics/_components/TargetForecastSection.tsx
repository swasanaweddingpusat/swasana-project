"use client";

import { Fragment } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Target, GraphUp, Rocket } from "@solar-icons/react";
import { formatAxisRupiah, formatRupiah } from "./format";
import {
  TARGET_THIS_MONTH,
  FORECAST_REVENUE,
  TARGET_FORECAST_INSIGHTS,
} from "./report-analytics-mock-data";

const forecastChartConfig: ChartConfig = {
  actual: { label: "Actual", color: "var(--brand-ink)" },
  forecast: { label: "Forecast", color: "var(--brand-gold)" },
};

function TargetThisMonthCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <Target weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">Target Bulan Ini</h3>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">
          Omset saat ini dari target {formatRupiah(TARGET_THIS_MONTH.target)}
        </p>
        <p className="mt-1 font-heading text-3xl font-bold text-foreground">
          {formatRupiah(TARGET_THIS_MONTH.current)}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${TARGET_THIS_MONTH.pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-primary">{TARGET_THIS_MONTH.pct}% tercapai</span>
          <span className="text-xs text-muted-foreground">
            Sisa {formatRupiah(TARGET_THIS_MONTH.remaining)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ForecastRevenueCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <GraphUp weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">Forecast Omset (3 Bulan ke Depan)</h3>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand-ink)]" />
          <span className="text-xs text-muted-foreground">Actual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed border-[var(--brand-gold)]" />
          <span className="text-xs text-muted-foreground">Forecast</span>
        </div>
      </div>

      <ChartContainer config={forecastChartConfig} className="h-52 w-full">
        <BarChart data={FORECAST_REVENUE} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
          <Bar dataKey="actual" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {FORECAST_REVENUE.map((entry) => (
              <Cell key={`actual-${entry.bulan}`} fill="var(--brand-ink)" />
            ))}
          </Bar>
          <Bar
            dataKey="forecast"
            radius={[6, 6, 0, 0]}
            maxBarSize={40}
            fill="var(--brand-gold)"
            fillOpacity={0.25}
            stroke="var(--brand-gold)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function InsightText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, idx) =>
        idx % 2 === 1 ? (
          <strong key={idx} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <Fragment key={idx}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function InsightCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <Rocket weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">Insight</h3>
      </div>

      <ul className="flex flex-col gap-3">
        {TARGET_FORECAST_INSIGHTS.map((insight, idx) => (
          <li key={idx} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-gold)]" />
            <span>
              <InsightText text={insight} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TargetForecastSection() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-foreground">Target & Forecast</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TargetThisMonthCard />
        <ForecastRevenueCard />
        <InsightCard />
      </div>
    </div>
  );
}
