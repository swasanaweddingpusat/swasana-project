"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { MiceStatusBadge } from "./mice-table";
import type { MiceBookingItem } from "./types";

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
            <span className="text-xs text-muted-foreground">
              Belum ada PO
            </span>
          )}
        </div>
      )}

      {/* Client */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Client
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Nama" value={booking.clientName} />
          <InfoRow label="Telepon" value={booking.clientPhone} />
        </div>
      </div>

      {/* Event */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Detail Event
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Venue" value={booking.venueName} />
          <InfoRow label="Tipe Event" value={booking.eventType} />
          <InfoRow
            label="Tanggal Event"
            value={format(new Date(booking.eventDate), "dd MMM yyyy")}
          />
          <InfoRow
            label="Tanggal Booking"
            value={format(new Date(booking.bookingDate), "dd MMM yyyy")}
          />
        </div>
      </div>

      {/* Financial */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Pembayaran
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Full Payment" value={fmtRp(booking.fullPayment)} />
          <InfoRow
            label="Booking Fee / DP"
            value={fmtRp(booking.bookingFee)}
          />
          <InfoRow
            label="Sisa Pembayaran"
            value={fmtRp(booking.fullPayment - booking.bookingFee)}
          />
        </div>
      </div>

      {/* Quotation */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quotation
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          {booking.quotation ? (
            <>
              <InfoRow label="Lead" value={booking.quotation.leadName} />
              <InfoRow
                label="Paket"
                value={`${booking.quotation.packageName} ${booking.quotation.variantName}`}
              />
              <InfoRow
                label="Total Quotation"
                value={fmtRp(booking.quotation.totalPrice)}
              />
            </>
          ) : (
            <div className="py-2.5">
              <span className="text-sm text-muted-foreground italic">
                Belum dipilih quotation
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sales */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Sales
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Sales" value={booking.salesName} />
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
