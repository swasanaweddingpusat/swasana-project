"use client";

import { useState } from "react";
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
  Wallet,
  Copy,
  Copy as CopyIcon,
  ChatRoundLine,
  VerifiedCheck,
  UndoLeft,
  AddSquare,
  Document,
  Restart,
  MenuDots,
  TrashBinTrash,
} from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer } from "@/components/shared/drawer";
import { IssueInvoiceDrawer } from "./IssueInvoiceDrawer";
import { useVoidInvoice } from "@/hooks/use-invoices";
import {
  fmtRp,
  fmtDate,
  getTerminBadge,
  getInvoiceBadge,
  getAckBadge,
  getBookingStatusBadge,
  getRecognizedRevenueBadge,
  StatusBadge,
} from "./ar-format";
import { KwitansiPreviewDrawer } from "./kwitansi-preview-drawer";
import { InvoicePreviewDrawer } from "./invoice-preview-drawer";
import type { ARBooking, ARTermin } from "@/types/finance";

/** A preview target ties a termin back to its parent booking for the doc drawers. */
interface DocTarget {
  booking: ARBooking;
  termin: ARTermin;
}

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
  /** Confirm + recognize all "paid" termin revenue for a booking (client-level, all at once). Preview-only, no backend. */
  onRecognize?: (booking: ARBooking) => void;
  /** Undo a previously recognized booking. Preview-only, no backend. */
  onUndoRecognize?: (booking: ARBooking) => void;
  /** Booking ids whose revenue has been recognized (client-side dummy state). */
  recognizedIds?: Set<string>;
}

/** Shared 40px mobile tap target — meets WCAG 2.5.5 (Target Size) for touchscreens. */
const MOBILE_ACTION_BTN = "flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

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
  onRecognize,
  onUndoRecognize,
  recognizedIds,
}: ARTableProps) {
  // Doc-preview drawers live at the table level so a single instance serves every row.
  const [kwitansiTarget, setKwitansiTarget] = useState<DocTarget | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<DocTarget | null>(null);
  const [rekapBooking, setRekapBooking] = useState<ARBooking | null>(null);

  // Issue-invoice drawer state
  const [issueDrawerTarget, setIssueDrawerTarget] = useState<{
    termId: string;
    termName: string;
    termAmount: number;
    termDueDate: string | null;
    bookingId: string;
  } | null>(null);

  if (loading) {
    return (
      <>
        {/* Desktop skeleton */}
        <div className="hidden lg:block overflow-hidden rounded-2xl border border-border bg-card">
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
        {/* Mobile skeleton */}
        <div className="lg:hidden flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="mt-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <div className="hidden lg:block overflow-hidden rounded-2xl border border-border bg-card">
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
                  onRekap={() => setRekapBooking(booking)}
                  onOpenInvoice={(termin) => setInvoiceTarget({ booking, termin })}
                  onOpenKwitansi={(termin) => setKwitansiTarget({ booking, termin })}
                  onIssueInvoice={(termin) =>
                    setIssueDrawerTarget({
                      termId: termin.id,
                      termName: termin.name,
                      termAmount: termin.amount,
                      termDueDate: termin.dueDate,
                      bookingId: booking.id,
                    })
                  }
                  onRecognize={onRecognize ? () => onRecognize(booking) : undefined}
                  onUndoRecognize={onUndoRecognize ? () => onUndoRecognize(booking) : undefined}
                  isRecognized={recognizedIds?.has(booking.id) ?? false}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="lg:hidden flex flex-col gap-3">
        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Tidak ada data piutang.</p>
          </div>
        ) : (
          bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              isExpanded={expandedRows.has(booking.id)}
              onToggle={() => onToggleRow(booking.id)}
              onDetail={() => onOpenDetail(booking)}
              onEditKeuangan={onEditKeuangan ? () => onEditKeuangan(booking) : undefined}
              canEditKeuangan={canEditKeuangan}
              onRekap={() => setRekapBooking(booking)}
              onOpenInvoice={(termin) => setInvoiceTarget({ booking, termin })}
              onOpenKwitansi={(termin) => setKwitansiTarget({ booking, termin })}
              onIssueInvoice={(termin) =>
                setIssueDrawerTarget({
                  termId: termin.id,
                  termName: termin.name,
                  termAmount: termin.amount,
                  termDueDate: termin.dueDate,
                  bookingId: booking.id,
                })
              }
              onRecognize={onRecognize ? () => onRecognize(booking) : undefined}
              onUndoRecognize={onUndoRecognize ? () => onUndoRecognize(booking) : undefined}
              isRecognized={recognizedIds?.has(booking.id) ?? false}
            />
          ))
        )}
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

      <InvoicePreviewDrawer
        isOpen={!!invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
        booking={invoiceTarget?.booking ?? null}
        termin={invoiceTarget?.termin ?? null}
      />
      <KwitansiPreviewDrawer
        isOpen={!!kwitansiTarget}
        onClose={() => setKwitansiTarget(null)}
        booking={kwitansiTarget?.booking ?? null}
        termin={kwitansiTarget?.termin ?? null}
      />
      <IssueInvoiceDrawer
        open={!!issueDrawerTarget}
        onOpenChange={(open) => { if (!open) setIssueDrawerTarget(null); }}
        termId={issueDrawerTarget?.termId ?? ""}
        termName={issueDrawerTarget?.termName ?? ""}
        termAmount={issueDrawerTarget?.termAmount ?? 0}
        termDueDate={issueDrawerTarget?.termDueDate ?? null}
        bookingId={issueDrawerTarget?.bookingId ?? ""}
      />
      <RekapKwitansiDrawer
        isOpen={!!rekapBooking}
        onClose={() => setRekapBooking(null)}
        booking={rekapBooking}
        onOpenKwitansi={(termin) => {
          if (rekapBooking) setKwitansiTarget({ booking: rekapBooking, termin });
          setRekapBooking(null);
        }}
      />
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
  onRekap,
  onOpenInvoice,
  onOpenKwitansi,
  onIssueInvoice,
  onRecognize,
  onUndoRecognize,
  isRecognized = false,
}: {
  booking: ARBooking;
  isExpanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onEditKeuangan?: () => void;
  canEditKeuangan: boolean;
  onRekap: () => void;
  onOpenInvoice: (termin: ARTermin) => void;
  onOpenKwitansi: (termin: ARTermin) => void;
  onIssueInvoice: (termin: ARTermin) => void;
  onRecognize?: () => void;
  onUndoRecognize?: () => void;
  isRecognized?: boolean;
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
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge config={terminBadge} />
            {isRecognized && <StatusBadge config={getRecognizedRevenueBadge()} />}
          </div>
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
            <button
              className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={onRekap}
              title="Rekap kwitansi booking"
            >
              <Card weight="BoldDuotone" className="size-4" />
            </button>
            <ReminderPopover booking={booking} />
            {canEditKeuangan && onEditKeuangan && (
              <button
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={onEditKeuangan}
                title="Edit Keuangan"
              >
                <Wallet weight="BoldDuotone" className="size-4" />
              </button>
            )}
            {canEditKeuangan && (
              <RecognizeRevenueAction
                booking={booking}
                isRecognized={isRecognized}
                onRecognize={onRecognize}
                onUndoRecognize={onUndoRecognize}
              />
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
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "8%" }} />
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
                      <TableHead className={TH}>Via Rekening</TableHead>
                      <TableHead className={TH}>Piutang Ack</TableHead>
                      <TableHead className={TH}>Note</TableHead>
                      <TableHead className={cn(TH, "text-right")}>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booking.termins.map((termin) => (
                      <TerminRow
                        key={termin.id}
                        termin={termin}
                        onOpenInvoice={() => onOpenInvoice(termin)}
                        onOpenKwitansi={() => onOpenKwitansi(termin)}
                        onIssueInvoice={() => onIssueInvoice(termin)}
                      />
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

/* ─── Booking Card (mobile) ────────────────────────────────────────────────── */

function BookingCard({
  booking,
  isExpanded,
  onToggle,
  onDetail,
  onEditKeuangan,
  canEditKeuangan,
  onRekap,
  onOpenInvoice,
  onOpenKwitansi,
  onIssueInvoice,
  onRecognize,
  onUndoRecognize,
  isRecognized = false,
}: {
  booking: ARBooking;
  isExpanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
  onEditKeuangan?: () => void;
  canEditKeuangan: boolean;
  onRekap: () => void;
  onOpenInvoice: (termin: ARTermin) => void;
  onOpenKwitansi: (termin: ARTermin) => void;
  onIssueInvoice: (termin: ARTermin) => void;
  onRecognize?: () => void;
  onUndoRecognize?: () => void;
  isRecognized?: boolean;
}): React.ReactElement {
  const isLunas = booking.outstanding <= 0;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors",
        isExpanded && "bg-secondary/30 border-primary/20"
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <AltArrowDown
            weight="BoldDuotone"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{booking.customerEvent}</div>
            <div className="truncate text-xs text-muted-foreground">
              {booking.noPo} · {fmtDate(booking.customerDate)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge config={getTerminBadge(booking.statusTermin)} />
          {isRecognized && <StatusBadge config={getRecognizedRevenueBadge()} />}
        </div>
      </button>

      {/* Divider */}
      <div className="mt-3 border-t border-border/60 pt-3" />

      {/* Metadata */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Total Price</span>
          <span className="text-sm tabular-nums text-foreground">{fmtRp(booking.totalPrice)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Outstanding</span>
          <div className="flex items-center gap-1.5">
            {!isLunas && <span className="size-2 rounded-full bg-destructive" />}
            <span className={cn("text-sm tabular-nums", isLunas ? "text-muted-foreground" : "font-semibold text-foreground")}>
              {fmtRp(booking.outstanding)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Jatuh Tempo</span>
          <span className="text-sm text-foreground">{fmtDate(booking.jatuhTempo)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Status Booking</span>
          <StatusBadge config={getBookingStatusBadge(booking.bookingStatus)} />
        </div>
      </div>

      {/* Actions */}
      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDetail}
          title="Detail"
          aria-label="Detail booking"
          className={MOBILE_ACTION_BTN}
        >
          <Eye weight="BoldDuotone" className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRekap}
          title="Rekap kwitansi"
          aria-label="Rekap kwitansi booking"
          className={MOBILE_ACTION_BTN}
        >
          <Card weight="BoldDuotone" className="size-4" />
        </button>
        <ReminderPopover booking={booking} triggerClassName={MOBILE_ACTION_BTN} />
        {canEditKeuangan && onEditKeuangan && (
          <button
            type="button"
            onClick={onEditKeuangan}
            title="Edit Keuangan"
            aria-label="Edit keuangan booking"
            className={MOBILE_ACTION_BTN}
          >
            <Wallet weight="BoldDuotone" className="size-4" />
          </button>
        )}
        {canEditKeuangan && (
          <RecognizeRevenueAction
            booking={booking}
            isRecognized={isRecognized}
            onRecognize={onRecognize}
            onUndoRecognize={onUndoRecognize}
            triggerClassName={MOBILE_ACTION_BTN}
          />
        )}
      </div>

      {/* Expanded termin list */}
      {isExpanded && booking.termins.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {booking.termins.map((termin) => (
            <TerminCard
              key={termin.id}
              termin={termin}
              onOpenInvoice={() => onOpenInvoice(termin)}
              onOpenKwitansi={() => onOpenKwitansi(termin)}
              onIssueInvoice={() => onIssueInvoice(termin)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Termin Card (mobile sub-card) ────────────────────────────────────────── */

function TerminCard({
  termin,
  onOpenInvoice,
  onOpenKwitansi,
  onIssueInvoice,
}: {
  termin: ARTermin;
  onOpenInvoice: () => void;
  onOpenKwitansi: () => void;
  onIssueInvoice: () => void;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3">
      {/* Top row: name + invoice + amount */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{termin.name}</div>
          <CopyableInvoice value={termin.noInvoice} />
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {fmtRp(termin.amount)}
        </span>
      </div>

      {/* Badges */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <StatusBadge config={getTerminBadge(termin.status)} />
        <StatusBadge config={getInvoiceBadge(termin.statusInvoice)} />
        <StatusBadge config={getAckBadge(termin.ackStatus)} />
        <InvoiceEntityBadge invoice={termin.invoice} />
      </div>

      {/* Meta grid */}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <span className="text-muted-foreground">Due Date: </span>
          <span className="text-foreground">{fmtDate(termin.dueDate)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Aging: </span>
          <span className="text-foreground">{termin.agingDays != null ? `+${termin.agingDays}` : "-"}</span>
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Via Rekening: </span>
          {termin.viaRekening ? (
            <ViaRekeningChip value={termin.viaRekening} />
          ) : (
            <span className="text-foreground">-</span>
          )}
        </div>
        {termin.catatan && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Note: </span>
            <span className="text-foreground">{termin.catatan}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2 flex justify-end">
        <TerminActions
          termin={termin}
          onOpenInvoice={onOpenInvoice}
          onOpenKwitansi={onOpenKwitansi}
          onIssueInvoice={onIssueInvoice}
          triggerClassName={MOBILE_ACTION_BTN}
        />
      </div>
    </div>
  );
}

/* ─── Invoice Entity Badge (extracted) ─────────────────────────────────────── */

function InvoiceEntityBadge({ invoice }: { invoice: ARTermin["invoice"] }): React.ReactElement | null {
  if (invoice === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
        <Document weight="BoldDuotone" className="size-3 shrink-0" />
        Belum Ditagih
      </span>
    );
  }
  if (invoice.status === "issued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
        <Document weight="BoldDuotone" className="size-3 shrink-0" />
        {invoice.number}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground line-through">
      <Document weight="BoldDuotone" className="size-3 shrink-0" />
      {invoice.number}
    </span>
  );
}

/* ─── Termin Row (child) ───────────────────────────────────────────────────── */

function TerminRow({
  termin,
  onOpenInvoice,
  onOpenKwitansi,
  onIssueInvoice,
}: {
  termin: ARTermin;
  onOpenInvoice: () => void;
  onOpenKwitansi: () => void;
  onIssueInvoice: () => void;
}) {
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
        <ViaRekeningChip value={termin.viaRekening} />
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
      {/* Invoice entity badge (FIX C) */}
      <TableCell className="px-4 py-3 align-middle">
        <InvoiceEntityBadge invoice={termin.invoice} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <TerminActions
          termin={termin}
          onOpenInvoice={onOpenInvoice}
          onOpenKwitansi={onOpenKwitansi}
          onIssueInvoice={onIssueInvoice}
        />
      </TableCell>
    </TableRow>
  );
}

/* ─── Via Rekening chip ────────────────────────────────────────────────────── */

function ViaRekeningChip({ value }: { value: string | null }): React.ReactElement {
  if (!value) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
      {value}
    </span>
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

function TerminActions({
  termin,
  onOpenInvoice,
  onOpenKwitansi,
  onIssueInvoice,
  triggerClassName,
}: {
  termin: ARTermin;
  onOpenInvoice: () => void;
  onOpenKwitansi: () => void;
  onIssueInvoice: () => void;
  triggerClassName?: string;
}) {
  const { mutate: voidMutate, isPending: isVoiding } = useVoidInvoice();
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const canKwitansi = termin.status === "paid";
  const hasActiveInvoice = termin.invoice?.status === "issued";
  const hasVoidInvoice = termin.invoice?.status === "void";

  function handleVoid(): void {
    if (!termin.invoice) return;
    voidMutate(termin.invoice.id, {
      onSuccess: () => {
        toast.success("Invoice berhasil dibatalkan");
        setVoidConfirmOpen(false);
      },
      onError: (err) => {
        toast.error(err.message ?? "Gagal membatalkan invoice");
      },
    });
  }

  const btnClass = triggerClassName ?? "cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        {/* Kwitansi */}
        {canKwitansi ? (
          <button
            type="button"
            className={btnClass}
            onClick={onOpenKwitansi}
            title="Preview kwitansi"
            aria-label="Preview kwitansi"
          >
            <DownloadMinimalistic weight="BoldDuotone" className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40"
            title="Kwitansi tersedia setelah lunas"
          >
            <DownloadMinimalistic weight="BoldDuotone" className="size-4" />
          </button>
        )}

        {/* Invoice dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={btnClass}
              title="Aksi invoice"
              aria-label="Aksi invoice"
            >
              <MenuDots weight="BoldDuotone" className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onOpenInvoice}>
              <Eye weight="BoldDuotone" className="mr-2 size-4" />
              Preview Invoice Lama
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {!hasActiveInvoice && (
              <DropdownMenuItem onClick={onIssueInvoice}>
                {hasVoidInvoice ? (
                  <Restart weight="BoldDuotone" className="mr-2 size-4" />
                ) : (
                  <AddSquare weight="BoldDuotone" className="mr-2 size-4" />
                )}
                {hasVoidInvoice ? "Terbitkan Ulang" : "Terbitkan Invoice"}
              </DropdownMenuItem>
            )}
            {hasActiveInvoice && (
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setVoidConfirmOpen(true); }}
                className="text-destructive focus:text-destructive"
              >
                <TrashBinTrash weight="BoldDuotone" className="mr-2 size-4" />
                Batalkan Invoice
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Void confirm dialog — outside dropdown to avoid nesting issues */}
      <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Invoice {termin.invoice?.number} akan dibatalkan (void). Tindakan ini tidak bisa diurungkan. Invoice baru bisa diterbitkan ulang setelahnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoid}
              disabled={isVoiding}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isVoiding ? "Membatalkan..." : "Ya, Batalkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ─── Reminder Popover (Bell) — collection reminder draft (PREVIEW) ─────────── */

function ReminderPopover({ booking, triggerClassName }: { booking: ARBooking; triggerClassName?: string }): React.ReactElement {
  // Draft nyata dari data booking (nama, sisa, jatuh tempo). Pengiriman & log
  // follow-up masih dummy — ditandai "preview" biar finance gak nyangka terkirim.
  const draft =
    `Halo ${booking.customerEvent}, mengingatkan pembayaran untuk ${booking.namaEvent} ` +
    `(${booking.noPo}) sebesar ${fmtRp(booking.outstanding)} yang jatuh tempo ` +
    `${fmtDate(booking.jatuhTempo)}. Mohon konfirmasinya, terima kasih. 🙏`;

  function copyDraft(): void {
    void navigator.clipboard.writeText(draft);
    toast.success("Draft pesan disalin", { duration: 1500 });
  }

  const btnClass = triggerClassName ?? "cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <Popover>
      <PopoverTrigger
        title="Ingatkan penagihan"
        className={btnClass}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <Bell weight="BoldDuotone" className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-4"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Ingatkan penagihan</p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            PREVIEW
          </span>
        </div>
        <p className="mt-2 rounded-xl bg-secondary/40 p-3 text-xs leading-relaxed text-foreground">
          {draft}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" className="flex-1 gap-1.5 rounded-full" onClick={copyDraft}>
            <CopyIcon weight="BoldDuotone" className="size-3.5" />
            Salin draft
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(draft)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-border text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <ChatRoundLine weight="BoldDuotone" className="size-3.5" />
            WhatsApp
          </a>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          * Pengiriman & log follow-up belum aktif — draft ini contoh dari data booking.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Recognize Revenue Action (VerifiedCheck) — bulk client-level ack (PREVIEW) ─
   Mengakui SELURUH pendapatan termin "paid" milik satu booking/client sekaligus.
   Murni state lokal di halaman (recognizedIds) — belum nyambung ledger/backend. */

function RecognizeRevenueAction({
  booking,
  isRecognized,
  onRecognize,
  onUndoRecognize,
  triggerClassName,
}: {
  booking: ARBooking;
  isRecognized: boolean;
  onRecognize?: () => void;
  onUndoRecognize?: () => void;
  triggerClassName?: string;
}): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const btnClass = triggerClassName ?? "cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  if (isRecognized) {
    if (!onUndoRecognize) return null;
    return (
      <button
        type="button"
        className={btnClass}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onUndoRecognize();
        }}
        title="Batalkan pengakuan"
        aria-label="Batalkan pengakuan pendapatan"
      >
        <UndoLeft weight="BoldDuotone" className="size-4" />
      </button>
    );
  }

  const paidTermins = booking.termins.filter((t) => t.status === "paid");
  const hasPaidTermin = paidTermins.length > 0;

  if (!onRecognize || !hasPaidTermin) return null;

  const totalToRecognize = paidTermins.reduce((sum, t) => sum + t.amount, 0);
  const hasOutstanding = booking.outstanding > 0;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        title="Akui pendapatan"
        className={btnClass}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <VerifiedCheck weight="BoldDuotone" className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <AlertDialogHeader>
          <div className="flex w-full items-center justify-between gap-2">
            <AlertDialogTitle>Akui Pendapatan</AlertDialogTitle>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              PREVIEW
            </span>
          </div>
          <AlertDialogDescription>
            Akui seluruh pendapatan termin lunas milik{" "}
            <strong className="text-foreground">{booking.customerEvent}</strong> secara serentak —
            bukan per-termin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 px-6 pb-2">
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3 text-sm">
            <span className="text-muted-foreground">Total diakui ({paidTermins.length} termin lunas)</span>
            <span className="font-semibold tabular-nums text-foreground">{fmtRp(totalToRecognize)}</span>
          </div>
          {hasOutstanding && (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
              Masih ada piutang {fmtRp(booking.outstanding)} — pengakuan tetap bisa dilakukan
              (override Finance).
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onRecognize();
              setOpen(false);
            }}
          >
            Akui Pendapatan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─── Rekap Kwitansi Drawer (Card) — daftar termin sbagai shortcut kwitansi ── */

function RekapKwitansiDrawer({
  isOpen,
  onClose,
  booking,
  onOpenKwitansi,
}: {
  isOpen: boolean;
  onClose: () => void;
  booking: ARBooking | null;
  onOpenKwitansi: (termin: ARTermin) => void;
}): React.ReactElement {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Rekap Kwitansi" maxWidth="sm:max-w-lg">
      {booking && (
        <div className="flex flex-col gap-4 px-1 pb-6">
          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="text-sm font-semibold text-foreground">{booking.customerEvent}</p>
            <p className="text-xs text-muted-foreground">
              {booking.noPo} · {booking.namaEvent}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {booking.termins.map((termin) => {
              const paid = termin.status === "paid";
              return (
                <div
                  key={termin.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{termin.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtRp(termin.amount)} · {fmtDate(termin.dueDate)}
                    </p>
                  </div>
                  {paid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5 rounded-full"
                      onClick={() => onOpenKwitansi(termin)}
                    >
                      <DownloadMinimalistic weight="BoldDuotone" className="size-3.5" />
                      Kwitansi
                    </Button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      Belum lunas
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Drawer>
  );
}
