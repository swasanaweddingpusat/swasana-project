"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CloseCircle as X } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useUpdateBooking } from "@/hooks/use-bookings";
import type { BookingListItem } from "@/lib/queries/bookings";

export interface RejectBookingModalProps {
  open: boolean;
  booking: BookingListItem | null;
  onClose: () => void;
}

export function RejectBookingModal({ open, booking, onClose }: RejectBookingModalProps): React.JSX.Element | null {
  const updateMut = useUpdateBooking();
  const [rejectNotes, setRejectNotes] = useState("");

  if (!open || !booking) return null;

  function handleClose(): void {
    setRejectNotes("");
    onClose();
  }

  return (
    <div className={cn("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center", "bg-black/40", "p-4")}>
      <div className={cn("bg-card", "rounded-2xl", "shadow-xl", "w-full", "max-w-md", "p-4", "sm:p-6", "relative")}>
        <div className={cn("flex", "items-start", "justify-between", "gap-4", "mb-4")}>
          <div>
            <h2 className={cn("text-lg", "font-bold", "text-foreground")}>Reject Booking</h2>
            <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>
              Reject booking <span className={cn("font-semibold", "text-foreground")}>{booking.snapCustomer?.name}</span>?
            </p>
          </div>
          <button
            type="button"
            className={cn("rounded-full", "bg-muted", "hover:bg-muted/80", "p-1.5", "shrink-0")}
            onClick={handleClose}
            aria-label="Tutup"
          >
            <X weight="BoldDuotone" className={cn("h-5", "w-5", "text-foreground")} />
          </button>
        </div>

        <div className="mb-4">
          <label className={cn("text-sm", "font-medium", "text-foreground", "mb-2", "block")}>Alasan Penolakan</label>
          <Input
            placeholder="Alasan penolakan (opsional)..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
        </div>

        <div className={cn("flex", "gap-3")}>
          <button
            type="button"
            className={cn(
              "flex-1",
              "bg-destructive",
              "text-destructive-foreground",
              "rounded-lg",
              "py-2",
              "font-medium",
              "text-sm",
              "hover:bg-destructive/90",
              "transition",
              "disabled:opacity-50",
              "disabled:cursor-not-allowed",
            )}
            disabled={updateMut.isPending}
            onClick={async () => {
              const r = await updateMut.mutateAsync({
                id: booking.id,
                bookingStatus: "Rejected",
                rejectionNotes: rejectNotes || null,
              });
              if (!r.success) {
                toast.error(r.error);
              } else {
                toast.success("Booking di-reject.");
              }
              handleClose();
            }}
          >
            {updateMut.isPending ? "Memproses..." : "Reject"}
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
            onClick={handleClose}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
