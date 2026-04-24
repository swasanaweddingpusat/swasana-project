"use client";

import { Drawer } from "@/components/shared/drawer";
import type { ARBooking } from "@/types/finance";

interface ARDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ARBooking | null;
}

export function ARDetailDrawer({ isOpen, onClose, booking }: ARDetailDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={booking?.customerEvent ?? "Detail AR"} maxWidth="sm:max-w-2xl">
      <div className="p-6 text-sm text-muted-foreground">
        Detail drawer untuk booking <span className="font-medium text-foreground">{booking?.noPo}</span> — coming soon.
      </div>
    </Drawer>
  );
}
