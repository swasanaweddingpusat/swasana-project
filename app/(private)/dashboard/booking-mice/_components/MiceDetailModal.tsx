"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/shared/drawer";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MiceBookingItem } from "./types";

interface MiceDetailModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: MiceBookingItem | null;
  onEdit: (booking: MiceBookingItem) => void;
}

const STATUS_DOT: Record<string, string> = {
  Confirmed: "bg-green-500",
  Uploaded: "bg-blue-500",
  Pending: "bg-orange-400",
  Rejected: "bg-destructive",
  Canceled: "bg-muted-foreground",
  Lost: "bg-muted-foreground",
};

const STATUS_TEXT: Record<string, string> = {
  Confirmed: "text-green-600 border-border",
  Uploaded: "text-blue-600 border-border",
  Pending: "text-orange-500 border-border",
  Rejected: "text-destructive border-destructive/30",
  Canceled: "text-muted-foreground border-border",
  Lost: "text-muted-foreground border-border",
};

function fmtRp(n: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export function MiceDetailModal({
  open,
  onOpenChange,
  booking,
  onEdit,
}: MiceDetailModalProps) {
  if (!booking) return <></>;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Detail Booking MICE"
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col gap-5">
        {/* Status + PO */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn("text-xs gap-1.5 font-medium", STATUS_TEXT[booking.status])}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[booking.status])} />
            {booking.status}
          </Badge>
          {booking.poNumber ? (
            <span className="font-mono text-xs text-muted-foreground">{booking.poNumber}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Belum ada PO</span>
          )}
        </div>

        {/* Client */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Client
          </p>
          <div className="rounded-lg border px-4 divide-y">
            <InfoRow label="Nama" value={booking.clientName} />
            <InfoRow label="Telepon" value={booking.clientPhone} />
          </div>
        </div>

        {/* Event */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Detail Event
          </p>
          <div className="rounded-lg border px-4 divide-y">
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
          <div className="rounded-lg border px-4 divide-y">
            <InfoRow label="Full Payment" value={fmtRp(booking.fullPayment)} />
            <InfoRow label="Booking Fee / DP" value={fmtRp(booking.bookingFee)} />
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
          <div className="rounded-lg border px-4">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-muted-foreground">Status Quotation</span>
              {booking.hasQuotation ? (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Upload className="w-3 h-3" />
                  Uploaded
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Belum upload</span>
              )}
            </div>
          </div>
        </div>

        {/* Sales */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sales
          </p>
          <div className="rounded-lg border px-4 divide-y">
            <InfoRow label="Sales" value={booking.salesName} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          <Button
            className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer"
            onClick={() => {
              onOpenChange(false);
              onEdit(booking);
            }}
          >
            Edit Booking
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
