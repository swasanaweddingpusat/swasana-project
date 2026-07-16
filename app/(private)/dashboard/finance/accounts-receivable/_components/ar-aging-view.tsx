"use client";

import { useMemo, type ReactElement } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtRp, fmtDate } from "./ar-format";
import type { ARBooking, AgingBucketKey, AgingRow } from "@/types/finance";

/** Shared header cell styling — matches ar-table.tsx convention. */
const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
/** Right-aligned variant for numeric columns. */
const THR = cn(TH, "text-right");

/* ─── Bucket helpers ─────────────────────────────────────────────────────── */

function getBucket(agingDays: number | null): AgingBucketKey {
  if (agingDays === null || agingDays <= 0) return "not_due";
  if (agingDays <= 30) return "d1_30";
  if (agingDays <= 60) return "d31_60";
  if (agingDays <= 90) return "d61_90";
  return "d90_plus";
}

const BUCKET_ORDER: AgingBucketKey[] = [
  "not_due",
  "d1_30",
  "d31_60",
  "d61_90",
  "d90_plus",
];

const BUCKET_LABELS: Record<AgingBucketKey, string> = {
  not_due: "Belum Jatuh Tempo",
  d1_30: "1–30 hari",
  d31_60: "31–60 hari",
  d61_90: "61–90 hari",
  d90_plus: ">90 hari",
};

/** Chip classes for the bucket badge in the table row. */
function getBucketChipClass(bucket: AgingBucketKey): string {
  if (bucket === "d90_plus" || bucket === "d61_90") {
    return "bg-destructive/10 text-destructive border-destructive/20";
  }
  return "bg-secondary text-muted-foreground border-border";
}

/* ─── Data derivation ──────────────────────────────────────────────────── */

function buildAgingRows(bookings: ARBooking[]): AgingRow[] {
  const rows: AgingRow[] = [];
  bookings.forEach((b) => {
    b.termins.forEach((t) => {
      if (t.status !== "paid" && t.remaining > 0) {
        rows.push({
          bookingId: b.id,
          terminId: t.id,
          client: b.customerEvent,
          noPo: b.noPo,
          terminName: t.name,
          dueDate: t.dueDate,
          outstanding: t.remaining,
          agingDays: t.agingDays,
          bucket: getBucket(t.agingDays),
          salesPicName: b.salesPicName,
          venueId: b.venueId,
          salesId: b.salesId,
        });
      }
    });
  });
  // Sort by agingDays desc — most overdue first, nulls (not_due) last.
  rows.sort((a, b) => {
    if (a.agingDays === null && b.agingDays === null) return 0;
    if (a.agingDays === null) return 1;
    if (b.agingDays === null) return -1;
    return b.agingDays - a.agingDays;
  });
  return rows;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

interface ARAgingViewProps {
  bookings: ARBooking[];
  loading: boolean;
}

export function ARAgingView({ bookings, loading }: ARAgingViewProps): ReactElement {
  const rows = useMemo(() => buildAgingRows(bookings), [bookings]);

  const bucketTotals = useMemo(() => {
    const totals: Record<AgingBucketKey, { outstanding: number; count: number }> = {
      not_due: { outstanding: 0, count: 0 },
      d1_30: { outstanding: 0, count: 0 },
      d31_60: { outstanding: 0, count: 0 },
      d61_90: { outstanding: 0, count: 0 },
      d90_plus: { outstanding: 0, count: 0 },
    };
    rows.forEach((r) => {
      totals[r.bucket].outstanding += r.outstanding;
      totals[r.bucket].count += 1;
    });
    return totals;
  }, [rows]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="mb-1.5 h-6 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Client", "No PO", "Termin", "Due Date", "Outstanding", "Aging", "Bucket", "Sales"].map(
                  (h) => (
                    <TableHead key={h} className={TH}>
                      {h}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="h-14">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j} className="px-4">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Row — 5 bucket cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {BUCKET_ORDER.map((bucket) => {
          const { outstanding, count } = bucketTotals[bucket];

          let amountClass: string;
          let labelClass: string;
          let countClass: string;

          if (bucket === "d90_plus") {
            amountClass = "font-heading text-xl font-bold tabular-nums text-destructive";
            labelClass = "mb-1 text-[11px] font-semibold uppercase tracking-wider text-destructive";
            countClass = "mt-1 text-xs text-destructive/70";
          } else {
            amountClass = "font-heading text-xl font-bold tabular-nums text-foreground";
            labelClass =
              "mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
            countClass = "mt-1 text-xs text-muted-foreground";
          }

          return (
            <div key={bucket} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className={labelClass}>{BUCKET_LABELS[bucket]}</p>
              <p className={amountClass}>{fmtRp(outstanding)}</p>
              <p className={countClass}>{count} termin</p>
            </div>
          );
        })}
      </div>

      {/* Aging Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className={TH}>Client</TableHead>
              <TableHead className={TH}>No PO</TableHead>
              <TableHead className={TH}>Termin</TableHead>
              <TableHead className={TH}>Due Date</TableHead>
              <TableHead className={THR}>Outstanding</TableHead>
              <TableHead className={THR}>Aging</TableHead>
              <TableHead className={TH}>Bucket</TableHead>
              <TableHead className={TH}>Sales</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Tidak ada piutang outstanding.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => <AgingTableRow key={row.terminId} row={row} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ─── Table Row ─────────────────────────────────────────────────────────── */

function AgingTableRow({ row }: { row: AgingRow }): ReactElement {
  const chipClass = getBucketChipClass(row.bucket);

  let agingLabel: string;
  if (row.agingDays !== null && row.agingDays > 0) {
    agingLabel = `+${row.agingDays}`;
  } else {
    agingLabel = "-";
  }

  return (
    <TableRow className="h-14 align-middle transition-colors hover:bg-secondary/40">
      <TableCell className="px-4 py-3 align-middle">
        <div className="truncate text-sm font-semibold text-foreground">{row.client}</div>
      </TableCell>
      <TableCell className="truncate px-4 py-3 align-middle text-xs text-muted-foreground">
        {row.noPo}
      </TableCell>
      <TableCell className="truncate px-4 py-3 align-middle text-sm text-foreground">
        {row.terminName}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle text-sm text-foreground">
        {fmtDate(row.dueDate)}
      </TableCell>
      <TableCell className="px-4 py-3 text-right align-middle text-sm font-semibold tabular-nums text-foreground">
        {fmtRp(row.outstanding)}
      </TableCell>
      <TableCell className="px-4 py-3 text-right align-middle text-sm tabular-nums text-foreground">
        {agingLabel}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            chipClass,
          )}
        >
          {BUCKET_LABELS[row.bucket]}
        </span>
      </TableCell>
      <TableCell className="truncate px-4 py-3 align-middle text-sm text-foreground">
        {row.salesPicName}
      </TableCell>
    </TableRow>
  );
}
