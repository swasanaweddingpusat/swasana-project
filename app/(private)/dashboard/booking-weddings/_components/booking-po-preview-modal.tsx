"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Refresh, CloseCircle, ArrowRightUp } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// react-pdf must not be SSR'd — load client-only
const PdfCanvasViewer = dynamic(
  () => import("@/components/shared/PdfCanvasViewer").then((m) => ({ default: m.PdfCanvasViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Refresh weight="BoldDuotone" className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

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

  function handleOpenNewTab(): void {
    if (blobUrl) window.open(blobUrl, "_blank");
  }

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-screen w-screen max-w-none top-0 left-0 translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none">
        <DialogHeader className="shrink-0 border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="truncate">Preview PO — {target.label}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenNewTab}
                disabled={!blobUrl}
                title="Buka di Tab Baru"
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center cursor-pointer bg-muted hover:bg-muted/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Buka di tab baru"
              >
                <ArrowRightUp weight="BoldDuotone" className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
                aria-label="Tutup"
              >
                <CloseCircle weight="BoldDuotone" className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
              </button>
            </div>
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
            <PdfCanvasViewer blobUrl={blobUrl} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
