"use client";

import { useEffect, useState } from "react";
import { Refresh, ArrowRightUp, CloseCircle } from "@solar-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface POPreviewTarget {
  packageId: string;
  variantId: string;
  packageName: string;
  variantName: string;
}

interface POPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: POPreviewTarget | null;
}

export function POPreviewModal({ open, onOpenChange, target }: POPreviewModalProps): React.ReactElement | null {
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
        const res = await fetch("/api/render-po/package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: target!.packageId,
            variantId: target!.variantId,
          }),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errBody?.error ?? `Failed to load PDF (${res.status})`);
        }
        const blob = await res.blob();
        if (revoked) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      } catch (err: unknown) {
        if (revoked) return;
        const message = err instanceof Error ? err.message : "Failed to load PDF";
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
  }, [open, target]);

  if (!target) return null;

  function handleOpenNewTab(): void {
    if (blobUrl) window.open(blobUrl, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[70vw] max-w-[70vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[70vw]">
        <DialogHeader className="shrink-0 border-b p-4">
          <DialogTitle>
            Preview PO — {target.packageName} ({target.variantName})
          </DialogTitle>
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
              title={`Preview PO ${target.packageName}`}
            />
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t p-4">
          <Button variant="outline" onClick={handleOpenNewTab} disabled={!blobUrl}>
            <ArrowRightUp weight="BoldDuotone" className="mr-2 h-4 w-4" />
            Buka di Tab Baru
          </Button>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            <CloseCircle weight="BoldDuotone" className="mr-2 h-4 w-4" />
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
