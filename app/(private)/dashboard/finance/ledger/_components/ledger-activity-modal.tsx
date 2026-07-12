"use client";

import { useEffect, useState } from "react";
import { CloseCircle, History, Refresh } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { LedgerActivityTimeline } from "./ledger-activity-timeline";
import type { LedgerActivity } from "./ledger-format";
import type { LedgerRow } from "@/lib/queries/ledger";

interface LedgerActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerRow | null;
}

/**
 * Modal riwayat/activity log satu transaksi (dibuka dari kolom Riwayat).
 * Riwayat di-fetch on-demand pas modal dibuka lewat /api/ledger/[id]/activities
 * (bukan embed di LedgerRow — biar listing tetap ringan).
 */
export function LedgerActivityModal({
  open,
  onOpenChange,
  entry,
}: LedgerActivityModalProps): React.ReactElement | null {
  const [activities, setActivities] = useState<LedgerActivity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;

    let cancelled = false;
    setLoading(true);
    setActivities([]);

    async function run(ledgerId: string): Promise<void> {
      try {
        const res = await fetch(`/api/ledger/${ledgerId}/activities`);
        if (!res.ok) throw new Error("gagal");
        const data: LedgerActivity[] = await res.json();
        if (!cancelled) setActivities(data);
      } catch {
        if (!cancelled) setActivities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run(entry.id);

    return () => {
      cancelled = true;
    };
  }, [open, entry]);

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
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Refresh weight="BoldDuotone" className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <LedgerActivityTimeline activities={activities} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
