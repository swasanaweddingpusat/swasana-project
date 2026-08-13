"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { CloseCircle as X, CloseSquare as SquareX, Paperclip } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useCancelBooking } from "@/hooks/use-bookings";
import type { BookingListItem } from "@/lib/queries/bookings";

export interface CancelBookingDialogProps {
  open: boolean;
  booking: BookingListItem | null;
  onClose: () => void;
}

export function CancelBookingDialog({
  open,
  booking,
  onClose,
}: CancelBookingDialogProps): React.JSX.Element | null {
  const cancelMut = useCancelBooking();
  const [cancelReason, setCancelReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open || !booking) return null;

  function reset(): void {
    setCancelReason("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  const canSubmit = cancelReason.trim().length >= 3 && !cancelMut.isPending;

  async function handleSubmit(): Promise<void> {
    if (!booking || !canSubmit) return;
    const fd = new FormData();
    fd.append("id", booking.id);
    fd.append("cancelReason", cancelReason.trim());
    if (file) fd.append("document", file);
    const r = await cancelMut.mutateAsync(fd);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Booking di-cancel.");
    handleClose();
  }

  return (
    <div className={cn("fixed", "inset-0", "z-50", "flex", "items-center", "justify-center", "bg-black/40", "p-4")}>
      <div className={cn("bg-card", "rounded-2xl", "shadow-xl", "w-full", "max-w-md", "p-4", "sm:p-6", "relative")}>
        <div className={cn("flex", "items-start", "justify-between", "gap-4", "mb-4")}>
          <div>
            <h2 className={cn("text-lg", "font-bold", "text-foreground")}>Cancel Booking</h2>
            <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>
              Cancel booking{" "}
              <span className={cn("font-semibold", "text-foreground")}>{booking.snapCustomer?.name}</span>? Status akan
              menjadi Canceled.
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

        <div className={cn("space-y-4")}>
          <div className={cn("space-y-1.5")}>
            <label htmlFor="cancel-reason" className={cn("text-sm", "font-medium", "text-foreground")}>
              Alasan Cancel <span className={cn("text-destructive")}>*</span>
            </label>
            <Textarea
              id="cancel-reason"
              placeholder="Tuliskan alasan pembatalan booking..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className={cn("space-y-1.5")}>
            <label htmlFor="cancel-document" className={cn("text-sm", "font-medium", "text-foreground")}>
              Surat Permohonan Cancel{" "}
              <span className={cn("font-normal", "text-muted-foreground")}>(opsional)</span>
            </label>
            <input
              ref={fileInputRef}
              id="cancel-document"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={cn(
                "block",
                "w-full",
                "text-sm",
                "text-muted-foreground",
                "rounded-lg",
                "border",
                "border-border",
                "cursor-pointer",
                "file:mr-3",
                "file:border-0",
                "file:bg-muted",
                "file:px-3",
                "file:py-2",
                "file:text-sm",
                "file:font-medium",
                "file:text-foreground",
                "hover:file:bg-muted/80",
              )}
            />
            {file ? (
              <p className={cn("flex", "items-center", "gap-1.5", "text-xs", "text-muted-foreground")}>
                <Paperclip weight="BoldDuotone" className={cn("h-3.5", "w-3.5")} />
                {file.name}
              </p>
            ) : null}
          </div>
        </div>

        <div className={cn("flex", "gap-3", "mt-6")}>
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
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {cancelMut.isPending ? (
              <span className={cn("flex", "items-center", "justify-center", "gap-1.5")}>
                <SquareX weight="BoldDuotone" className={cn("h-4", "w-4", "animate-spin")} />
                Memproses...
              </span>
            ) : (
              "Cancel Booking"
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
            onClick={handleClose}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
