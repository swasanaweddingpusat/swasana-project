"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUpdateBooking } from "@/hooks/use-bookings";
import type { BookingListItem } from "@/lib/queries/bookings";

export interface MarkLostDialogProps {
  open: boolean;
  booking: BookingListItem | null;
  onClose: () => void;
}

export function MarkLostDialog({ open, booking, onClose }: MarkLostDialogProps): React.JSX.Element {
  const updateMut = useUpdateBooking();
  const [lostReason, setLostReason] = useState("");

  function handleOpenChange(isOpen: boolean): void {
    if (!isOpen) {
      setLostReason("");
      onClose();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lost Booking</AlertDialogTitle>
          <AlertDialogDescription>
            Tandai booking <strong>{booking?.snapCustomer?.name}</strong> sebagai Lost?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className={cn("px-6", "pb-2")}>
          <Input
            placeholder="Alasan lost (opsional)..."
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              if (!booking) return;
              const r = await updateMut.mutateAsync({
                id: booking.id,
                bookingStatus: "Lost",
                lostReason: lostReason || null,
              });
              if (!r.success) {
                toast.error(r.error);
              } else {
                toast.success("Booking ditandai Lost.");
              }
              setLostReason("");
              onClose();
            }}
            className={cn("bg-primary", "text-primary-foreground", "hover:bg-primary/90")}
          >
            Lost Booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
