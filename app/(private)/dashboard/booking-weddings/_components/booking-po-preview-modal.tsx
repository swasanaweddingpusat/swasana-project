"use client";

import { useEffect, useState } from "react";
import { Refresh, CloseCircle } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface BookingPOPreviewTarget {
  bookingId: string;
  /** Optional revision to render; omit for the latest (live) version. */
  revisionId?: string;
  /** Label shown in the dialog title (e.g. customer name + "Rev 2"). */
  label: string;
}

interface BookingPOPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: BookingPOPreviewTarget | null;
}

export function BookingPOPreviewModal({
  open,
  onOpenChange,
  target,
}: BookingPOPreviewModalProps): React.ReactElement | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !target) return;

    let revoked = false;
    let createdUrl: string | null = null;

    async function run() {
      setLoading(true);
      setError(null);
      setBlobUrl(null);

      try {
        const res = await fetch("/api/render-po", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: target!.bookingId,
            ...(target!.revisionId ? { revisionId: target!.revisionId } : {}),
          }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error ?? `Gagal memuat PDF (${res.status})`);
        }
        const blob = await res.blob();
        if (revoked) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch (err: unknown) {
        if (revoked) return;
        setError(err instanceof Error ? err.message : "Gagal memuat PDF");
      } finally {
        if (!revoked) setLoading(false);
      }
    }

    void run();

    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, target]);

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-screen w-screen max-w-none top-0 left-0 translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none">
        <DialogHeader className="shrink-0 border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Preview PO — {target.label}</DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="shrink-0 h-11 w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
              aria-label="Close"
            >
              <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-destructive" />
            </button>
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Refresh weight="BoldDuotone" className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full items-center justify-center p-4">
              <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}
          {blobUrl && !loading && !error && (
            <iframe
              src={blobUrl}
              className="h-full w-full border-0"
              title={`Preview PO ${target.label}`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
