"use client";

import React from "react";
import { toast } from "sonner";
import { CloseCircle as X, Refresh } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useUpdateBooking } from "@/hooks/use-bookings";
import type { BookingListItem } from "@/lib/queries/bookings";

const RotateCcw = Refresh;

export interface RestoreBookingDialogProps {
  open: boolean;
  booking: BookingListItem | null;
  onClose: () => void;
}

export function RestoreBookingDialog({ open, booking, onClose }: RestoreBookingDialogProps): React.JSX.Element | null {
  const updateMut = useUpdateBooking();

  if (!open || !booking) return null;

  return (
    <div className={cn("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center", "bg-black/40", "p-4")}>
      <div className={cn("bg-card", "rounded-2xl", "shadow-xl", "w-full", "max-w-md", "p-4", "sm:p-6", "relative")}>
        <div className={cn("flex", "items-start", "justify-between", "gap-4", "mb-4")}>
          <div>
            <h2 className={cn("text-lg", "font-bold", "text-foreground")}>Restore Booking</h2>
            <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>
              Restore booking{" "}
              <span className={cn("font-semibold", "text-foreground")}>{booking.snapCustomer?.name}</span> ke status
              Pending?
            </p>
          </div>
          <button
            type="button"
            className={cn("rounded-full", "bg-muted", "hover:bg-muted/80", "p-1.5", "shrink-0")}
            onClick={onClose}
            aria-label="Tutup"
          >
            <X weight="BoldDuotone" className={cn("h-5", "w-5", "text-foreground")} />
          </button>
        </div>
        <div className={cn("flex", "gap-3")}>
          <button
            type="button"
            className={cn(
              "flex-1",
              "bg-primary",
              "text-primary-foreground",
              "rounded-lg",
              "py-2",
              "font-medium",
              "text-sm",
              "hover:bg-primary/90",
              "transition",
              "disabled:opacity-50",
              "disabled:cursor-not-allowed",
            )}
            disabled={updateMut.isPending}
            onClick={async () => {
              const r = await updateMut.mutateAsync({ id: booking.id, bookingStatus: "Pending" });
              if (!r.success) {
                toast.error(r.error);
              } else {
                toast.success("Booking di-restore ke Pending.");
              }
              onClose();
            }}
          >
            {updateMut.isPending ? (
              <span className={cn("flex", "items-center", "justify-center", "gap-1.5")}>
                <RotateCcw weight="BoldDuotone" className={cn("h-4", "w-4", "animate-spin")} />
                Memproses...
              </span>
            ) : (
              "Restore"
            )}
          </button>
          <button
            type="button"
            className={cn(
              "flex-1",
              "border",
              "border-border",
              "rounded-lg",
              "py-2",
              "font-medium",
              "text-sm",
              "hover:bg-accent",
              "transition",
            )}
            onClick={onClose}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
