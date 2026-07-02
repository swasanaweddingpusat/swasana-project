"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AltArrowLeft,
  AltArrowRight,
  AltArrowDown,
  Eye,
  Card,
  Bell,
  DownloadMinimalistic,
  FileSend,
  Wallet,
  Copy,
} from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fmtRp,
  fmtDate,
  getTerminBadge,
  getInvoiceBadge,
  getAckBadge,
  getBookingStatusBadge,
  StatusBadge,
} from "./ar-format";
import type { ARBooking, ARTermin } from "@/types/finance";

interface ARTableProps {
  bookings: ARBooking[];
  loading: boolean;
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
  onOpenDetail: (booking: ARBooking) => void;
  onEditKeuangan?: (booking: ARBooking) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canEditKeuangan?: boolean; // booking:edit OR finance-ar:edit
}

/** Shared header cell styling — small uppercase labels, the data-table convention. */
const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
/** Right-aligned variant for numeric columns. */
const THR = cn(TH, "text-right");

/* ─── Pagination ───────────────────────────────────────────────────────────── */

function genPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  )
    pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

/* ─── Main Table ───────────────────────────────────────────────────────────── */

export function ARTable({
  bookings,
  loading,
  expandedRows,
  onToggleRow,
  onOpenDetail,
  onEditKeuangan,
  currentPage,
  totalPages,
  onPageChange,
  canEditKeuangan = false,
}: ARTableProps) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {["Customer Event", "Nama Event", "Total Price", "Outstanding", "Jatuh Tempo", "Status Booking", "Status Termin", "Aksi"].map((h) => (
                <TableHead key={h} className={TH}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="h-18">
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
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "17%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className={TH}>Customer Event</TableHead>
              <TableHead className={TH}>Nama Event</TableHead>
              <TableHead className={THR}>Total Price</TableHead>
              <TableHead className={THR}>Outstanding</TableHead>
              <TableHead className={TH}>Jatuh Tempo</TableHead>
              <TableHead className={TH}>Status Booking</TableHead>
              <TableHead className={TH}>Status Termin</TableHead>
              <TableHead className={cn(TH, "text-right")}>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                  Tidak ada data piutang.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  isExpanded={expandedRows.has(booking.id)}
                  onToggle={() => onToggleRow(booking.id)}
                  onDetail={() => onOpenDetail(booking)}
                  onEditKeuangan={onEditKeuangan ? () => onEditKeuangan(booking) : undefined}
                  canEditKeuangan={canEditKeuangan}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <div className="flex flex-1 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="gap-1 rounded-full"
            >
              <AltArrowLeft weight="BoldDuotone" className="size-4" />
              Previous
            </Button>
          </div>

          <div className="flex items-center gap-0.5">
            {genPages(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="flex size-9 items-center justify-center text-sm font-medium text-muted-foreground">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  className={cn(
                    "flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors",
                    currentPage === p
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <div className="flex flex-1 items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="gap-1 rounded-full"
            >
              Next
              <AltArrowRight weight="BoldDuotone" className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Booking Row (parent) ─────────────────────────────────────────────────── */

function BookingRow({
  booking,
  isExpanded,
  onToggle,
  onDetail,
  onEditKeuangan,
  canEditKeuangan,
}: {
  booking: ARBooking;
  isExpanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onEditKeuangan?: () => void;
  canEditKeuangan: boolean;
}) {
  const bookingStatusBadge = getBookingStatusBadge(booking.bookingStatus);
  const terminBadge = getTerminBadge(booking.statusTermin);
  const isLunas = booking.outstanding <= 0;

  return (
    <>
      <TableRow
        className={cn(
          "h-18 cursor-pointer bg-card align-middle transition-colors hover:bg-secondary/40",
          isExpanded && "bg-secondary/30 hover:bg-secondary/30"
        )}
        onClick={onToggle}
      >
        <TableCell className="px-4 py-3 align-middle">
          <div className="flex items-center gap-2">
            <AltArrowDown
              weight="BoldDuotone"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{booking.customerEvent}</div>
              <div className="truncate text-xs text-muted-foreground">
                {booking.noPo} · {fmtDate(booking.customerDate)}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="truncate px-4 py-3 align-middle text-sm text-foreground">
          {booking.namaEvent}
        </TableCell>
        <TableCell className="px-4 py-3 text-right align-middle text-sm tabular-nums text-foreground">
          {fmtRp(booking.totalPrice)}
        </TableCell>
        <TableCell
          className={cn(
            "px-4 py-3 text-right align-middle text-sm tabular-nums",
            isLunas ? "text-muted-foreground" : "font-semibold text-foreground"
          )}
        >
          {fmtRp(booking.outstanding)}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle text-sm text-foreground">
          {fmtDate(booking.jatuhTempo)}
        </TableCell>
        <TableCell className="px-4 py-3 align-middle">
          <StatusBadge config={bookingStatusBadge} />
        </TableCell>
        <TableCell className="px-4 py-3 align-middle">
          <StatusBadge config={terminBadge} />
        </TableCell>
        <TableCell className="px-4 py-3 align-middle">
          <div
            className="flex items-center justify-end gap-0.5"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onDetail}
              title="Detail"
            >
              <Eye weight="BoldDuotone" className="size-4" />
            </button>
            <button disabled className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40" title="Segera hadir">
              <Card weight="BoldDuotone" className="size-4" />
            </button>
            <button disabled className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40" title="Segera hadir">
              <Bell weight="BoldDuotone" className="size-4" />
            </button>
            {canEditKeuangan && onEditKeuangan && (
              <button
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={onEditKeuangan}
                title="Edit Keuangan"
              >
                <Wallet weight="BoldDuotone" className="size-4" />
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && booking.termins.length > 0 && (
        <TableRow className="bg-secondary/30 hover:bg-secondary/30">
          <TableCell colSpan={8} className="p-0">
            {/* Inset panel: own card so it reads clearly as the row's child
                detail. Single, even padding — no extra left indent. */}
            <div className="p-3">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Table className="table-fixed">
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "7%" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className={TH}>Termin</TableHead>
                      <TableHead className={TH}>Due Date</TableHead>
                      <TableHead className={THR}>Amount</TableHead>
                      <TableHead className={TH}>Status Termin</TableHead>
                      <TableHead className={TH}>Status Invoice</TableHead>
                      <TableHead className={THR}>Aging</TableHead>
                      <TableHead className={TH}>Piutang Ack</TableHead>
                      <TableHead className={TH}>Note</TableHead>
                      <TableHead className={cn(TH, "text-right")}>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booking.termins.map((termin) => (
                      <TerminRow key={termin.id} termin={termin} />
                    ))}
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

/* ─── Termin Row (child) ───────────────────────────────────────────────────── */

function TerminRow({ termin }: { termin: ARTermin }) {
  const terminBadge = getTerminBadge(termin.status);
  const invoiceBadge = getInvoiceBadge(termin.statusInvoice);
  const ackBadge = getAckBadge(termin.ackStatus);

  return (
    <TableRow className="bg-card align-middle transition-colors hover:bg-secondary/40">
      <TableCell className="px-4 py-3 align-middle">
        <div className="truncate text-sm font-medium text-foreground">{termin.name}</div>
        <CopyableInvoice value={termin.noInvoice} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle text-sm text-foreground">
        {fmtDate(termin.dueDate)}
      </TableCell>
      <TableCell className="px-4 py-3 text-right align-middle text-sm font-semibold tabular-nums text-foreground">
        {fmtRp(termin.amount)}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <StatusBadge config={terminBadge} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <StatusBadge config={invoiceBadge} />
      </TableCell>
      <TableCell className="px-4 py-3 text-right align-middle text-sm tabular-nums text-foreground">
        {termin.agingDays != null ? `+${termin.agingDays}` : "-"}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="space-y-0.5">
          <StatusBadge config={ackBadge} />
          {termin.acknowledgedAt && termin.acknowledgedByName && (
            <p className="truncate text-xs text-muted-foreground">
              {termin.acknowledgedByName} · {fmtDate(termin.acknowledgedAt)}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="truncate px-4 py-3 align-middle text-sm text-foreground">
        {termin.catatan || "-"}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <TerminActions termin={termin} />
      </TableCell>
    </TableRow>
  );
}

/* ─── Copyable invoice number ──────────────────────────────────────────────── */

function CopyableInvoice({ value }: { value: string }) {
  if (!value) {
    return <span className="block truncate text-xs text-muted-foreground">Belum ada invoice</span>;
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    void navigator.clipboard.writeText(value);
    toast.success("No invoice disalin", { duration: 1500 });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Salin ${value}`}
      className="group/inv inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="truncate">{value}</span>
      <Copy
        weight="BoldDuotone"
        className="size-3 shrink-0 opacity-0 transition-opacity group-hover/inv:opacity-100"
      />
    </button>
  );
}

/* ─── Termin Actions ───────────────────────────────────────────────────────── */

function TerminActions({ termin }: { termin: ARTermin }) {
  // Termin actions: download invoice + download kwitansi only.
  // Kwitansi (receipt) only makes sense once the termin is paid.
  const canKwitansi = termin.status === "paid";
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        disabled
        className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40"
        title="Download invoice — segera hadir"
      >
        <FileSend weight="BoldDuotone" className="size-4" />
      </button>
      <button
        disabled
        className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40"
        title={canKwitansi ? "Download kwitansi — segera hadir" : "Kwitansi tersedia setelah lunas"}
      >
        <DownloadMinimalistic weight="BoldDuotone" className="size-4" />
      </button>
    </div>
  );
}
