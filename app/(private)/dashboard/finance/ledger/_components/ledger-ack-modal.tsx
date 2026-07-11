"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PenNewSquare, ShieldCheck, InfoCircle, CloseCircle } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SignaturePad } from "@/components/shared/signature-pad";
import { useMySignature } from "@/hooks/use-my-signature";
import { cn } from "@/lib/utils";
import { fmtRp } from "./ledger-format";
import type { LedgerEntry } from "@/types/finance";

/** Hasil ack — dikirim balik ke page buat update state + append activity. */
export interface LedgerAckResult {
  signatureDataUrl: string;
}

interface LedgerAckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerEntry | null;
  /** Konfirmasi + tanda tangan → uang sah masuk. */
  onConfirm: (entry: LedgerEntry, result: LedgerAckResult) => void;
}

/* ─── Ringkasan transaksi ──────────────────────────────────────────────────── */

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right", strong ? "font-semibold text-foreground" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */

export function LedgerAckModal({
  open,
  onOpenChange,
  entry,
  onConfirm,
}: LedgerAckModalProps): React.ReactElement | null {
  const { defaultSignature } = useMySignature();
  const [signature, setSignature] = useState<string | null>(null);
  const [useDefaultSig, setUseDefaultSig] = useState(false);

  // Reset semua field lalu tutup — dipanggil dari Batal, close, dan setelah confirm.
  function resetAndClose(): void {
    setSignature(null);
    setUseDefaultSig(false);
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

  function handleToggleDefault(checked: boolean): void {
    setUseDefaultSig(checked);
    if (checked && defaultSignature) {
      setSignature(defaultSignature);
    } else {
      setSignature(null);
    }
  }

  function handleConfirm(): void {
    if (!entry) return;
    if (!signature) {
      toast.error("Tanda tangan wajib diisi untuk verifikasi");
      return;
    }
    onConfirm(entry, { signatureDataUrl: signature });
    toast.success("Transaksi diverifikasi — uang sah masuk");
    resetAndClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        {/* ── Sticky header ── */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck weight="BoldDuotone" className="size-5 text-primary" />
              Verifikasi Pembayaran (Ack)
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

        {/* ── Scrollable body ── */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {/* Ringkasan transaksi */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <SummaryRow label="Client" value={entry.clientName} />
            <SummaryRow label="Nominal masuk" value={fmtRp(entry.amount)} strong />
            {entry.paymentMethod && <SummaryRow label="Via rekening" value={entry.paymentMethod} />}
            {entry.invoiceNumber && <SummaryRow label="No. kwitansi" value={entry.invoiceNumber} />}
            {entry.linkedTerminLabels.length > 0 && (
              <SummaryRow label="Termin" value={entry.linkedTerminLabels.join(" · ")} />
            )}
          </div>

          {/* Info separation-of-duties */}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <InfoCircle weight="BoldDuotone" className="mt-px size-3.5 shrink-0" />
            Dengan menandatangani, Finance mengonfirmasi dana benar-benar sudah masuk rekening.
          </p>

          {/* Toggle tanda tangan default */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div className="space-y-0.5">
              <Label className="cursor-pointer text-sm font-medium text-foreground">
                Gunakan Tanda Tangan Default
              </Label>
              {!defaultSignature && (
                <p className="text-xs text-muted-foreground">Atur dulu di Profil &rsaquo; Tanda Tangan Default</p>
              )}
            </div>
            <Switch checked={useDefaultSig} disabled={!defaultSignature} onCheckedChange={handleToggleDefault} />
          </div>

          {/* Pad manual / preview default */}
          {!useDefaultSig && <SignaturePad onSignature={setSignature} label="Tanda Tangan Finance" />}
          {useDefaultSig && defaultSignature && (
            <div className="flex items-center justify-center rounded-xl border border-border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={defaultSignature} alt="Tanda tangan default" className="max-h-28 max-w-full object-contain" />
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" className="rounded-full" onClick={resetAndClose}>
            Batal
          </Button>
          <Button type="button" className="rounded-full" disabled={!signature} onClick={handleConfirm}>
            <PenNewSquare weight="BoldDuotone" className="size-4" />
            Tanda Tangan & Verifikasi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
