"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CloseCircle } from "@solar-icons/react";
import { ActivityLogTimeline } from "./activity-log-timeline";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  customerName?: string;
}

export function ActivityLogModal({ open, onClose, bookingId, customerName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="w-[calc(100%-2rem)] max-w-4xl rounded-2xl p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <DialogTitle className="text-lg font-semibold">Activity Log</DialogTitle>
            {customerName && <p className="text-sm text-muted-foreground mt-0.5">{customerName}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 h-11 w-11 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors" aria-label="Close">
            <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-6 py-4">
          <ActivityLogTimeline bookingId={bookingId} enabled={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
