"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MiceDetailContent } from "./MiceDetailContent";
import type { MiceBookingItem } from "./types";

interface MiceDetailModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: MiceBookingItem | null;
  onEdit: (booking: MiceBookingItem) => void;
}

export function MiceDetailModal({
  open,
  onOpenChange,
  booking,
  onEdit,
}: MiceDetailModalProps) {
  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Detail Booking MICE</DialogTitle>
        </DialogHeader>
        <MiceDetailContent
          booking={booking}
          onClose={() => onOpenChange(false)}
          onEdit={() => {
            onOpenChange(false);
            onEdit(booking);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
