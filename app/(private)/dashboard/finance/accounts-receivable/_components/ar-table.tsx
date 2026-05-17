"use client";

import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowDown,
  Eye,
  CreditCard,
  Bell,
  Check,
  RefreshCw,
  Ban,
  Minus,
  FileDown,
  FilePlus,
  ClipboardList,
} from "lucide-react";
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
import type {
  ARBooking,
  ARTermin,
  ARInvoiceStatus,
  ARTerminStatus,
} from "@/types/finance";

interface ARTableProps {
  bookings: ARBooking[];
  loading: boolean;
  expandedRow: string | null;
  onToggleRow: (id: string) => void;
  onOpenDetail: (booking: ARBooking) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function fmtRp(n: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
}

function fmtDate(d: string): string {
  if (!d || d === "-") return "-";
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

/* ─── Status Badge Helpers ─────────────────────────────────────────────────── */

interface BadgeConfig {
  label: string;
  bg: string;
  border: string;
  text: string;
  Icon: typeof Check;
}

function getTerminBadge(status: ARTerminStatus): BadgeConfig {
  const map: Record<ARTerminStatus, BadgeConfig> = {
    paid: {
      label: "Lunas",
      bg: "bg-primary",
      border: "border-primary",
      text: "text-primary-foreground",
      Icon: Check,
    },
    partial: {
      label: "Partial",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-foreground",
      Icon: RefreshCw,
    },
    overdue: {
      label: "Aging",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      Icon: Ban,
    },
    unpaid: {
      label: "Unpaid",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      Icon: Ban,
    },
    not_due_yet: {
      label: "Not Due Yet",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-muted-foreground",
      Icon: Minus,
    },
  };
  return map[status];
}

function getInvoiceBadge(status: ARInvoiceStatus): BadgeConfig {
  const map: Record<ARInvoiceStatus, BadgeConfig> = {
    paid: {
      label: "Paid",
      bg: "bg-primary",
      border: "border-primary",
      text: "text-primary-foreground",
      Icon: Check,
    },
    partial: {
      label: "Partial",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-foreground",
      Icon: RefreshCw,
    },
    unpaid: {
      label: "Unpaid",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      Icon: Ban,
    },
    unissued: {
      label: "Unissued",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-muted-foreground",
      Icon: ClipboardList,
    },
  };
  return map[status] ?? map.unissued;
}

function StatusBadge({ config }: { config: BadgeConfig }) {
  const { label, bg, border, text, Icon } = config;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border py-0.5 pl-1.5 pr-2 text-xs font-medium",
        bg,
        border,
        text
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
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
  currentPage,
  totalPages,
  onPageChange,
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
                {Array.from({ length: 7 }).map((_, j) => (
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
                  Customer Event <ArrowDown className="size-3" />
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
                  colSpan={7}
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
              <ChevronLeft className="size-5" />
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
              <ChevronRight className="size-5" />
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
}: {
  booking: ARBooking;
  isExpanded: boolean;
  onToggle: () => void;
  onDetail: () => void;
}) {
  const terminBadge = getTerminBadge(booking.statusTermin);

  return (
    <>
      <TableRow
        className="h-18 cursor-pointer bg-background hover:bg-secondary/50"
        onClick={onToggle}
      >
        <TableCell className="px-6 py-4">
          <div className="flex items-start gap-2">
            <ChevronDown
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
              <Eye className="size-4" />
            </button>
            <button
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              title="Payment"
            >
              <CreditCard className="size-4" />
            </button>
            <button
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              title="Reminder"
            >
              <Bell className="size-4" />
            </button>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && booking.termins.length > 0 && (
        <TableRow className="bg-secondary/30 hover:bg-secondary/30">
          <TableCell colSpan={7} className="p-0">
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
                    <TerminRow key={termin.id} termin={termin} />
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

function TerminRow({ termin }: { termin: ARTermin }) {
  const terminBadge = getTerminBadge(termin.status);
  const invoiceBadge = getInvoiceBadge(termin.statusInvoice);

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
      <TableCell className="px-6 py-4 text-sm text-foreground max-w-30 truncate">
        {termin.catatan || "-"}
      </TableCell>
      <TableCell className="p-4">
        <TerminActions termin={termin} />
      </TableCell>
    </TableRow>
  );
}

/* ─── Termin Actions (context-aware) ───────────────────────────────────────── */

function TerminActions({ termin }: { termin: ARTermin }) {
  if (termin.status === "paid") {
    return (
      <div className="flex items-center gap-0.5">
        <button
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          title="Detail"
        >
          <Eye className="size-4" />
        </button>
        <button
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          title="Download"
        >
          <FileDown className="size-4" />
        </button>
      </div>
    );
  }

  if (termin.status === "overdue") {
    return (
      <div className="flex items-center gap-0.5">
        <button
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          title="Payment"
        >
          <CreditCard className="size-4" />
        </button>
        <button
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          title="Reminder"
        >
          <Bell className="size-4" />
        </button>
      </div>
    );
  }

  if (termin.statusInvoice === "unissued") {
    return (
      <div className="flex items-center gap-0.5">
        <button
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          title="Create Invoice"
        >
          <FilePlus className="size-4" />
        </button>
        <button
          className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          title="Reminder"
        >
          <Bell className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        title="Payment"
      >
        <CreditCard className="size-4" />
      </button>
    </div>
  );
}
