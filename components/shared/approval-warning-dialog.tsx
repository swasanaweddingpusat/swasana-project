"use client";

import { DangerTriangle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ApprovalWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Baris-baris peringatan yang ditampilkan sebagai poin bernomor. */
  warnings: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  submitting?: boolean;
}

export function ApprovalWarningDialog({
  open,
  onOpenChange,
  title,
  description,
  warnings,
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Kembali",
  onConfirm,
  submitting = false,
}: ApprovalWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* flex! override base grid → header + footer tetap, badan peringatan yang
          scroll. max-h dvh biar muat di layar HP (viewport dinamis). */}
      <DialogContent className="flex! max-h-[90dvh] max-w-md flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="shrink-0 items-center gap-3 pb-1 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <DangerTriangle weight="BoldDuotone" className="h-9 w-9 text-destructive" />
          </div>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-1">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            <p className="font-semibold text-destructive">Peringatan:</p>
            <ol className="mt-2 space-y-2">
              {warnings.map((warning, i) => (
                <li key={i} className="flex gap-2.5 leading-relaxed">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-xs font-semibold text-destructive">
                    {i + 1}
                  </span>
                  <span>{warning}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            Pastikan seluruh data sudah benar sebelum melanjutkan.
          </p>
        </div>

        <div className="flex shrink-0 justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? "Memproses..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
