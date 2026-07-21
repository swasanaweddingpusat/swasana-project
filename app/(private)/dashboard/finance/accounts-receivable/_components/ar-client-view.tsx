"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AltArrowDown } from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtRp, getTerminBadge, StatusBadge } from "./ar-format";
import type { ARBooking, ARClientRow } from "@/types/finance";

/* ─── TH constants (mirror ar-table.tsx convention) ────────────────────────── */

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
const THR = cn(TH, "text-right");

/* ─── Aggregation (pure client-side reduce) ─────────────────────────────────── */

export function aggregateByClient(bookings: ARBooking[]): ARClientRow[] {
  const map = new Map<string, ARClientRow>();

  bookings.forEach((b) => {
    const key = b.customerEvent;
    const existing = map.get(key);
    const booking = {
      id: b.id,
      noPo: b.noPo,
      namaEvent: b.namaEvent,
      totalPrice: b.totalPrice,
      outstanding: b.outstanding,
      statusTermin: b.statusTermin,
    };

    if (existing) {
      existing.bookingCount += 1;
      existing.totalKontrak += b.totalPrice;
      existing.dibayar += b.totalPrice - b.outstanding;
      existing.sisa += b.outstanding;
      existing.bookings.push(booking);
    } else {
      map.set(key, {
        client: key,
        bookingCount: 1,
        totalKontrak: b.totalPrice,
        dibayar: b.totalPrice - b.outstanding,
        sisa: b.outstanding,
        bookings: [booking],
      });
    }
  });

  // Sort by sisa desc — biggest outstanding first, fully-paid last
  return Array.from(map.values()).sort((a, b) => b.sisa - a.sisa);
}

/* ─── KPI Strip ─────────────────────────────────────────────────────────────── */

interface KpiProps {
  label: string;
  value: string;
  emphasize?: boolean;
}

function KpiCard({ label, value, emphasize = false }: KpiProps): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-heading text-xl font-bold tabular-nums", emphasize ? "text-destructive" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

/* ─── Client Row (parent) ───────────────────────────────────────────────────── */

function ClientRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: ARClientRow;
  isExpanded: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const hasSisa = row.sisa > 0;

  return (
    <>
      <TableRow
        className={cn(
          "h-14 cursor-pointer bg-card align-middle transition-colors hover:bg-secondary/40",
          isExpanded && "bg-secondary/30 hover:bg-secondary/30",
        )}
        onClick={onToggle}
      >
        {/* Client */}
        <TableCell className="px-4 py-3 align-middle">
          <div className="flex items-center gap-2">
            <AltArrowDown
              weight="BoldDuotone"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
            <span className="truncate text-sm font-semibold text-foreground">{row.client}</span>
          </div>
        </TableCell>

        {/* # Booking */}
        <TableCell className="px-4 py-3 text-center align-middle">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-secondary px-2 text-xs font-semibold text-foreground">
            {row.bookingCount}
          </span>
        </TableCell>

        {/* Total Kontrak */}
        <TableCell className="px-4 py-3 text-right align-middle text-sm tabular-nums text-foreground">
          {fmtRp(row.totalKontrak)}
        </TableCell>

        {/* Dibayar */}
        <TableCell className="px-4 py-3 text-right align-middle text-sm tabular-nums text-foreground">
          {fmtRp(row.dibayar)}
        </TableCell>

        {/* Sisa */}
        <TableCell
          className={cn(
            "px-4 py-3 text-right align-middle text-sm tabular-nums font-semibold",
            hasSisa ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {fmtRp(row.sisa)}
        </TableCell>

        {/* Chevron column */}
        <TableCell className="w-10 px-2 py-3 align-middle" />
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-secondary/30 hover:bg-secondary/30">
          <TableCell colSpan={6} className="p-0">
            <div className="p-3">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table className="table-fixed">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className={TH}>No PO</TableHead>
                      <TableHead className={TH}>Nama Event</TableHead>
                      <TableHead className={THR}>Total</TableHead>
                      <TableHead className={THR}>Outstanding</TableHead>
                      <TableHead className={TH}>Status</TableHead>
                      <TableHead className={cn(TH, "text-right")}>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.bookings.map((b) => {
                      const badge = getTerminBadge(b.statusTermin);
                      const bHasSisa = b.outstanding > 0;
                      return (
                        <TableRow
                          key={b.id}
                          className="bg-card align-middle transition-colors hover:bg-secondary/40"
                        >
                          <TableCell className="truncate px-4 py-2.5 align-middle text-sm font-medium text-foreground">
                            {b.noPo}
                          </TableCell>
                          <TableCell className="truncate px-4 py-2.5 align-middle text-sm text-foreground">
                            {b.namaEvent}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right align-middle text-sm tabular-nums text-foreground">
                            {fmtRp(b.totalPrice)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-4 py-2.5 text-right align-middle text-sm tabular-nums",
                              bHasSisa ? "font-semibold text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {fmtRp(b.outstanding)}
                          </TableCell>
                          <TableCell className="px-4 py-2.5 align-middle">
                            <StatusBadge config={badge} />
                          </TableCell>
                          <TableCell className="px-4 py-2.5 text-right align-middle">
                            <Link
                              href="/dashboard/finance/accounts-receivable"
                              className="inline-flex h-6 items-center rounded-full bg-secondary px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              Lihat Termin
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ─── Main View ─────────────────────────────────────────────────────────────── */

interface ARClientViewProps {
  bookings: ARBooking[];
  loading: boolean;
}

export function ARClientView({ bookings, loading }: ARClientViewProps): React.ReactElement {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const rows = useMemo(() => aggregateByClient(bookings), [bookings]);

  const totalKontrak = useMemo(() => rows.reduce((s, r) => s + r.totalKontrak, 0), [rows]);
  const totalDibayar = useMemo(() => rows.reduce((s, r) => s + r.dibayar, 0), [rows]);
  const totalSisa = useMemo(() => rows.reduce((s, r) => s + r.sisa, 0), [rows]);

  function toggleClient(client: string): void {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(client)) {
        next.delete(client);
      } else {
        next.add(client);
      }
      return next;
    });
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {/* KPI skeleton */}
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-36" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {["Client", "#Booking", "Total Kontrak", "Dibayar", "Sisa", ""].map((h) => (
                  <TableHead key={h} className={h === "#Booking" ? cn(TH, "text-center") : h === "" ? TH : THR.replace("text-right", h === "Client" ? "" : "text-right")}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="h-14">
                  {Array.from({ length: 6 }).map((_, j) => (
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
      {/* KPI strip — 3 metric cards */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label="Total Kontrak" value={fmtRp(totalKontrak)} />
        <KpiCard label="Total Dibayar" value={fmtRp(totalDibayar)} />
        <KpiCard label="Total Sisa" value={fmtRp(totalSisa)} emphasize={totalSisa > 0} />
      </div>

      {/* Client table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className={TH}>Client</TableHead>
              <TableHead className={cn(TH, "text-center")}>#Booking</TableHead>
              <TableHead className={THR}>Total Kontrak</TableHead>
              <TableHead className={THR}>Dibayar</TableHead>
              <TableHead className={THR}>Sisa</TableHead>
              <TableHead className={TH} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  Tidak ada data client.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <ClientRow
                  key={row.client}
                  row={row}
                  isExpanded={expandedClients.has(row.client)}
                  onToggle={() => toggleClient(row.client)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
