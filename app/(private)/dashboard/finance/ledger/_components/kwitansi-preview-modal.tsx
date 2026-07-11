"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Refresh, ArrowRightUp, CloseCircle, DownloadMinimalistic } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KwitansiPdfDocument } from "@/components/pdf/KwitansiPdfDocument";
import type { LedgerEntry } from "@/types/finance";

// react-pdf viewer must not be SSR'd — load client-only
const PdfCanvasViewer = dynamic(
  () => import("@/components/shared/PdfCanvasViewer").then((m) => ({ default: m.PdfCanvasViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Refresh weight="BoldDuotone" className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

interface KwitansiPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerEntry | null;
}

/** Fetch a public asset and encode it as a data URL for react-pdf <Image>. */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/kediaman-corp.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildFileName(entry: LedgerEntry): string {
  const no = entry.invoiceNumber?.trim() || `KW-${entry.id.slice(0, 8).toUpperCase()}`;
  const client = entry.clientName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `Kwitansi_${no}_${client}.pdf`.replace(/\/+/g, "-");
}

export function KwitansiPreviewModal({
  open,
  onOpenChange,
  entry,
}: KwitansiPreviewModalProps): React.ReactElement | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("Kwitansi.pdf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entry) return;

    let revoked = false;
    let createdUrl: string | null = null;

    async function run(): Promise<void> {
      setLoading(true);
      setError(null);
      setBlobUrl(null);

      try {
        // Dynamically import the renderer so @react-pdf/renderer never lands in the SSR bundle.
        const { pdf } = await import("@react-pdf/renderer");
        const logoBase64 = await loadLogoDataUrl();
        const blob = await pdf(
          <KwitansiPdfDocument entry={entry!} logoBase64={logoBase64} />,
        ).toBlob();
        if (revoked) return;
        createdUrl = URL.createObjectURL(blob);
        setFileName(buildFileName(entry!));
        setBlobUrl(createdUrl);
      } catch (err: unknown) {
        if (revoked) return;
        const message = err instanceof Error ? err.message : "Gagal membuat PDF kwitansi";
        setError(message);
      } finally {
        if (!revoked) setLoading(false);
      }
    }

    void run();

    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, entry]);

  function handleOpenNewTab(): void {
    if (blobUrl) window.open(blobUrl, "_blank");
  }

  function handleDownload(): void {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-screen w-screen max-w-none top-0 left-0 translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none"
      >
        <DialogHeader className="shrink-0 border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate">Preview Kwitansi</DialogTitle>
              <p className="truncate text-xs text-muted-foreground">
                {entry.clientName}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!blobUrl}
                title="Unduh PDF"
                aria-label="Unduh PDF"
                className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DownloadMinimalistic weight="BoldDuotone" className="size-5 text-primary-foreground" />
              </button>
              <button
                type="button"
                onClick={handleOpenNewTab}
                disabled={!blobUrl}
                title="Buka di tab baru"
                aria-label="Buka di tab baru"
                className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRightUp weight="BoldDuotone" className="size-5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Tutup"
                className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-destructive/10 transition-colors hover:bg-destructive/20"
              >
                <CloseCircle weight="BoldDuotone" className="size-6 text-destructive" />
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
              <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}
          {blobUrl && !loading && !error && (
            <PdfCanvasViewer blobUrl={blobUrl} showZoomControls />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
