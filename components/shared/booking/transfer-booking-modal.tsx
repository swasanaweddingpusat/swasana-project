"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CloseCircle as X } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useTransferBooking } from "@/hooks/use-bookings";
import type { BookingListItem, SalesProfile } from "@/lib/queries/bookings";

export interface TransferBookingModalProps {
  open: boolean;
  booking: BookingListItem | null;
  salesProfiles: SalesProfile[];
  onClose: () => void;
}

export function TransferBookingModal({
  open,
  booking,
  salesProfiles,
  onClose,
}: TransferBookingModalProps): React.JSX.Element | null {
  const transferMut = useTransferBooking();
  const [transferSalesId, setTransferSalesId] = useState("");

  if (!open || !booking) return null;

  function handleClose(): void {
    setTransferSalesId("");
    onClose();
  }

  return (
    <div className={cn("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center", "bg-black/40", "p-4")}>
      <div className={cn("bg-card", "rounded-2xl", "shadow-xl", "w-full", "max-w-md", "p-4", "sm:p-6", "relative")}>
        <div className={cn("flex", "items-start", "justify-between", "gap-4", "mb-6")}>
          <div>
            <h2 className={cn("text-lg", "font-bold", "text-foreground")}>Transfer Booking</h2>
            <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>
              Memindahkan kepemilikan data booking dari sales sebelumnya ke sales yang dipilih.
            </p>
          </div>
          <button
            className={cn("rounded-full", "bg-muted", "hover:bg-muted/80", "p-1.5", "shrink-0")}
            onClick={handleClose}
            type="button"
            aria-label="Tutup"
          >
            <X weight="BoldDuotone" className={cn("h-5", "w-5", "text-foreground")} />
          </button>
        </div>

        <div className="mb-4">
          <p className={cn("text-xs", "text-muted-foreground", "mb-1")}>Sales saat ini</p>
          <div className={cn("flex", "items-center", "gap-2")}>
            <span className={cn("text-sm", "font-medium", "text-foreground")}>
              {booking.sales?.fullName ?? (
                <span className={cn("text-muted-foreground", "italic")}>Tidak ada</span>
              )}
            </span>
            {booking.sales?.fullName && (
              <span
                className={cn(
                  "text-xs",
                  "px-2",
                  "py-0.5",
                  "rounded-full",
                  "border",
                  "border-border",
                  "bg-muted",
                  "text-muted-foreground",
                )}
              >
                sales
              </span>
            )}
          </div>
        </div>

        <div>
          <p className={cn("text-xs", "text-muted-foreground", "mb-1")}>Pilih Sales</p>
          <SearchableSelect
            options={salesProfiles
              .filter((s) => s.id !== booking.salesId)
              .map((s) => ({ id: s.id, name: s.fullName ?? s.id, badge: "sales" }))}
            value={transferSalesId}
            onChange={setTransferSalesId}
            placeholder="Pilih sales tujuan..."
            searchPlaceholder="Cari nama sales..."
            emptyText="Sales tidak ditemukan"
            className="w-full"
          />
        </div>

        <div className={cn("flex", "gap-3", "mt-6")}>
          <button
            className={cn(
              "flex-1",
              "border",
              "border-border",
              "rounded-lg",
              "py-2",
              "font-medium",
              "hover:bg-accent",
              "transition",
              "text-sm",
            )}
            onClick={handleClose}
            disabled={transferMut.isPending}
            type="button"
          >
            Batal
          </button>
          <button
            className={cn(
              "flex-1",
              "bg-primary",
              "text-primary-foreground",
              "rounded-lg",
              "py-2",
              "font-medium",
              "hover:bg-primary/90",
              "transition",
              "text-sm",
              "disabled:opacity-50",
              "disabled:cursor-not-allowed",
            )}
            disabled={!transferSalesId || transferMut.isPending}
            type="button"
            onClick={async () => {
              const r = await transferMut.mutateAsync({
                bookingId: booking.id,
                targetSalesId: transferSalesId,
              });
              if (!r.success) {
                toast.error(r.error);
              } else {
                toast.success("Booking berhasil ditransfer");
                handleClose();
              }
            }}
          >
            {transferMut.isPending ? "Mentransfer..." : "Transfer Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
