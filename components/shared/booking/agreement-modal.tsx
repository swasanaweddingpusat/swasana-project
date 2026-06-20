"use client";

import React from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Refresh, Copy } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { generateAgreementToken } from "@/actions/client-agreement";

const RefreshCw = Refresh;

function copyText(text: string): void {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export interface AgreementModalProps {
  bookingId: string;
  customerName: string;
  onClose: () => void;
}

export function AgreementModal({ bookingId, customerName, onClose }: AgreementModalProps): React.JSX.Element {
  const [agreement, setAgreement] = React.useState<{ token: string; accessCode: string; status?: string } | null>(null);
  const [bookingStatus, setBookingStatus] = React.useState<string>("");
  const [confirmRegen, setConfirmRegen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const agreementUrl = agreement ? `${window.location.origin}/client-agreement?token=${agreement.token}` : null;

  const generate = React.useCallback(() => {
    startTransition(async () => {
      const result = await generateAgreementToken(bookingId);
      if (!result.success) { toast.error(result.error); return; }
      setConfirmRegen(false);
      setAgreement({ token: result.agreement.token, accessCode: result.agreement.accessCode, status: result.agreement.status });
      toast.success("Link & kode akses baru di-generate");
    });
  }, [bookingId]);

  React.useEffect(() => {
    startTransition(async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) return;
      const data = await res.json() as { bookingStatus?: string; clientAgreement?: { token: string; accessCode: string; status: string } | null };
      if (data.bookingStatus) setBookingStatus(data.bookingStatus);
      // Only show existing agreement if booking is Confirmed or agreement is genuinely pending/sent
      if (data.clientAgreement && (data.bookingStatus === "Confirmed" || data.clientAgreement.status !== "Signed")) {
        setAgreement({ token: data.clientAgreement.token, accessCode: data.clientAgreement.accessCode, status: data.clientAgreement.status });
      }
    });

  }, [bookingId]);

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="sm:max-w-md!" style={{ width: "min(calc(100vw - 2rem), 28rem)" }} onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Client Agreement</AlertDialogTitle>
          <AlertDialogDescription>{customerName}</AlertDialogDescription>
        </AlertDialogHeader>

        {isPending ? (
          <div className={cn('flex', 'items-center', 'justify-center', 'py-8', 'gap-2', 'text-sm', 'text-muted-foreground')}>
            <RefreshCw weight="BoldDuotone" className={cn('h-4', 'w-4', 'animate-spin')} /> Loading...
          </div>
        ) : !agreement ? (
          <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-8', 'gap-3', 'text-center')}>
            <p className={cn('text-sm', 'text-muted-foreground')}>Belum ada link agreement untuk booking ini.</p>
            <Button size="sm" onClick={generate} disabled={isPending}>Generate Link</Button>
          </div>
        ) : (
          <div className={cn('space-y-3', 'py-1')}>
            {agreement.status === "Pending" && (
              <div className="rounded-lg border border-border bg-muted/50 p-2.5">
                <p className="text-xs text-muted-foreground font-medium">Link dan kode akses baru sudah otomatis di-generate. Silakan kirimkan ke client untuk menandatangani ulang PO terbaru.</p>
              </div>
            )}
            <div className="space-y-1">
              <p className={cn('text-xs', 'text-muted-foreground', 'font-medium')}>Link Agreement</p>
              <div className={cn('flex', 'items-center', 'gap-2', 'overflow-hidden')}>
                <code className={cn('min-w-0', 'flex-1', 'text-xs', 'bg-muted', 'rounded', 'px-2', 'py-1.5', 'block', 'break-all')}>{agreementUrl}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreementUrl!); toast.success("Link disalin"); }}>
                  <Copy weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className={cn('text-xs', 'text-muted-foreground', 'font-medium')}>Kode Akses</p>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <code className={cn('flex-1', 'text-lg', 'font-mono', 'font-bold', 'tracking-widest', 'bg-muted', 'rounded', 'px-2', 'py-1.5')}>{agreement.accessCode}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreement.accessCode); toast.success("Kode disalin"); }}>
                  <Copy weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                </Button>
              </div>
            </div>

            {confirmRegen ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
                <p className="text-xs text-foreground font-medium">Generate ulang link & kode akses?</p>
                <p className="text-xs text-muted-foreground">Link dan kode lama akan langsung nonaktif. Jika client sudah tanda tangan, tanda tangannya direset dan booking kembali ke status Pending sampai client menandatangani PO terbaru.</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="destructive" className="rounded-full" onClick={generate} disabled={isPending}>
                    {isPending ? "Memproses..." : "Ya, Regenerate"}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setConfirmRegen(false)} disabled={isPending}>
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => setConfirmRegen(true)} disabled={isPending}>
                <RefreshCw weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'mr-1.5')} />
                Regenerate Link & Kode
              </Button>
            )}
          </div>
        )}

        <AlertDialogFooter>
          {agreement?.status === "Signed" && bookingStatus === "Confirmed" ? (
            <p className={cn('text-xs', 'text-muted-foreground', 'mr-auto')}>✓ Sudah ditandatangani</p>
          ) : null}
          <AlertDialogCancel onClick={onClose}>Tutup</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
