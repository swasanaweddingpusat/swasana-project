"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Copy, Refresh, CloseCircle } from "@solar-icons/react";
import {
  generateShareLink,
  revokeShareLink,
} from "@/actions/weddingIndicatorShare";
import { toast } from "sonner";

interface ShareData {
  token: string;
  accessCode: string;
  status: string;
  viewedAt: string | null;
  lastEditedAt: string | null;
}

interface ShareModalProps {
  indicatorId: string;
  coupleName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({
  indicatorId,
  coupleName,
  open,
  onOpenChange,
}: ShareModalProps) {
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState<ShareData | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    fetch(
      `/api/wedding-indicator-share/status?indicatorId=${encodeURIComponent(indicatorId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.share) {
          setShare(data.share);
        } else {
          setShare(null);
        }
      })
      .catch(() => setShare(null))
      .finally(() => setFetching(false));
  }, [open, indicatorId]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generateShareLink(indicatorId);
      if (result.success) {
        setShare({
          token: result.share.token,
          accessCode: result.share.accessCode,
          status: "Active",
          viewedAt: null,
          lastEditedAt: null,
        });
        toast.success("Share link berhasil dibuat");
      } else {
        toast.error(result.error || "Gagal membuat share link");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    try {
      const result = await revokeShareLink(indicatorId);
      if (result.success) {
        setShare((prev) =>
          prev ? { ...prev, status: "Revoked" } : null
        );
        toast.success("Share link berhasil dinonaktifkan");
      } else {
        toast.error(result.error || "Gagal menonaktifkan share link");
      }
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} berhasil disalin`);
  }

  const shareUrl = share
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/wedding-indicator?token=${share.token}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Share Kuesioner — {coupleName}
          </DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Memuat...
          </div>
        ) : !share ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Belum ada share link untuk kuesioner ini. Generate link agar
              pasangan bisa mengisi kuesioner dari browser mereka.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Generating..." : "Generate Share Link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  share.status === "Active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {share.status}
              </span>
              {share.viewedAt && (
                <span className="text-xs text-muted-foreground">
                  Dilihat:{" "}
                  {new Date(share.viewedAt).toLocaleDateString("id-ID")}
                </span>
              )}
              {share.lastEditedAt && (
                <span className="text-xs text-muted-foreground">
                  Diedit:{" "}
                  {new Date(share.lastEditedAt).toLocaleDateString("id-ID")}
                </span>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Link</Label>
              <div className="mt-1 flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(shareUrl, "Link")}
                >
                  <Copy weight="BoldDuotone" className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">
                Kode Akses
              </Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={share.accessCode}
                  readOnly
                  className="font-mono text-lg tracking-widest text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    copyToClipboard(share.accessCode, "Kode akses")
                  }
                >
                  <Copy weight="BoldDuotone" className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <AlertDialog>
                <AlertDialogTrigger>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="flex-1"
                  >
                    <Refresh
                      weight="BoldDuotone"
                      className="h-4 w-4 mr-1"
                    />
                    Regenerate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Link?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Link dan kode akses lama akan tidak berlaku lagi.
                      Pasangan harus menggunakan link dan kode baru.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGenerate}>
                      Ya, Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {share.status === "Active" && (
                <AlertDialog>
                  <AlertDialogTrigger>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={loading}
                      className="flex-1"
                    >
                      <CloseCircle
                        weight="BoldDuotone"
                        className="h-4 w-4 mr-1"
                      />
                      Revoke
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Nonaktifkan Link?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Pasangan tidak akan bisa mengakses kuesioner lagi
                        melalui link ini. Anda bisa generate link baru nanti.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRevoke}>
                        Ya, Nonaktifkan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
