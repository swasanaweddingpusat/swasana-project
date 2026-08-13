"use client";

import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartSquare,
  GraphUp,
  Buildings3,
  ClockCircle,
  CheckCircle,
  CloseCircle,
  CheckSquare,
  CalendarDate,
  Wallet2,
  type IconWeight,
} from "@solar-icons/react";
import { useSummaryByVenue } from "@/hooks/useProcurement";
import type { SummaryByVenueItem } from "@/lib/queries/procurement";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(v: number): string {
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(2)}M`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(0)}Jt`;
  return `Rp ${v.toLocaleString("id-ID")}`;
}

function getCurrentPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const barChartConfig: ChartConfig = {
  total: {
    label: "Total Pengajuan",
    color: "var(--brand-ink)",
  },
};

const STATUS_COLORS = {
  pending: "oklch(0.80 0.15 80)",
  approved: "oklch(0.55 0.15 240)",
  rejected: "var(--destructive)",
  completed: "oklch(0.55 0.15 150)",
} as const;

const pieChartConfig: ChartConfig = {
  pending: { label: "Menunggu", color: STATUS_COLORS.pending },
  approved: { label: "Disetujui", color: STATUS_COLORS.approved },
  rejected: { label: "Ditolak", color: STATUS_COLORS.rejected },
  completed: { label: "Selesai", color: STATUS_COLORS.completed },
};

const STATUS_LABELS: Record<keyof typeof STATUS_COLORS, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  completed: "Selesai",
};

const STATUS_ICONS = {
  pending: ClockCircle,
  approved: CheckCircle,
  rejected: CloseCircle,
  completed: CheckSquare,
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  colorClass,
  bgClass,
  isLoading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ weight?: IconWeight; className?: string }>;
  colorClass: string;
  bgClass: string;
  isLoading: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl shrink-0 ${bgClass}`}>
          <Icon weight="BoldDuotone" className={`h-6 w-6 ${colorClass}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-heading font-bold text-foreground truncate">
                {value}
              </p>
              {sub && (
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VenueBarChart({
  data,
  isLoading,
}: {
  data: SummaryByVenueItem[];
  isLoading: boolean;
}) {
  const chartData = data.map((d) => ({
    venueName:
      d.venueName.length > 14 ? `${d.venueName.slice(0, 13)}…` : d.venueName,
    total: d.total,
  }));

  return (
    <Card className="rounded-2xl shadow-sm flex flex-col">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ChartSquare
            weight="BoldDuotone"
            className="h-5 w-5 text-[var(--brand-ink)]"
          />
          <h3 className="text-sm font-semibold text-foreground">
            Total Pengajuan per Venue
          </h3>
        </div>

        {isLoading ? (
          <Skeleton className="h-52 w-full rounded-xl" />
        ) : data.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center gap-2">
            <ChartSquare
              weight="BoldDuotone"
              className="h-8 w-8 text-muted-foreground/40"
            />
            <p className="text-sm text-muted-foreground">
              Belum ada data di periode ini.
            </p>
          </div>
        ) : (
          <ChartContainer config={barChartConfig} className="h-52 w-full">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="venueName"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
                fill="var(--brand-ink)"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

type StatusKey = keyof typeof STATUS_COLORS;

function StatusPieChart({
  data,
  isLoading,
}: {
  data: SummaryByVenueItem[];
  isLoading: boolean;
}) {
  const pieData = useMemo<{ name: StatusKey; value: number }[]>(() => {
    const totals = data.reduce(
      (acc, d) => ({
        pending: acc.pending + d.pending,
        approved: acc.approved + d.approved,
        rejected: acc.rejected + d.rejected,
        completed: acc.completed + d.completed,
      }),
      { pending: 0, approved: 0, rejected: 0, completed: 0 }
    );
    return (Object.keys(totals) as StatusKey[])
      .map((k) => ({ name: k, value: totals[k] }))
      .filter((d) => d.value > 0);
  }, [data]);

  const totalCount = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="rounded-2xl shadow-sm flex flex-col">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <GraphUp
            weight="BoldDuotone"
            className="h-5 w-5 text-[var(--brand-gold)]"
          />
          <h3 className="text-sm font-semibold text-foreground">
            Distribusi Status
          </h3>
        </div>

        {isLoading ? (
          <Skeleton className="h-52 w-full rounded-xl" />
        ) : pieData.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center gap-2">
            <GraphUp
              weight="BoldDuotone"
              className="h-8 w-8 text-muted-foreground/40"
            />
            <p className="text-sm text-muted-foreground">
              Belum ada data di periode ini.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ChartContainer config={pieChartConfig} className="mx-auto h-[180px] w-[180px]">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name]}
                    />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [
                        value,
                        STATUS_LABELS[name as StatusKey] ?? name,
                      ]}
                    />
                  }
                />
              </PieChart>
            </ChartContainer>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {pieData.map((entry) => {
                const Icon = STATUS_ICONS[entry.name];
                const pct =
                  totalCount > 0
                    ? Math.round((entry.value / totalCount) * 100)
                    : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: STATUS_COLORS[entry.name] }}
                    />
                    <Icon
                      weight="BoldDuotone"
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    />
                    <span className="text-xs text-muted-foreground truncate">
                      {STATUS_LABELS[entry.name]}
                    </span>
                    <span className="text-xs font-semibold text-foreground ml-auto shrink-0">
                      {entry.value}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VenueTable({
  data,
  isLoading,
}: {
  data: SummaryByVenueItem[];
  isLoading: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-0">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Buildings3
            weight="BoldDuotone"
            className="h-4 w-4 text-muted-foreground"
          />
          <h3 className="text-sm font-semibold text-foreground">
            Rincian per Venue
          </h3>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-5">Venue</TableHead>
                  <TableHead className="text-center w-24">Menunggu</TableHead>
                  <TableHead className="text-center w-24">Disetujui</TableHead>
                  <TableHead className="text-center w-20">Ditolak</TableHead>
                  <TableHead className="text-center w-20">Selesai</TableHead>
                  <TableHead className="text-center w-24">Total</TableHead>
                  <TableHead className="text-right pr-3 min-w-36">
                    Total Belanja
                  </TableHead>
                  <TableHead className="text-right pr-3 min-w-36">
                    Anggaran
                  </TableHead>
                  <TableHead className="text-right pr-5 min-w-36">
                    Sisa
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-10 text-muted-foreground text-sm"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <CalendarDate
                          weight="BoldDuotone"
                          className="h-8 w-8 text-muted-foreground/40"
                        />
                        Belum ada data pengadaan di periode ini.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map((row) => (
                      <TableRow key={row.venueId}>
                        <TableCell className="px-5 text-sm font-medium">
                          {row.venueName}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="font-medium text-amber-600">
                            {row.pending}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="font-medium text-blue-600">
                            {row.approved}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="font-medium text-destructive">
                            {row.rejected}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="font-medium text-green-600">
                            {row.completed}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm font-semibold">
                          {row.total}
                        </TableCell>
                        <TableCell className="text-right pr-3 text-sm font-medium">
                          {formatRupiah(row.totalSpent)}
                        </TableCell>
                        <TableCell className="text-right pr-3 text-sm">
                          {row.budgetAmount === 0 ? (
                            <span className="text-muted-foreground/50 italic text-xs">—</span>
                          ) : (
                            formatRupiah(row.budgetAmount)
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-5 text-sm">
                          {row.budgetAmount === 0 ? (
                            <span className="inline-flex items-center justify-end rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                              —
                            </span>
                          ) : (
                            (() => {
                              const remaining = row.budgetAmount - row.totalSpent;
                              const ratio = remaining / row.budgetAmount;
                              const colorClass =
                                ratio > 0.5
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : ratio >= 0.2
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "bg-destructive/10 text-destructive";
                              return (
                                <span
                                  className={`inline-flex items-center justify-end rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                                >
                                  {formatRupiah(remaining)}
                                </span>
                              );
                            })()
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProcurementSummaryTab(): React.JSX.Element {
  const [period, setPeriod] = useState<string>(getCurrentPeriod);
  const { data = [], isLoading } = useSummaryByVenue(period);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, d) => ({
        total: acc.total + d.total,
        approved: acc.approved + d.approved,
        totalSpent: acc.totalSpent + d.totalSpent,
        totalBudget: acc.totalBudget + d.budgetAmount,
      }),
      { total: 0, approved: 0, totalSpent: 0, totalBudget: 0 }
    );
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      {/* Period filter */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <label
          htmlFor="summary-period"
          className="text-sm font-medium text-foreground shrink-0"
        >
          Periode
        </label>
        <input
          id="summary-period"
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-48"
        />
        {period && (
          <span className="text-xs text-muted-foreground">
            Menampilkan data untuk{" "}
            <span className="font-medium">
              {new Date(`${period}-01`).toLocaleDateString("id-ID", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Pengajuan"
          value={totals.total}
          sub="semua venue"
          icon={ChartSquare}
          colorClass="text-[var(--brand-ink)]"
          bgClass="bg-secondary"
          isLoading={isLoading}
        />
        <StatCard
          label="Total Disetujui"
          value={totals.approved}
          sub={
            totals.total > 0
              ? `${Math.round((totals.approved / totals.total) * 100)}% dari total`
              : undefined
          }
          icon={CheckCircle}
          colorClass="text-blue-600"
          bgClass="bg-blue-50 dark:bg-blue-950/30"
          isLoading={isLoading}
        />
        <StatCard
          label="Total Belanja"
          value={formatRupiah(totals.totalSpent)}
          sub="approved + selesai"
          icon={GraphUp}
          colorClass="text-[var(--brand-gold)]"
          bgClass="bg-amber-50 dark:bg-amber-950/30"
          isLoading={isLoading}
        />
        <StatCard
          label="Total Anggaran"
          value={formatRupiah(totals.totalBudget)}
          sub={
            totals.totalBudget > 0
              ? `Terpakai ${Math.round((totals.totalSpent / totals.totalBudget) * 100)}%`
              : undefined
          }
          icon={Wallet2}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50 dark:bg-emerald-950/30"
          isLoading={isLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VenueBarChart data={data} isLoading={isLoading} />
        <StatusPieChart data={data} isLoading={isLoading} />
      </div>

      {/* Venue breakdown table */}
      <VenueTable data={data} isLoading={isLoading} />
    </div>
  );
}
