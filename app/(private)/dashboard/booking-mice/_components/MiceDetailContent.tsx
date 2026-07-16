"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { MiceStatusBadge } from "./mice-table";
import type { MiceBookingItem, MiceTerm } from "./types";

interface MiceDetailContentProps {
  booking: MiceBookingItem;
  onEdit: () => void;
  onClose: () => void;
  showHeader?: boolean;
  closeLabel?: string;
}

function fmtRp(n: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd MMM yyyy");
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right text-foreground">
        {value}
      </span>
    </div>
  );
}

function TermRow({ term }: { term: MiceTerm }) {
  return (
    <div className="py-2.5 border-b border-border last:border-0 space-y-0.5">
      <div className="flex justify-between items-center gap-4">
        <span className="text-sm text-muted-foreground shrink-0">
          {term.name}
        </span>
        <span className="text-sm font-medium text-foreground">
          {fmtRp(term.amount)}
        </span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <span className="text-xs text-muted-foreground">
          Jatuh tempo: {fmtDate(term.dueDate)}
        </span>
      </div>
    </div>
  );
}

export function MiceDetailContent({
  booking,
  onEdit,
  onClose,
  showHeader = true,
  closeLabel = "Tutup",
}: MiceDetailContentProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Status + PO */}
      {showHeader && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <MiceStatusBadge status={booking.status} />
          {booking.poNumber ? (
            <span className="font-mono text-xs text-muted-foreground">
              {booking.poNumber}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Belum ada PO</span>
          )}
        </div>
      )}

      {/* Client */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Client
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Nama" value={booking.customer.name} />
          <InfoRow label="Telepon" value={booking.customer.phone} />
        </div>
      </div>

      {/* Event */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Detail Event
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Venue" value={booking.venue.name} />
          <InfoRow label="Tanggal Event" value={fmtDate(booking.eventDate)} />
          <InfoRow
            label="Tanggal Booking"
            value={fmtDate(booking.createdAt)}
          />
          {booking.sourceOfInformation && (
            <InfoRow
              label="Sumber Informasi"
              value={booking.sourceOfInformation.name}
            />
          )}
        </div>
      </div>

      {/* Financial — terms */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Pembayaran
        </p>
        <div className="rounded-lg border border-border px-4">
          {booking.terms.length > 0 ? (
            booking.terms.map((term) => <TermRow key={term.id} term={term} />)
          ) : (
            <div className="py-2.5">
              <span className="text-sm text-muted-foreground italic">
                Belum ada term pembayaran
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quotation — deferred */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quotation
        </p>
        <div className="rounded-lg border border-border px-4">
          <div className="py-2.5">
            <span className="text-sm text-muted-foreground italic">
              Modul Quotation menyusul
            </span>
          </div>
        </div>
      </div>

      {/* Sales */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Sales
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow
            label="Sales"
            value={booking.sales?.fullName ?? "—"}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {closeLabel}
        </Button>
        <Button className="flex-1" onClick={onEdit}>
          Edit Booking
        </Button>
      </div>
    </div>
  );
}
