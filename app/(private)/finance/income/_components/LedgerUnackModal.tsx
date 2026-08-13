"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Refresh, CloseCircle } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { unacknowledgeCashIn } from "@/actions/ledger";
import { fmtRp } from "./ledger-format";
import type { LedgerRow } from "@/lib/queries/ledger";

interface LedgerUnackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerRow | null;
  onSuccess: () => void;
}

/** Batalkan verifikasi — kembalikan ackStatus ke pending (Finance only). */
export function LedgerUnackModal({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: LedgerUnackModalProps): React.ReactElement | null {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  function resetAndClose(): void {
    setNote("");
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean): void {
    if (!next) {
      resetAndClose();
    } else {
      onOpenChange(true);
    }
  }

  if (!entry) return null;

  async function handleUnack(): Promise<void> {
    if (!entry) return;
    if (!note.trim()) {
      toast.error("Alasan wajib diisi");
      return;
    }
    setLoading(true);
    const result = await unacknowledgeCashIn({ ledgerId: entry.id, note: note.trim() });
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Verifikasi dibatalkan, status kembali ke pending");
    resetAndClose();
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
              <Refresh weight="BoldDuotone" className="size-5 text-primary" />
              Batalkan Verifikasi
            </DialogTitle>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{entry.clientName}</p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Tutup"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80"
          >
            <CloseCircle weight="BoldDuotone" className="size-6 text-foreground" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <p className="text-sm text-muted-foreground">
            Status akan dikembalikan ke <strong>Menunggu</strong>. Alokasi termin tetap ada.
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
            {entry.invoiceNumber && (
              <div className="flex items-center justify-between gap-4 py-1 text-sm">
                <span className="shrink-0 text-muted-foreground">No. Kwitansi</span>
                <span className="truncate text-right font-mono text-xs text-foreground">{entry.invoiceNumber}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unack-note">
              Alasan
              <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>
            </Label>
            <Textarea
              id="unack-note"
              placeholder="Mis. Nominal tidak sesuai, bukti bayar perlu dikoreksi..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-24"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={resetAndClose}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="rounded-full"
            disabled={!note.trim() || loading}
            onClick={() => { void handleUnack(); }}
          >
            <Refresh weight="BoldDuotone" className="size-4" />
            Batalkan Verifikasi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
