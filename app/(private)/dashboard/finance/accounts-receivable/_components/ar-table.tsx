"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AltArrowLeft,
  AltArrowRight,
  AltArrowDown,
  Eye,
  Wallet,
  Copy,
  ChatRoundLine,
  VerifiedCheck,
  UndoLeft,
  AddSquare,
  Document,
} from "@solar-icons/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IssueInvoiceDrawer } from "./IssueInvoiceDrawer";
import {
  fmtRp,
  fmtDate,
  getTerminBadge,
  getInvoiceBadge,
  getBookingStatusBadge,
  getRecognizedRevenueBadge,
  StatusBadge,
} from "./ar-format";
import type { ARBooking, ARTermin } from "@/types/finance";

interface ARTableProps {
  bookings: ARBooking[];
  loading: boolean;
  /** Toolbar row rendered inside the card, above the table (search + filters + count + toggle). */
  toolbar?: React.ReactNode;
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
  toolbar,
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
  // Issue-invoice drawer state — the only doc action left on this page.
  const [issueDrawerTarget, setIssueDrawerTarget] = useState<{
    termId: string;
    termName: string;
    termAmount: number;
    termDueDate: string | null;
    bookingId: string;
  } | null>(null);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-0">
          {toolbar && <div className="border-b border-border px-4 pb-3">{toolbar}</div>}
          {/* Desktop skeleton */}
          <div className="hidden lg:block overflow-x-auto">
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
          <div className="lg:hidden flex flex-col gap-3 p-4">
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
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-0">
      {toolbar && <div className="border-b border-border px-4 pb-3">{toolbar}</div>}
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
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
      <div className="lg:hidden flex flex-col gap-3 p-4">
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
        <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-4">
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

        </CardContent>
      </Card>

      <IssueInvoiceDrawer
        open={!!issueDrawerTarget}
        onOpenChange={(open) => { if (!open) setIssueDrawerTarget(null); }}
        termId={issueDrawerTarget?.termId ?? ""}
        termName={issueDrawerTarget?.termName ?? ""}
        termAmount={issueDrawerTarget?.termAmount ?? 0}
        termDueDate={issueDrawerTarget?.termDueDate ?? null}
        bookingId={issueDrawerTarget?.bookingId ?? ""}
      />
    </TooltipProvider>
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
                detail. Scrolls horizontally only if the viewport is narrow —
                a fixed min-width per column beats squeezing them into 100%. */}
            <div className="p-3">
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table className="min-w-[1040px] table-fixed">
                  <colgroup>
                    <col style={{ width: "150px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "130px" }} />
                    <col style={{ width: "120px" }} />
                    <col style={{ width: "100px" }} />
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
                      <TableHead className={TH}>Note</TableHead>
                      <TableHead className={TH}>Invoice</TableHead>
                      <TableHead className={cn(TH, "text-right")}>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {booking.termins.map((termin) => (
                      <TerminRow
                        key={termin.id}
                        termin={termin}
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
  onIssueInvoice,
}: {
  termin: ARTermin;
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
        <TerminActions termin={termin} onIssueInvoice={onIssueInvoice} />
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
  onIssueInvoice,
}: {
  termin: ARTermin;
  onIssueInvoice: () => void;
}) {
  const terminBadge = getTerminBadge(termin.status);
  const invoiceBadge = getInvoiceBadge(termin.statusInvoice);

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
      <TableCell className="truncate px-4 py-3 align-middle text-sm text-foreground">
        {termin.catatan || "-"}
      </TableCell>
      {/* Invoice entity badge (FIX C) */}
      <TableCell className="px-4 py-3 align-middle">
        <InvoiceEntityBadge invoice={termin.invoice} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle text-right">
        <TerminActions termin={termin} onIssueInvoice={onIssueInvoice} />
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
  onIssueInvoice,
}: {
  termin: ARTermin;
  onIssueInvoice: () => void;
}): React.ReactElement {
  const hasActiveInvoice = termin.invoice?.status === "issued";

  // Once an invoice is issued there's nothing to do here — the Invoice column
  // already shows its number. Only offer issuing while none is active.
  if (hasActiveInvoice) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onIssueInvoice}
            aria-label="Terbitkan invoice"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <AddSquare weight="BoldDuotone" className="size-4" />
          </button>
        }
      />
      <TooltipContent>Terbitkan Invoice</TooltipContent>
    </Tooltip>
  );
}

/* ─── WhatsApp reminder (direct) — opens WA with a draft from booking data ───── */

function ReminderPopover({ booking, triggerClassName }: { booking: ARBooking; triggerClassName?: string }): React.ReactElement {
  // Draft nyata dari data booking (nama, sisa, jatuh tempo). Klik langsung buka
  // WhatsApp dengan pesan sudah terisi — user tinggal pilih kontak & kirim.
  const draft =
    `Halo ${booking.customerEvent}, mengingatkan pembayaran untuk ${booking.namaEvent} ` +
    `(${booking.noPo}) sebesar ${fmtRp(booking.outstanding)} yang jatuh tempo ` +
    `${fmtDate(booking.jatuhTempo)}. Mohon konfirmasinya, terima kasih. 🙏`;

  const btnClass = triggerClassName ?? "cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(draft)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Ingatkan via WhatsApp"
      aria-label="Ingatkan via WhatsApp"
      className={btnClass}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <ChatRoundLine weight="BoldDuotone" className="size-4" />
    </a>
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

