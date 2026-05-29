"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSalesBookings } from "@/hooks/use-sales-bookings";
import { BookingStatus } from "@prisma/client";
import { BookingDetailModal } from "@/app/(private)/dashboard/booking-weddings/_components/booking-detail-modal";

interface Props {
  salesId: string;
  onViewAll: () => void;
}

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const STATUS_LABEL: Record<string, string> = {
  [BookingStatus.Confirmed]: "Confirmed",
  [BookingStatus.Pending]: "Pending",
  [BookingStatus.Canceled]: "Canceled",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === BookingStatus.Confirmed) return "default";
  if (status === BookingStatus.Canceled) return "destructive";
  return "secondary";
}

export function SalesRecentBookings({ salesId, onViewAll }: Props) {
  const { data: bookings, isLoading } = useSalesBookings(salesId, 5);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Recent Bookings
        </span>
        <button
          type="button"
          onClick={onViewAll}
          className="min-h-11 px-2 -mr-2 text-xs text-foreground font-medium hover:underline cursor-pointer flex items-center"
          aria-label="Lihat semua booking sales ini"
        >
          Lihat semua &rarr;
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2" role="status" aria-label="Memuat booking...">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center" role="status">
          Belum ada booking di periode ini.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
          {bookings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBookingId(b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedBookingId(b.id);
                }
              }}
              className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 bg-background hover:bg-secondary/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label={`Lihat detail booking ${b.snapCustomer?.name ?? ""}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {b.snapPackage?.packageName ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {b.snapCustomer?.name ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  "text-xs font-semibold",
                  b.bookingStatus === BookingStatus.Confirmed
                    ? "text-foreground"
                    : b.bookingStatus === BookingStatus.Canceled
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}>
                  {formatRp(b.snapPackageVariant?.price ?? 0)}
                </span>
                <Badge
                  variant={statusVariant(b.bookingStatus)}
                  className="text-[10px] px-1.5 py-0.5"
                >
                  {STATUS_LABEL[b.bookingStatus] ?? b.bookingStatus}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      <BookingDetailModal
        open={!!selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        bookingId={selectedBookingId}
      />
    </div>
  );
}
