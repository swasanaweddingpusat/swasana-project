"use client";

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
import { toast } from "sonner";
import {
  useShareStatus,
  useGenerateShareLink,
  useRevokeShareLink,
} from "@/hooks/useWeddingIndicators";

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
  const { data, isLoading, isError } = useShareStatus(indicatorId, open);
  const generateMutation = useGenerateShareLink(indicatorId);
  const revokeMutation = useRevokeShareLink(indicatorId);

  const share = data?.share ?? null;
  const loading = generateMutation.isPending || revokeMutation.isPending;

  async function handleGenerate() {
    const result = await generateMutation.mutateAsync();
    if (result.success) {
      toast.success("Share link berhasil dibuat");
    } else {
      toast.error(result.error || "Gagal membuat share link");
    }
  }

  async function handleRevoke() {
    const result = await revokeMutation.mutateAsync();
    if (result.success) {
      toast.success("Share link berhasil dinonaktifkan");
    } else {
      toast.error(result.error || "Gagal menonaktifkan share link");
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

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Memuat...
          </div>
        ) : isError ? (
          <div className="py-8 text-center text-destructive text-sm">
            Gagal memuat status share link.
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
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
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
                <AlertDialogTrigger
                  render={
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
                  }
                />
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
                  <AlertDialogTrigger
                    render={
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
                    }
                  />
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
