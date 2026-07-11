"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AltArrowLeft, AltArrowRight, CheckCircle, Copy, Paperclip2, Bill, Documents, History } from "@solar-icons/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EntryTypeChip, StatusBadge, fmtDate, fmtRp, getLedgerStatusBadge } from "./ledger-format";
import type { LedgerEntry } from "@/types/finance";

interface LedgerTableProps {
  entries: LedgerEntry[];
  loading?: boolean;
  onAck: (e: LedgerEntry) => void;
  /** Buka preview + download kwitansi PDF untuk baris ini. */
  onKwitansi: (e: LedgerEntry) => void;
  /** Buka riwayat/activity log transaksi ini. */
  onActivity: (e: LedgerEntry) => void;
  /** Jumlah baris activity per entryId — buat badge di tombol Riwayat. */
  activityCounts: Record<string, number>;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyLabel?: string;
}

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
const THR = cn(TH, "text-right");
const COL_COUNT = 8;
/** Shared focus style for interactive elements inside the list — keyboard users need a visible ring. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

function genPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

/* ─── Loading skeleton ──────────────────────────────────────────────────────── */

function LoadingSkeleton(): React.ReactElement {
  return (
    <div>
      {/* desktop */}
      <div className="hidden sm:block">
        <Table className="table-fixed">
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="h-18">
                {Array.from({ length: COL_COUNT }).map((_, j) => (
                  <TableCell key={j} className="px-4">
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* mobile */}
      <ul className="sm:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="border-b border-border/60 px-4 py-3.5 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="shrink-0 space-y-2 text-right">
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="ml-auto h-5 w-14" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────────────────────── */

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}): React.ReactElement | null {
  if (totalPages <= 1) return null;
  return (
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
          <span className="hidden sm:inline">Previous</span>
        </Button>
      </div>
      <div className="flex items-center gap-0.5">
        {genPages(currentPage, totalPages).map((p, i) =>
          p === "..." ? (
            <span
              key={`e${i}`}
              className="flex size-9 items-center justify-center text-sm font-medium text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p as number)}
              aria-current={currentPage === p ? "page" : undefined}
              className={cn(
                "flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors",
                FOCUS_RING,
                currentPage === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {p}
            </button>
          ),
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
          <span className="hidden sm:inline">Next</span>
          <AltArrowRight weight="BoldDuotone" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Linked TOP chips ───────────────────────────────────────────────────────── */

function LinkedTerminChips({ labels }: { labels: string[] }): React.ReactElement | null {
  if (!labels.length) return null;
  const visible = labels.slice(0, 2);
  const overflow = labels.length - 2;
  return (
    <>
      {visible.map((label) => (
        <span
          key={label}
          className="inline-flex max-w-28 items-center truncate rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground"
        >
          {label}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          +{overflow}
        </span>
      )}
    </>
  );
}

/* ─── Bukti bayar indicator ──────────────────────────────────────────────────── */

function BuktiBayarChip({ name }: { name: string | null }): React.ReactElement | null {
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1 truncate rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Paperclip2 weight="BoldDuotone" className="size-3 shrink-0" />
      <span className="max-w-24 truncate">{name}</span>
    </span>
  );
}

/* ─── Via rekening chip ──────────────────────────────────────────────────────── */

function ViaRekeningChip({ value }: { value: string | null }): React.ReactElement | null {
  if (!value) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">
      {value}
    </span>
  );
}

/* ─── Copyable kwitansi number ───────────────────────────────────────────────── */

function CopyableInvoice({ value }: { value: string | null }): React.ReactElement | null {
  if (!value) return null;

  function handleCopy(e: React.MouseEvent): void {
    e.stopPropagation();
    void navigator.clipboard.writeText(value as string);
    toast.success("No kwitansi disalin", { duration: 1500 });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Salin nomor kwitansi ${value}`}
      title={`Salin ${value}`}
      className={cn(
        "group/inv inline-flex items-center gap-1 rounded text-xs text-foreground transition-colors hover:text-primary",
        FOCUS_RING,
      )}
    >
      <span className="truncate">{value}</span>
      <Copy
        weight="BoldDuotone"
        className="size-3 shrink-0 opacity-0 transition-opacity group-hover/inv:opacity-100 group-focus-visible/inv:opacity-100"
      />
    </button>
  );
}

/* ─── Shared meta line (kwitansi/via/termin/bukti — atau nama promo) ─────────── */

function EntryMeta({ entry }: { entry: LedgerEntry }): React.ReactElement {
  if (entry.entryType === "discount") {
    return (
      <p className="truncate text-xs text-muted-foreground">
        {entry.discountProgramName ? `Promo: ${entry.discountProgramName}` : "—"}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {/* Baris 1: nomor kwitansi/invoice */}
      <CopyableInvoice value={entry.invoiceNumber} />
      {/* Baris 2: via rekening + termin + bukti bayar */}
      {(entry.paymentMethod ||
        entry.linkedTerminLabels.length > 0 ||
        entry.paymentEvidenceName) && (
        <div className="flex flex-wrap items-center gap-1">
          <ViaRekeningChip value={entry.paymentMethod} />
          <LinkedTerminChips labels={entry.linkedTerminLabels} />
          <BuktiBayarChip name={entry.paymentEvidenceName} />
        </div>
      )}
    </div>
  );
}

/* ─── Ack cell — pill button (pending) / signee (acknowledged) / dash ────────── */

function AckCell({
  entry,
  onAck,
  compact = false,
}: {
  entry: LedgerEntry;
  onAck: (e: LedgerEntry) => void;
  compact?: boolean;
}): React.ReactElement | null {
  if (entry.entryType !== "cash_in") {
    return compact ? null : <span className="text-sm text-muted-foreground">—</span>;
  }
  if (entry.ackStatus === "pending") {
    return (
      <button
        type="button"
        onClick={() => onAck(entry)}
        aria-label={`Konfirmasi pembayaran ${entry.clientName} sebesar ${fmtRp(entry.amount)}`}
        className={cn(
          "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15",
          FOCUS_RING,
        )}
      >
        <CheckCircle weight="BoldDuotone" className="size-3" />
        Ack
      </button>
    );
  }
  if (entry.ackStatus === "acknowledged" && entry.acknowledgedBy) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle weight="BoldDuotone" className="size-3 text-primary" />
        {entry.acknowledgedBy}
      </span>
    );
  }
  return compact ? null : <span className="text-sm text-muted-foreground">—</span>;
}

/* ─── Kwitansi action — hanya untuk baris cash_in (uang riil masuk) ──────────── */

/** Entry types yang punya kwitansi/tanda-terima yang bisa dicetak. */
function canPrintKwitansi(entry: LedgerEntry): boolean {
  return entry.entryType === "cash_in";
}

function KwitansiButton({
  entry,
  onKwitansi,
}: {
  entry: LedgerEntry;
  onKwitansi: (e: LedgerEntry) => void;
}): React.ReactElement | null {
  if (!canPrintKwitansi(entry)) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onKwitansi(entry)}
            aria-label={`Preview & unduh kwitansi ${entry.clientName}`}
            className={cn(
              "inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
              FOCUS_RING,
            )}
          >
            <Documents weight="BoldDuotone" className="size-4" />
          </button>
        }
      />
      <TooltipContent>Kwitansi (PDF)</TooltipContent>
    </Tooltip>
  );
}

/* ─── Riwayat / activity log trigger ─────────────────────────────────────────── */

function RiwayatButton({
  entry,
  count,
  onActivity,
}: {
  entry: LedgerEntry;
  count: number;
  onActivity: (e: LedgerEntry) => void;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onActivity(entry)}
            aria-label={`Lihat riwayat transaksi ${entry.clientName}`}
            className={cn(
              "relative inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
              FOCUS_RING,
            )}
          >
            <History weight="BoldDuotone" className="size-4" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
                {count}
              </span>
            )}
          </button>
        }
      />
      <TooltipContent>Riwayat / activity log</TooltipContent>
    </Tooltip>
  );
}

/* ─── Desktop row ────────────────────────────────────────────────────────────── */

function LedgerRow({
  entry,
  onAck,
  onKwitansi,
  onActivity,
  activityCount,
}: {
  entry: LedgerEntry;
  onAck: (e: LedgerEntry) => void;
  onKwitansi: (e: LedgerEntry) => void;
  onActivity: (e: LedgerEntry) => void;
  activityCount: number;
}): React.ReactElement {
  const isDiscount = entry.entryType === "discount";

  return (
    <TableRow
      className={cn(
        "h-18 bg-card align-middle transition-colors hover:bg-secondary/40",
        isDiscount && "bg-secondary/20",
      )}
    >
      <TableCell className="px-4 py-3 align-middle text-xs tabular-nums text-muted-foreground">
        {fmtDate(entry.occurredAt)}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{entry.clientName}</p>
          <div className="mt-1">
            <EntryTypeChip type={entry.entryType} />
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 text-right align-middle text-sm tabular-nums">
        {isDiscount ? (
          <span className="text-muted-foreground">–{fmtRp(entry.amount)}</span>
        ) : (
          <span className="font-semibold text-foreground">{fmtRp(entry.amount)}</span>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <div className="min-w-0">
          <EntryMeta entry={entry} />
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <StatusBadge config={getLedgerStatusBadge(entry.status)} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <AckCell entry={entry} onAck={onAck} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <RiwayatButton entry={entry} count={activityCount} onActivity={onActivity} />
      </TableCell>
      <TableCell className="px-4 py-3 align-middle">
        <KwitansiButton entry={entry} onKwitansi={onKwitansi} />
      </TableCell>
    </TableRow>
  );
}

/* ─── Mobile record (list item, bukan card — dense & scannable) ─────────────── */

function MobileRecord({
  entry,
  onAck,
  onKwitansi,
  onActivity,
  activityCount,
}: {
  entry: LedgerEntry;
  onAck: (e: LedgerEntry) => void;
  onKwitansi: (e: LedgerEntry) => void;
  onActivity: (e: LedgerEntry) => void;
  activityCount: number;
}): React.ReactElement {
  const isDiscount = entry.entryType === "discount";

  return (
    <li
      className={cn(
        "border-b border-border/60 px-4 py-3.5 last:border-0",
        isDiscount && "bg-secondary/20",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{entry.clientName}</p>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {fmtDate(entry.occurredAt)}
            </span>
          </div>
          <div className="mt-1">
            <EntryTypeChip type={entry.entryType} />
          </div>
          <div className="mt-1.5 text-xs text-muted-foreground">
            <EntryMeta entry={entry} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onActivity(entry)}
              aria-label={`Lihat riwayat transaksi ${entry.clientName}`}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                FOCUS_RING,
              )}
            >
              <History weight="BoldDuotone" className="size-3.5" />
              Riwayat
              {activityCount > 0 && (
                <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
                  {activityCount}
                </span>
              )}
            </button>
            {canPrintKwitansi(entry) && (
              <button
                type="button"
                onClick={() => onKwitansi(entry)}
                aria-label={`Preview & unduh kwitansi ${entry.clientName}`}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                  FOCUS_RING,
                )}
              >
                <Documents weight="BoldDuotone" className="size-3.5" />
                Kwitansi
              </button>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {isDiscount ? (
            <p className="text-sm tabular-nums text-muted-foreground">–{fmtRp(entry.amount)}</p>
          ) : (
            <p className="text-sm font-semibold tabular-nums text-foreground">{fmtRp(entry.amount)}</p>
          )}
          <div className="mt-1.5 flex flex-col items-end gap-1.5">
            <StatusBadge config={getLedgerStatusBadge(entry.status)} />
            <AckCell entry={entry} onAck={onAck} compact />
          </div>
        </div>
      </div>
    </li>
  );
}

/* ─── Main export ────────────────────────────────────────────────────────────── */

export function LedgerTable({
  entries,
  loading = false,
  onAck,
  onKwitansi,
  onActivity,
  activityCounts,
  currentPage,
  totalPages,
  onPageChange,
  emptyLabel = "Belum ada transaksi di tab ini.",
}: LedgerTableProps): React.ReactElement {
  if (loading) {
    return <LoadingSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Bill weight="BoldDuotone" className="size-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{emptyLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Catat transaksi pertama lewat tombol Catat Transaksi di panel ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        {/* ── Desktop table (sm dan lebih besar) ── */}
        <div className="hidden sm:block">
          <Table className="table-fixed">
            <TableCaption className="sr-only">Daftar transaksi ledger</TableCaption>
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead scope="col" className={TH}>
                  Tanggal
                </TableHead>
                <TableHead scope="col" className={TH}>
                  Client
                </TableHead>
                <TableHead scope="col" className={THR}>
                  Nominal
                </TableHead>
                <TableHead scope="col" className={TH}>
                  No. / Via
                </TableHead>
                <TableHead scope="col" className={TH}>
                  Status
                </TableHead>
                <TableHead scope="col" className={TH}>
                  Ack
                </TableHead>
                <TableHead scope="col" className={TH}>
                  Riwayat
                </TableHead>
                <TableHead scope="col" className={TH}>
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <LedgerRow
                  key={e.id}
                  entry={e}
                  onAck={onAck}
                  onKwitansi={onKwitansi}
                  onActivity={onActivity}
                  activityCount={activityCounts[e.id] ?? 0}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ── Mobile list (di bawah sm) — record list, bukan tabel terkompres ── */}
        <ul className="sm:hidden" aria-label="Daftar transaksi ledger">
          {entries.map((e) => (
            <MobileRecord
              key={e.id}
              entry={e}
              onAck={onAck}
              onKwitansi={onKwitansi}
              onActivity={onActivity}
              activityCount={activityCounts[e.id] ?? 0}
            />
          ))}
        </ul>

        {/* ── Pagination footer ── */}
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
