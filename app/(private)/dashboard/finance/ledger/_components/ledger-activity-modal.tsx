"use client";

import { CloseCircle, History } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { LedgerActivityTimeline } from "./ledger-activity-timeline";
import type { LedgerActivity, LedgerEntry } from "@/types/finance";

interface LedgerActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerEntry | null;
  activities: LedgerActivity[];
}

/** Modal riwayat/activity log satu transaksi (dibuka dari kolom Riwayat). */
export function LedgerActivityModal({
  open,
  onOpenChange,
  entry,
  activities,
}: LedgerActivityModalProps): React.ReactElement | null {
  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <History weight="BoldDuotone" className="size-5 text-primary" />
              Riwayat Transaksi
            </DialogTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{entry.clientName}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80"
          >
            <CloseCircle weight="BoldDuotone" className="size-6 text-foreground" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <LedgerActivityTimeline activities={activities} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
