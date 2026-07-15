"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TrashBinTrash, CloseCircle } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteCashIn } from "@/actions/ledger";
import { fmtRp } from "./ledger-format";
import type { LedgerRow } from "@/lib/queries/ledger";

interface LedgerDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerRow | null;
  onSuccess: () => void;
}

/** Hapus cash-in yang masih pending (belum ter-ack). Permanen. */
export function LedgerDeleteModal({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: LedgerDeleteModalProps): React.ReactElement | null {
  const [loading, setLoading] = useState(false);

  function handleOpenChange(next: boolean): void {
    if (!next) {
      onOpenChange(false);
    } else {
      onOpenChange(true);
    }
  }

  if (!entry) return null;

  async function handleDelete(): Promise<void> {
    if (!entry) return;
    setLoading(true);
    const result = await deleteCashIn(entry.id);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Transaksi dihapus");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <TrashBinTrash weight="BoldDuotone" className="size-5 text-destructive" />
              Hapus Transaksi
            </DialogTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{entry.clientName}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80"
          >
            <CloseCircle weight="BoldDuotone" className="size-6 text-foreground" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <p className="text-sm text-muted-foreground">
            Transaksi ini akan dihapus secara permanen. Tindakan ini tidak bisa dibatalkan.
          </p>
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <div className="flex items-center justify-between gap-4 py-1 text-sm">
              <span className="shrink-0 text-muted-foreground">Client</span>
              <span className="truncate text-right text-foreground">{entry.clientName}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-1 text-sm">
              <span className="shrink-0 text-muted-foreground">Nominal</span>
              <span className="truncate text-right font-semibold text-foreground">{fmtRp(entry.amount)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-full"
            disabled={loading}
            onClick={() => { void handleDelete(); }}
          >
            <TrashBinTrash weight="BoldDuotone" className="size-4" />
            Hapus Permanen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
