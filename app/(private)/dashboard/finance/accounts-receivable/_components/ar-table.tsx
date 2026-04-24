"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, Printer, Bell, Settings2, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ARBooking, ARTermin, ARInvoiceStatus, ARTerminStatus } from "@/types/finance";

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

function fmtRp(n: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
}

function fmtDate(d: string) {
  if (!d || d === "-") return "-";
  try { return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "numeric", year: "numeric" }); }
  catch { return d; }
}

type StatusVariant = "default" | "secondary" | "outline" | "destructive";

function statusBadge(status: ARInvoiceStatus | ARTerminStatus | string): { label: string; variant: StatusVariant } {
  const map: Record<string, { label: string; variant: StatusVariant }> = {
    paid:        { label: "Lunas",       variant: "default" },
    partial:     { label: "Partial",     variant: "secondary" },
    unpaid:      { label: "Unpaid",      variant: "outline" },
    unissued:    { label: "Unissued",    variant: "outline" },
    pending:     { label: "Pending",     variant: "secondary" },
    overdue:     { label: "Overdue",     variant: "destructive" },
    not_due_yet: { label: "Not Due Yet", variant: "outline" },
  };
  return map[status] ?? { label: status, variant: "outline" };
}

export function ARTable({ bookings, loading, expandedRow, onToggleRow, onOpenDetail, currentPage, totalPages, onPageChange }: ARTableProps) {
  if (loading) {
    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary hover:bg-secondary">
              {["", "NO PO", "Client Event", "Nama Event", "Total Harga", "Outstanding", "Jatuh Tempo", "Status", ""].map((h, i) => (
                <TableHead key={i} className="text-xs h-11">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i} className="h-18">
                {[...Array(9)].map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
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
          <TableHeader className="bg-[#F9FAFB]">
            <TableRow>
              <TableHead className="w-10" />
              <TableHead className="text-xs h-11 min-w-42.5 text-[#475467]">
                <span className="inline-flex items-center gap-1">NO PO <ArrowDown className="h-3 w-3" /></span>
              </TableHead>
              <TableHead className="text-xs h-11 min-w-35 text-[#475467]">Client Event</TableHead>
              <TableHead className="text-xs h-11 min-w-35 text-[#475467]">Nama Event</TableHead>
              <TableHead className="text-xs h-11 min-w-32 text-[#475467]">Total Harga</TableHead>
              <TableHead className="text-xs h-11 min-w-32 text-[#475467]">Outstanding</TableHead>
              <TableHead className="text-xs h-11 min-w-25 text-[#475467]">Jatuh Tempo</TableHead>
              <TableHead className="text-xs h-11 min-w-27.5 text-[#475467]">Status Termin</TableHead>
              <TableHead className="text-xs h-11 min-w-20 text-[#475467]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
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
        <div className="flex items-center justify-between px-2 py-3">
          <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="flex items-center gap-1">
            {genPages(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-2 text-xs text-muted-foreground">...</span>
              ) : (
                <button key={p} onClick={() => onPageChange(p as number)}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer",
                    currentPage === p ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary"
                  )}>
                  {p}
                </button>
              )
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

function genPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function BookingRow({ booking, isExpanded, onToggle, onDetail }: {
  booking: ARBooking; isExpanded: boolean; onToggle: () => void; onDetail: () => void;
}) {
  const { label, variant } = statusBadge(booking.statusTermin);
  return (
    <>
      <TableRow className="cursor-pointer h-18 bg-white hover:bg-gray-50" onClick={onToggle}>
        <TableCell className="pl-4">
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        <TableCell className="text-sm font-medium">{booking.noPo}</TableCell>
        <TableCell>
          <div className="text-sm">{booking.customerEvent}</div>
          <div className="text-xs text-muted-foreground">{fmtDate(booking.customerDate)}</div>
        </TableCell>
        <TableCell className="text-sm">{booking.namaEvent}</TableCell>
        <TableCell className="text-sm">{fmtRp(booking.totalPrice)}</TableCell>
        <TableCell className="text-sm font-semibold">{fmtRp(booking.outstanding)}</TableCell>
        <TableCell className="text-sm">{fmtDate(booking.jatuhTempo)}</TableCell>
        <TableCell><Badge variant={variant}>{label}</Badge></TableCell>
        <TableCell>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" onClick={onDetail} title="Detail">
              <Eye className="h-4 w-4" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Kwitansi">
              <Printer className="h-4 w-4" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Reminder">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && booking.termins.length > 0 && (
        <TableRow className="bg-gray-50 hover:bg-gray-50">
          <TableCell />
          <TableCell colSpan={8} className="p-0">
            <div className="pl-5 pr-2 py-0">
              <Table>
                <TableHeader className="bg-white">
                  <TableRow>
                    {["Termin", "Jatuh Tempo", "Jumlah Tagihan", "Status Termin", "No Invoice", "Status Invoice", "Aging (days)", "Catatan", ""].map((h, i) => (
                      <TableHead key={i} className="text-xs h-10 font-medium text-[#475467]">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {booking.termins.map((termin) => <TerminRow key={termin.id} termin={termin} />)}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TerminRow({ termin }: { termin: ARTermin }) {
  const terminStatus = statusBadge(termin.status);
  const invoiceStatus = statusBadge(termin.statusInvoice);
  return (
    <TableRow className="h-16 bg-white hover:bg-gray-50 cursor-pointer">
      <TableCell className="text-sm">{termin.name}</TableCell>
      <TableCell className="text-sm">{fmtDate(termin.dueDate)}</TableCell>
      <TableCell className="text-sm font-semibold">{fmtRp(termin.amount)}</TableCell>
      <TableCell><Badge variant={terminStatus.variant}>{terminStatus.label}</Badge></TableCell>
      <TableCell className="text-sm">{termin.noInvoice || "-"}</TableCell>
      <TableCell><Badge variant={invoiceStatus.variant}>{invoiceStatus.label}</Badge></TableCell>
      <TableCell className="text-sm">{termin.agingDays != null ? `+${termin.agingDays}` : "-"}</TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-30 truncate">{termin.catatan || "-"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Detail">
            <Settings2 className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Kwitansi">
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}
