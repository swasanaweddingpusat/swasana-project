"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Buildings,
  Bolt,
  CalendarMark,
  ChatRoundLine,
} from "@solar-icons/react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useBitrixOverview, type BitrixOverviewData, type OverviewSalesBucket } from "@/hooks/use-bitrix-overview";

// ─── Helpers ────────────────────────────────────────────────────────────────

// Local calendar day (not UTC) — avoids the off-by-one from toISOString().
function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Format a date range for the Popover trigger, e.g. "12 Agu 2026" or
// "12 Agu – 15 Agu 2026". Falls back to a placeholder when empty.
function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Pilih tanggal";
  const from = format(range.from, "d MMM yyyy");
  const to = range.to ? format(range.to, "d MMM yyyy") : from;
  return from === to ? from : `${from} – ${to}`;
}

function pctOf(part: number, whole: number, decimals = 0): number {
  if (whole <= 0) return 0;
  const f = 10 ** decimals;
  return Math.round((part / whole) * 100 * f) / f;
}

function fmt(n: number): string {
  return n.toLocaleString("id-ID");
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

interface BarSegment {
  value: number;
  className: string;
}

/**
 * Proportion bar — segments grow by their `value` (flex-grow), with a small
 * min-width so a nonzero-but-tiny segment (e.g. 1 out of 784) stays visible.
 * The empty track shows through as `bg-muted`.
 */
function ProportionBar({ segments, className }: { segments: BarSegment[]; className?: string }): React.ReactElement {
  return (
    <div className={cn("flex w-full overflow-hidden rounded-full bg-muted", className ?? "h-2")}>
      {segments.map((s, i) => (
        <div
          key={i}
          className={cn("h-full transition-[flex-grow] duration-500", s.className)}
          style={{ flexGrow: s.value, minWidth: s.value > 0 ? "0.5rem" : 0 }}
        />
      ))}
    </div>
  );
}

function CardHeading({ icon, title }: { icon: React.ReactNode; title: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent">{icon}</span>
      <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

/**
 * Dashboard section that mirrors the Bitrix Overview's "Database Kantor vs
 * Mandiri" metric for the general landing at `/`. Owns its own date range
 * filter (default: last 7 days) — the split is derived from CRM deal source
 * labels over deals created within the selected range. Cached + polled on a 30s
 * cadence via TanStack Query. A failed query (e.g. no `bitrix:view`) hides the
 * section.
 */
export function CrmOverviewMetrics(): React.ReactElement | null {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const to = new Date();
    // Last 7 days (today + previous 6). Narrow window keeps the Bitrix deal
    // fetch under the pagination cap so the newest deals aren't dropped.
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 6);
    return { from, to };
  });

  const from = range?.from ? toIsoDay(range.from) : "";
  const to = range?.to ? toIsoDay(range.to) : from;

  const overviewQuery = useBitrixOverview({ from, to });

  if (overviewQuery.isError) return null;

  const data = overviewQuery.data ?? null;
  const loading = overviewQuery.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Bolt weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
        <h2 className="text-base font-semibold text-foreground">Perolehan Database</h2>
      </div>

      <SourceCard data={data} loading={loading} range={range} onRangeChange={setRange} />
      <FollowUpCard data={data} loading={loading} />
    </div>
  );
}

// ─── Source card (Kantor vs Mandiri) ──────────────────────────────────────────

function SourceCard({
  data,
  loading,
  range,
  onRangeChange,
}: {
  data: BitrixOverviewData | null;
  loading: boolean;
  range: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const kantor = data?.kantor ?? 0;
  const mandiri = data?.mandiri ?? 0;
  const total = kantor + mandiri;

  return (
    <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardHeading
          icon={<Buildings weight="BoldDuotone" className="h-4 w-4 text-foreground" />}
          title="Sumber Database"
        />

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className={cn(
              "flex h-8 items-center justify-between gap-2 rounded-full border border-input bg-background px-3 text-xs",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !range?.from && "text-muted-foreground",
            )}
          >
            <CalendarMark weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{formatRangeLabel(range)}</span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="range" numberOfMonths={1} selected={range} onSelect={onRangeChange} autoFocus />
          </PopoverContent>
        </Popover>
      </div>

      {/* Hero total */}
      <p className="text-xs text-muted-foreground">Total database masuk</p>
      {loading ? (
        <Skeleton className="mt-1 h-9 w-28" />
      ) : (
        <p className="font-heading text-3xl font-semibold leading-tight text-foreground tabular-nums">
          {fmt(total)}
        </p>
      )}

      {/* Composition bar — Kantor (ink) vs Mandiri (gold) */}
      {loading ? (
        <Skeleton className="mt-4 h-2.5 w-full" />
      ) : (
        <ProportionBar
          className="mt-4 h-2.5"
          segments={[
            { value: kantor, className: "bg-primary" },
            { value: mandiri, className: "bg-[var(--brand-gold)]" },
          ]}
        />
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-col gap-2.5">
        {loading ? (
          <>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </>
        ) : (
          <>
            <LegendRow dotClass="bg-primary" label="Database Kantor" value={kantor} pct={pctOf(kantor, total, 1)} loading={loading} />
            <LegendRow dotClass="bg-[var(--brand-gold)]" label="Database Mandiri" value={mandiri} pct={pctOf(mandiri, total, 1)} loading={loading} />
          </>
        )}
      </div>
    </Card>
  );
}

function LegendRow({
  dotClass,
  label,
  value,
  pct,
  loading,
}: {
  dotClass: string;
  label: string;
  value: number;
  pct: number;
  loading: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("size-2.5 shrink-0 rounded-full", dotClass)} />
      <span className="flex-1 truncate text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-sm font-semibold text-foreground tabular-nums">
        {loading ? "…" : fmt(value)}
      </span>
      <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {loading ? "" : `${pct}%`}
      </span>
    </div>
  );
}

// ─── Follow-up card ───────────────────────────────────────────────────────────

function FollowUpCard({ data, loading }: { data: BitrixOverviewData | null; loading: boolean }): React.ReactElement {
  const responded = data?.responseStatus.responded ?? 0;
  const notResponded = data?.responseStatus.notResponded ?? 0;
  const total = responded + notResponded;
  const rate = pctOf(responded, total, 0);

  return (
    <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
      <CardHeading
        icon={<ChatRoundLine weight="BoldDuotone" className="h-4 w-4 text-foreground" />}
        title="Status Follow-Up"
      />

      {/* Hero: response rate + raw counts */}
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Response rate</p>
          {loading ? (
            <Skeleton className="mt-1 h-9 w-20" />
          ) : (
            <p className="font-heading text-3xl font-semibold leading-tight text-foreground tabular-nums">
              {`${rate}%`}
            </p>
          )}
        </div>
        <div className="flex items-end gap-5">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Sudah</p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-12" />
            ) : (
              <p className="font-heading text-lg font-semibold text-foreground tabular-nums">
                {fmt(responded)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Perlu</p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-12" />
            ) : (
              <p
                className={cn(
                  "font-heading text-lg font-semibold tabular-nums",
                  notResponded > 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {fmt(notResponded)}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-2.5 w-full" />
      ) : (
        <ProportionBar
          className="mt-3 h-2.5"
          segments={[
            { value: responded, className: "bg-primary" },
            { value: notResponded, className: "bg-destructive" },
          ]}
        />
      )}

      {/* Per-sales breakdown */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Per Sales</p>
          <p className="text-[11px] text-muted-foreground">backlog terbanyak di atas</p>
        </div>
        <SalesBreakdownTable rows={data?.sales ?? []} loading={loading} />
      </div>
    </Card>
  );
}

function SalesBreakdownTable({
  rows,
  loading,
}: {
  rows: OverviewSalesBucket[];
  loading: boolean;
}): React.ReactElement {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Belum ada data</p>;
  }

  const sorted = [...rows].sort(
    (a, b) => b.notResponded - a.notResponded || b.count - a.count,
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sales</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">DB Kantor</TableHead>
          <TableHead className="text-right">DB Mandiri</TableHead>
          <TableHead className="text-right">Sudah FU</TableHead>
          <TableHead className="text-right">Belum FU</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt(row.count)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt(row.kantor)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt(row.mandiri)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmt(row.responded)}</TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                row.notResponded > 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {fmt(row.notResponded)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
