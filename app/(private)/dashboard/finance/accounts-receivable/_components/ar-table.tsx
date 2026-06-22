"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  AltArrowLeft,
  AltArrowRight,
  AltArrowDown,
  Eye,
  Card,
  Bell,
  CheckCircle,
  Refresh,
  DownloadMinimalistic,
  FileSend,
  Wallet,
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
import { acknowledgePayment } from "@/actions/payment-ack";
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
  expandedRow: string | null;
  onToggleRow: (id: string) => void;
  onOpenDetail: (booking: ARBooking) => void;
  onEditKeuangan?: (booking: ARBooking) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  canAck?: boolean; // finance-ar:edit permission
  canEditKeuangan?: boolean; // booking:edit OR finance-ar:edit
}

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
  expandedRow,
  onToggleRow,
  onOpenDetail,
  onEditKeuangan,
  currentPage,
  totalPages,
  onPageChange,
  canAck = false,
  canEditKeuangan = false,
}: ARTableProps) {
  if (loading) {
    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary hover:bg-secondary">
              {[
                "Customer Event",
                "Nama Event",
                "Total Price",
                "Outstanding",
                "Jatuh Tempo",
                "Status Booking",
                "Status Termin",
                "Actions",
              ].map((h) => (
                <TableHead key={h} className="h-11 text-xs">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="h-18">
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}>
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
    <div className="space-y-0">
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary hover:bg-secondary">
              <TableHead className="h-11 min-w-44 px-6 py-3 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Customer Event <AltArrowDown weight="BoldDuotone" className="size-3" />
                </span>
              </TableHead>
              <TableHead className="h-11 w-37.75 min-w-37.75 px-6 py-3 text-xs font-semibold text-muted-foreground">
                Nama Event
              </TableHead>
              <TableHead className="h-11 w-37.5 min-w-37.5 px-6 py-3 text-xs font-semibold text-muted-foreground">
                Total Price
              </TableHead>
              <TableHead className="h-11 w-37.5 min-w-37.5 px-6 py-3 text-xs font-semibold text-muted-foreground">
                Outstanding
              </TableHead>
              <TableHead className="h-11 w-28.5 min-w-28.5 px-6 py-3 text-xs font-semibold text-muted-foreground">
                Jatuh Tempo
              </TableHead>
              <TableHead className="h-11 w-35 min-w-35 px-6 py-3 text-xs font-semibold text-muted-foreground">
                Status Booking
              </TableHead>
              <TableHead className="h-11 w-35 min-w-35 px-6 py-3 text-xs font-semibold text-muted-foreground">
                Status Termin
              </TableHead>
              <TableHead className="h-11 min-w-28.25 flex-1 px-6 py-3 text-xs font-semibold text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Tidak ada data piutang.
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  isExpanded={expandedRow === booking.id}
                  onToggle={() => onToggleRow(booking.id)}
                  onDetail={() => onOpenDetail(booking)}
                  onEditKeuangan={onEditKeuangan ? () => onEditKeuangan(booking) : undefined}
                  canAck={canAck}
                  canEditKeuangan={canEditKeuangan}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t px-6 pb-4 pt-3">
          <div className="flex flex-1 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="gap-1"
            >
              <AltArrowLeft weight="BoldDuotone" className="size-5" />
              Previous
            </Button>
          </div>

          <div className="flex items-center gap-0.5">
            {genPages(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span
                  key={`e${i}`}
                  className="flex size-10 items-center justify-center text-sm font-medium text-muted-foreground"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  className={cn(
                    "flex size-10 cursor-pointer items-center justify-center rounded-lg text-sm font-medium",
                    currentPage === p
                      ? "bg-secondary text-foreground"
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
              className="gap-1"
            >
              Next
              <AltArrowRight weight="BoldDuotone" className="size-5" />
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
  canAck,
  canEditKeuangan,
}: {
  booking: ARBooking;
  isExpanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onEditKeuangan?: () => void;
  canAck: boolean;
  canEditKeuangan: boolean;
}) {
  const bookingStatusBadge = getBookingStatusBadge(booking.bookingStatus);
  const terminBadge = getTerminBadge(booking.statusTermin);

  return (
    <>
      <TableRow
        className="h-18 cursor-pointer bg-background hover:bg-secondary/50"
        onClick={onToggle}
      >
        <TableCell className="px-6 py-4">
          <div className="flex items-start gap-2">
            <AltArrowDown
              weight="BoldDuotone"
              className={cn(
                "size-4 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
            <div>
              <div className="text-sm font-medium text-foreground">
                {booking.customerEvent}
              </div>
              <div className="text-xs text-muted-foreground">{booking.noPo}</div>
              <div className="text-xs text-muted-foreground">
                {fmtDate(booking.customerDate)}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="px-6 py-4 text-sm text-foreground">
          {booking.namaEvent}
        </TableCell>
        <TableCell className="px-6 py-4 text-sm text-foreground">
          {fmtRp(booking.totalPrice)}
        </TableCell>
        <TableCell className="px-6 py-4 text-sm font-semibold text-foreground">
          {fmtRp(booking.outstanding)}
        </TableCell>
        <TableCell className="px-6 py-4 text-sm text-foreground">
          {fmtDate(booking.jatuhTempo)}
        </TableCell>
        <TableCell className="px-6 py-4">
          <StatusBadge config={bookingStatusBadge} />
        </TableCell>
        <TableCell className="px-6 py-4">
          <StatusBadge config={terminBadge} />
        </TableCell>
        <TableCell className="p-4">
          <div
            className="flex items-center gap-0.5"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <button
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              onClick={onDetail}
              title="Detail"
            >
              <Eye weight="BoldDuotone" className="size-4" />
            </button>
            <button
              disabled
              className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
              title="Segera hadir"
            >
              <Card weight="BoldDuotone" className="size-4" />
            </button>
            <button
              disabled
              className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
              title="Segera hadir"
            >
              <Bell weight="BoldDuotone" className="size-4" />
            </button>
            {canEditKeuangan && onEditKeuangan && (
              <button
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
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
            <div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary hover:bg-secondary">
                    <TableHead className="h-11 w-32.5 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Termin
                    </TableHead>
                    <TableHead className="h-11 w-29.75 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Due Date
                    </TableHead>
                    <TableHead className="h-11 w-35 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableHead className="h-11 w-35 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Status Termin
                    </TableHead>
                    <TableHead className="h-11 w-35 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      No Invoice
                    </TableHead>
                    <TableHead className="h-11 w-32.5 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Status Invoice
                    </TableHead>
                    <TableHead className="h-11 w-28.5 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Aging (days)
                    </TableHead>
                    <TableHead className="h-11 w-36 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Piutang Ack
                    </TableHead>
                    <TableHead className="h-11 w-30 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Note
                    </TableHead>
                    <TableHead className="h-11 min-w-21.75 flex-1 px-6 py-3 text-xs font-semibold text-muted-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {booking.termins.map((termin) => (
                    <TerminRow key={termin.id} termin={termin} canAck={canAck} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ─── Termin Row (child) ───────────────────────────────────────────────────── */

function TerminRow({ termin, canAck }: { termin: ARTermin; canAck: boolean }) {
  const terminBadge = getTerminBadge(termin.status);
  const invoiceBadge = getInvoiceBadge(termin.statusInvoice);
  const ackBadge = getAckBadge(termin.ackStatus);

  return (
    <TableRow className="h-18 bg-background hover:bg-secondary/30">
      <TableCell className="px-6 py-4 text-sm text-foreground">
        {termin.name}
      </TableCell>
      <TableCell className="px-6 py-4 text-sm text-foreground">
        {fmtDate(termin.dueDate)}
      </TableCell>
      <TableCell className="px-6 py-4 text-sm font-semibold text-foreground">
        {fmtRp(termin.amount)}
      </TableCell>
      <TableCell className="px-6 py-4">
        <StatusBadge config={terminBadge} />
      </TableCell>
      <TableCell className="px-6 py-4 text-sm text-foreground">
        {termin.noInvoice || "-"}
      </TableCell>
      <TableCell className="px-6 py-4">
        <StatusBadge config={invoiceBadge} />
      </TableCell>
      <TableCell className="px-6 py-4 text-sm text-foreground">
        {termin.agingDays != null ? `+${termin.agingDays}` : "-"}
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="space-y-0.5">
          <StatusBadge config={ackBadge} />
          {termin.acknowledgedAt && termin.acknowledgedByName && (
            <p className="text-xs text-muted-foreground">
              {termin.acknowledgedByName} · {fmtDate(termin.acknowledgedAt)}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="px-6 py-4 text-sm text-foreground max-w-30 truncate">
        {termin.catatan || "-"}
      </TableCell>
      <TableCell className="p-4">
        <TerminActions termin={termin} canAck={canAck} />
      </TableCell>
    </TableRow>
  );
}

/* ─── Ack Button ────────────────────────────────────────────────────────────── */

function AckButton({ topId }: { topId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();

  function handleAck() {
    setErr(null);
    startTransition(async () => {
      const result = await acknowledgePayment(topId);
      if (result.success) {
        setDone(true);
        // Invalidate supaya TanStack Query refetch data AR terbaru.
        // revalidateTag("ar-bookings","max") di server action sudah invalidate
        // Next.js cache; ini invalidate TanStack Query client cache juga.
        void qc.invalidateQueries({ queryKey: ["ar-bookings"] });
      } else {
        setErr(result.error);
      }
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
        <CheckCircle weight="BoldDuotone" className="size-3.5" />
        Acked
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={handleAck}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium transition-colors",
          isPending
            ? "cursor-not-allowed text-muted-foreground"
            : "cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary text-foreground"
        )}
        title="Acknowledge payment"
      >
        {isPending ? (
          <Refresh weight="BoldDuotone" className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle weight="BoldDuotone" className="size-3.5" />
        )}
        Ack
      </button>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

/* ─── Termin Actions (context-aware) ───────────────────────────────────────── */

function TerminActions({ termin, canAck }: { termin: ARTermin; canAck: boolean }) {
  // Show Ack button when TOP is paid but not yet acknowledged (Finance can ack)
  const showAck = canAck && termin.status === "paid" && termin.ackStatus !== "acknowledged";

  if (termin.status === "paid") {
    return (
      <div className="flex items-center gap-0.5">
        <button
          disabled
          className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
          title="Segera hadir"
        >
          <Eye weight="BoldDuotone" className="size-4" />
        </button>
        <button
          disabled
          className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
          title="Segera hadir"
        >
          <DownloadMinimalistic weight="BoldDuotone" className="size-4" />
        </button>
        {showAck && <AckButton topId={termin.id} />}
      </div>
    );
  }

  if (termin.status === "overdue") {
    return (
      <div className="flex items-center gap-0.5">
        <button
          disabled
          className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
          title="Segera hadir"
        >
          <Card weight="BoldDuotone" className="size-4" />
        </button>
        <button
          disabled
          className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
          title="Segera hadir"
        >
          <Bell weight="BoldDuotone" className="size-4" />
        </button>
      </div>
    );
  }

  if (termin.statusInvoice === "unissued") {
    return (
      <div className="flex items-center gap-0.5">
        <button
          disabled
          className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
          title="Segera hadir"
        >
          <FileSend weight="BoldDuotone" className="size-4" />
        </button>
        <button
          disabled
          className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
          title="Segera hadir"
        >
          <Bell weight="BoldDuotone" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        disabled
        className="cursor-not-allowed rounded-md p-1.5 text-muted-foreground/40"
        title="Segera hadir"
      >
        <Card weight="BoldDuotone" className="size-4" />
      </button>
    </div>
  );
}
