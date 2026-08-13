"use client";

import { PieChart, Pie, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { UserCross, CalendarDate, HandShake, Crown } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRupiah } from "./format";
import {
  CANCEL_STATS,
  CANCEL_REASONS,
  PIPELINE_BY_YEAR,
  MICE_STATS,
  TOP_SALES_MICE,
} from "./report-analytics-mock-data";

const cancelChartConfig: ChartConfig = {
  budget: { label: "Budget", color: "var(--brand-ink)" },
  vendor: { label: "Ganti Vendor", color: "var(--brand-gold)" },
  schedule: { label: "Ubah Jadwal", color: "oklch(0.62 0 0)" },
  other: { label: "Lainnya", color: "var(--destructive)" },
};

const pipelineChartConfig: ChartConfig = {
  "2026": { label: "2026", color: "var(--brand-ink)" },
  "2027": { label: "2027", color: "var(--brand-gold)" },
  "2028": { label: "2028", color: "oklch(0.62 0 0)" },
};

function CancelAnalyticsCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <UserCross weight="BoldDuotone" className="h-5 w-5 text-destructive" />
        <h3 className="text-sm font-semibold text-foreground">Cancel Analytics</h3>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Total Cancel Client</p>
          <p className="mt-1 font-heading text-xl font-bold text-foreground">
            {CANCEL_STATS.totalCancelClient}
          </p>
        </div>
        <div className="w-px shrink-0 bg-border" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Lost Revenue</p>
          <p className="mt-1 font-heading text-xl font-bold text-foreground">
            {formatRupiah(CANCEL_STATS.lostRevenue)}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Cancel Rate</p>
        <p className="mt-1 font-heading text-3xl font-bold text-destructive">
          {CANCEL_STATS.cancelRate}%
        </p>
      </div>

      <div className="flex items-center gap-4">
        <ChartContainer config={cancelChartConfig} className="h-24 w-24 shrink-0">
          <PieChart>
            <Pie
              data={CANCEL_REASONS}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={42}
              paddingAngle={2}
              dataKey="value"
              nameKey="label"
            >
              {CANCEL_REASONS.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-1 flex-col gap-1.5">
          {CANCEL_REASONS.map((reason) => (
            <div key={reason.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: reason.fill }}
              />
              <span className="flex-1 truncate text-xs text-muted-foreground">{reason.label}</span>
              <span className="text-xs font-medium text-foreground">{reason.value}</span>
            </div>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" className="rounded-full">
        Lihat Detail Cancel
      </Button>
    </div>
  );
}

function PipelineByYearCard() {
  const total = PIPELINE_BY_YEAR.reduce((sum, item) => sum + item.omsetNet, 0);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <CalendarDate weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">Pipeline by Event Year</h3>
      </div>

      <div className="relative mx-auto">
        <ChartContainer config={pipelineChartConfig} className="h-32 w-32">
          <PieChart>
            <Pie
              data={PIPELINE_BY_YEAR}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={58}
              paddingAngle={2}
              dataKey="omsetNet"
              nameKey="year"
            >
              {PIPELINE_BY_YEAR.map((entry) => (
                <Cell key={entry.year} fill={entry.fill} />
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
          <span className="text-[10px] text-muted-foreground">Total</span>
          <span className="text-xs font-bold text-foreground">{formatRupiah(total)}</span>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-1.5 text-left font-normal">Tahun</th>
            <th className="pb-1.5 text-right font-normal">Dealing</th>
            <th className="pb-1.5 text-right font-normal">Omset Net</th>
            <th className="pb-1.5 text-right font-normal">%</th>
          </tr>
        </thead>
        <tbody>
          {PIPELINE_BY_YEAR.map((item) => (
            <tr key={item.year} className="border-t border-border/60">
              <td className="flex items-center gap-1.5 py-1.5 text-foreground">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                {item.year}
              </td>
              <td className="py-1.5 text-right text-foreground">{item.dealing}</td>
              <td className="py-1.5 text-right font-medium text-foreground">
                {formatRupiah(item.omsetNet)}
              </td>
              <td className="py-1.5 text-right text-muted-foreground">{item.pctContribution}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiceEventPerformanceCard() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <HandShake weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h3 className="text-sm font-semibold text-foreground">MICE Event Performance</h3>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Total Dealing</p>
          <p className="mt-1 font-heading text-xl font-bold text-foreground">
            {MICE_STATS.totalDealing}
          </p>
        </div>
        <div className="w-px shrink-0 bg-border" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Omset Net</p>
          <p className="mt-1 font-heading text-xl font-bold text-foreground">
            {formatRupiah(MICE_STATS.omsetNet)}
          </p>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="mb-2 text-xs text-muted-foreground">Top Sales MICE</p>
        <div className="flex flex-col gap-2.5">
          {TOP_SALES_MICE.map((item) => (
            <div key={item.rank} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  item.rank === 1
                    ? "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {item.rank === 1 ? (
                  <Crown weight="BoldDuotone" className="h-3.5 w-3.5" />
                ) : (
                  item.rank
                )}
              </span>
              <span className="flex-1 truncate text-sm text-foreground">{item.name}</span>
              <span className="text-xs text-muted-foreground">{item.dealing}x</span>
              <span className="text-sm font-semibold text-foreground">{formatRupiah(item.omset)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CancelPipelineMiceSection() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <CancelAnalyticsCard />
      <PipelineByYearCard />
      <MiceEventPerformanceCard />
    </div>
  );
}
