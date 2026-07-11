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
  FileSend,
  Wallet,
  Copy,
  Copy as CopyIcon,
  ChatRoundLine,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer } from "@/components/shared/drawer";
import {
  fmtRp,
  fmtDate,
  getTerminBadge,
  getInvoiceBadge,
  getAckBadge,
  getBookingStatusBadge,
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
  // Doc-preview drawers live at the table level so a single instance serves every row.
  const [kwitansiTarget, setKwitansiTarget] = useState<DocTarget | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<DocTarget | null>(null);
  const [rekapBooking, setRekapBooking] = useState<ARBooking | null>(null);

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
                  onRekap={() => setRekapBooking(booking)}
                  onOpenInvoice={(termin) => setInvoiceTarget({ booking, termin })}
                  onOpenKwitansi={(termin) => setKwitansiTarget({ booking, termin })}
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

/* ─── Termin Row (child) ───────────────────────────────────────────────────── */

function TerminRow({
  termin,
  onOpenInvoice,
  onOpenKwitansi,
}: {
  termin: ARTermin;
  onOpenInvoice: () => void;
  onOpenKwitansi: () => void;
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
      <TableCell className="px-4 py-3 align-middle">
        <TerminActions termin={termin} onOpenInvoice={onOpenInvoice} onOpenKwitansi={onOpenKwitansi} />
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
}: {
  termin: ARTermin;
  onOpenInvoice: () => void;
  onOpenKwitansi: () => void;
}) {
  // Termin actions: preview invoice + preview kwitansi.
  // Kwitansi (receipt) only makes sense once the termin is paid.
  const canKwitansi = termin.status === "paid";
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        onClick={onOpenInvoice}
        title="Preview invoice"
      >
        <FileSend weight="BoldDuotone" className="size-4" />
      </button>
      {canKwitansi ? (
        <button
          className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onOpenKwitansi}
          title="Preview kwitansi"
        >
          <DownloadMinimalistic weight="BoldDuotone" className="size-4" />
        </button>
      ) : (
        <button
          disabled
          className="cursor-not-allowed rounded-lg p-1.5 text-muted-foreground/40"
          title="Kwitansi tersedia setelah lunas"
        >
          <DownloadMinimalistic weight="BoldDuotone" className="size-4" />
        </button>
      )}
    </div>
  );
}

/* ─── Reminder Popover (Bell) — collection reminder draft (PREVIEW) ─────────── */

function ReminderPopover({ booking }: { booking: ARBooking }): React.ReactElement {
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

  return (
    <Popover>
      <PopoverTrigger
        title="Ingatkan penagihan"
        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
