"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Refresh, CheckCircle, FileText, Lock, DownloadMinimalistic } from "@solar-icons/react";
import SignatureCanvas from "react-signature-canvas";
import { cn } from "../../../lib/utils";

// react-pdf must not be SSR'd — uses browser canvas/worker APIs
const PdfCanvasViewer = dynamic(
  () => import("@/components/shared/PdfCanvasViewer").then((m) => ({ default: m.PdfCanvasViewer })),
  {
    ssr: false,
    loading: () => (
      <div className={cn("flex", "h-full", "items-center", "justify-center")}>
        <Refresh weight="BoldDuotone" className={cn("h-8", "w-8", "animate-spin", "text-muted-foreground")} />
      </div>
    ),
  }
);

function ClientAgreementContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [accessCode, setAccessCode] = React.useState("");
  const [step, setStep] = React.useState<"code" | "sign" | "done">("code");
  const [booking, setBooking] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [hasSigned, setHasSigned] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = React.useState<string | null>(null);
  const [loadingSignedPdf, setLoadingSignedPdf] = React.useState(false);
  const sigRef = React.useRef<SignatureCanvas>(null);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error("Link tidak valid"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/client-agreement/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accessCode: accessCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Gagal validasi"); return; }
      setBooking(data.booking);
      if (data.alreadySigned) { setStep("done"); return; }
      if (data.agreement?.status === "Signed") { setStep("done"); return; }
      setStep("sign");
      generatePdf();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const generatePdf = async () => {
    setLoadingPdf(true);
    try {
      const res = await fetch("/api/client-agreement/render-po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accessCode: accessCode.trim() }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch {
      // PDF preview optional, gak block signing
    } finally {
      setLoadingPdf(false);
    }
  };

  const fetchSignedPdf = async (): Promise<void> => {
    setLoadingSignedPdf(true);
    try {
      const res = await fetch("/api/client-agreement/render-po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accessCode: accessCode.trim() }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      setSignedPdfUrl(URL.createObjectURL(blob));
    } catch {
      // Download button will be hidden if fetch fails — non-critical
    } finally {
      setLoadingSignedPdf(false);
    }
  };

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Silakan tanda tangan terlebih dahulu");
      return;
    }
    const signatureData = sigRef.current.toDataURL("image/png");
    setSigning(true);
    try {
      const res = await fetch("/api/client-agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accessCode, signatureData }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Gagal menyimpan tanda tangan"); return; }
      // Fetch signed PDF (with embedded signature) before showing modal.
      await fetchSignedPdf();
      setStep("done");
      setShowSuccessModal(true);
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSigning(false);
    }
  };

  if (!token) {
    return (
      <div className={cn('min-h-screen', 'flex', 'items-center', 'justify-center', 'bg-gray-50', 'px-4')}>
        <div className={cn('text-center', 'space-y-3')}>
          <Lock weight="BoldDuotone" className={cn('h-12', 'w-12', 'text-gray-400', 'mx-auto')} />
          <h1 className={cn('text-lg', 'font-semibold')}>Link Tidak Valid</h1>
          <p className={cn('text-sm', 'text-gray-500')}>Link agreement yang Anda akses tidak valid.</p>
        </div>
      </div>
    );
  }

  const poNumber = (booking?.poNumber as string) ?? "";
  const signedFilename = poNumber
    ? `client-agreement-${poNumber.replace(/\//g, "-")}-signed.pdf`
    : "agreement-signed.pdf";

  if (step === "done") {
    return (
      <>
        <div className={cn('min-h-screen', 'flex', 'items-center', 'justify-center', 'bg-gray-50', 'px-4')}>
          <div className={cn('w-full', 'max-w-sm', 'bg-white', 'rounded-2xl', 'shadow-sm', 'border', 'p-6', 'text-center', 'space-y-4')}>
            <CheckCircle weight="BoldDuotone" className={cn('h-14', 'w-14', 'mx-auto')} style={{ color: "var(--brand-gold)" }} />
            <h1 className={cn('text-lg', 'font-semibold')}>Terima Kasih</h1>
            <p className={cn('text-sm', 'text-muted-foreground')}>
              Dokumen Anda sudah ditandatangani. Silakan unduh salinan agreement Anda di bawah ini.
            </p>
            {loadingSignedPdf ? (
              <div className={cn('flex', 'items-center', 'justify-center', 'gap-2', 'py-1')}>
                <Refresh weight="BoldDuotone" className={cn('h-4', 'w-4', 'animate-spin', 'text-muted-foreground')} />
                <span className={cn('text-xs', 'text-muted-foreground')}>Menyiapkan dokumen...</span>
              </div>
            ) : signedPdfUrl ? (
              <a
                href={signedPdfUrl}
                download={signedFilename}
                className={cn(
                  'inline-flex', 'items-center', 'justify-center', 'gap-2',
                  'rounded-full', 'bg-primary', 'px-5', 'py-2.5',
                  'text-sm', 'font-medium', 'text-primary-foreground',
                  'transition-colors', 'hover:bg-primary/90',
                )}
              >
                <DownloadMinimalistic weight="BoldDuotone" className="h-4 w-4" />
                Download Agreement
              </a>
            ) : null}
          </div>
        </div>

        {/* Success modal — shown immediately after signing (showSuccessModal=true).
            The static card above is the fallback for already-signed links (alreadySigned). */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="max-w-sm rounded-2xl text-center">
            <DialogHeader className="items-center gap-3 pb-1">
              <CheckCircle weight="BoldDuotone" className="h-14 w-14" style={{ color: "var(--brand-gold)" }} />
              <DialogTitle className="text-lg">Terima kasih!</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Dokumen Anda sudah ditandatangani. Unduh salinan agreement Anda sebelum menutup halaman ini.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 pt-2">
              {loadingSignedPdf ? (
                <div className={cn('flex', 'items-center', 'gap-2')}>
                  <Refresh weight="BoldDuotone" className={cn('h-4', 'w-4', 'animate-spin', 'text-muted-foreground')} />
                  <span className={cn('text-xs', 'text-muted-foreground')}>Menyiapkan dokumen...</span>
                </div>
              ) : signedPdfUrl ? (
                <a
                  href={signedPdfUrl}
                  download={signedFilename}
                  className={cn(
                    'inline-flex', 'items-center', 'justify-center', 'gap-2',
                    'rounded-full', 'bg-primary', 'px-5', 'py-2.5',
                    'text-sm', 'font-medium', 'text-primary-foreground',
                    'transition-colors', 'hover:bg-primary/90',
                  )}
                >
                  <DownloadMinimalistic weight="BoldDuotone" className="h-4 w-4" />
                  Download Agreement
                </a>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowSuccessModal(false)}
              >
                Tutup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (step === "sign") {
    const customer = booking?.customer as Record<string, unknown> | null;
    return (
      <div className={cn('min-h-screen', 'bg-gray-50')}>
        <div className={cn('sticky', 'top-0', 'z-10', 'bg-white', 'border-b', 'px-4', 'py-3')}>
          <div className={cn('max-w-4xl', 'mx-auto', 'flex', 'items-center', 'justify-between', 'gap-3')}>
            <div>
              <h1 className={cn('text-sm', 'font-semibold')}>Client Agreement</h1>
              <p className={cn('text-xs', 'text-gray-500')}>{(customer?.name as string) ?? "Client"}</p>
            </div>
            {pdfUrl && (
              <a
                href={pdfUrl}
                download={`client-agreement-${((booking?.poNumber as string) ?? "").replace(/\//g, "-") || "dokumen"}.pdf`}
                className={cn(
                  'flex', 'items-center', 'gap-1.5',
                  'rounded-full', 'bg-primary', 'px-3', 'py-1.5',
                  'text-xs', 'font-medium', 'text-primary-foreground',
                  'transition-colors', 'hover:bg-primary/90',
                )}
              >
                <DownloadMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5" />
                Download
              </a>
            )}
          </div>
        </div>
        <div className={cn('max-w-4xl', 'mx-auto', 'px-4', 'sm:px-6', 'lg:px-8', 'py-6', 'space-y-4', 'pb-12')}>
          <div className={cn('bg-white', 'rounded-lg', 'border', 'p-4', 'sm:p-6', 'space-y-2', 'text-sm', 'text-gray-700')}>
            <p className="font-medium">Informasi Booking</p>
            <p>Nama: <span className="font-medium">{(customer?.name as string) ?? "-"}</span></p>
            <p>No. PO: <span className="font-medium">{(booking?.poNumber as string) ?? "-"}</span></p>
          </div>
          {/* PDF Preview */}
          <div className={cn('bg-white', 'rounded-lg', 'border', 'overflow-hidden')}>
            <div className={cn('px-4', 'py-2.5', 'border-b', 'bg-gray-50')}>
              <p className={cn('text-sm', 'font-medium', 'text-gray-700')}>Preview Agreement</p>
            </div>
            {loadingPdf ? (
              <div className={cn('flex', 'items-center', 'justify-center', 'py-16')}>
                <Refresh weight="BoldDuotone" className={cn('h-5', 'w-5', 'animate-spin', 'text-muted-foreground', 'mr-2')} />
                <span className={cn('text-sm', 'text-muted-foreground')}>Memuat dokumen...</span>
              </div>
            ) : pdfUrl ? (
              // Canvas-based renderer — shows ALL pages on mobile (iOS Safari iframe only renders page 1)
              <div className="h-[75vh] min-h-[500px] w-full">
                <PdfCanvasViewer blobUrl={pdfUrl} showZoomControls />
              </div>
            ) : (
              <div className={cn('flex', 'items-center', 'justify-center', 'py-16')}>
                <p className={cn('text-sm', 'text-muted-foreground')}>Preview tidak tersedia</p>
              </div>
            )}
          </div>
          <div className={cn('bg-white', 'rounded-lg', 'border')}>
            <div className={cn('px-4', 'py-2.5', 'border-b', 'bg-gray-50')}>
              <p className={cn('text-sm', 'font-medium')}>Tanda Tangan Client</p>
            </div>
            <div className={cn('p-4', 'sm:p-6', 'space-y-3')}>
              <p className={cn('text-xs', 'text-gray-500')}>Dengan menandatangani, Anda menyetujui seluruh isi dokumen.</p>
              <div className={cn('border-2', 'border-dashed', 'border-gray-300', 'rounded-lg', 'overflow-hidden', 'bg-white')}>
                <SignatureCanvas
                  ref={sigRef}
                  canvasProps={{ className: "w-full", style: { width: "100%", height: "200px" } }}
                  onEnd={() => setHasSigned(true)}
                />
              </div>
              <div className={cn('flex', 'gap-2')}>
                <Button variant="outline" size="sm" onClick={() => { sigRef.current?.clear(); setHasSigned(false); }}>
                  Hapus
                </Button>
                <Button size="sm" className="ml-auto" onClick={handleSign} disabled={signing || !hasSigned}>
                  {signing ? <><Refresh weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'mr-1', 'animate-spin')} />Menyimpan...</> : "Kirim Tanda Tangan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen', 'flex', 'items-center', 'justify-center', 'bg-gray-50', 'px-4')}>
      <div className={cn('w-full', 'max-w-md', 'bg-white', 'rounded-xl', 'shadow-sm', 'border', 'p-6', 'sm:p-8', 'space-y-5')}>
        <div className={cn('text-center', 'space-y-1')}>
          <FileText weight="BoldDuotone" className={cn('h-10', 'w-10', 'text-gray-700', 'mx-auto')} />
          <h1 className={cn('text-lg', 'font-semibold')}>Client Agreement</h1>
          <p className={cn('text-sm', 'text-gray-500')}>Masukkan kode akses untuk melanjutkan</p>
        </div>
        <form onSubmit={handleValidate} className="space-y-4">
          <div>
            <Label htmlFor="accessCode">Kode Akses</Label>
            <Input
              id="accessCode"
              placeholder="Contoh: AB1C2D"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              className={cn('mt-1', 'text-center', 'text-lg', 'tracking-widest', 'font-mono')}
              maxLength={6}
              autoFocus
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !accessCode.trim()}>
            {loading ? <><Refresh weight="BoldDuotone" className={cn('h-4', 'w-4', 'mr-2', 'animate-spin')} />Memvalidasi...</> : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ClientAgreementPage() {
  return (
    <Suspense fallback={
      <div className={cn('min-h-screen', 'flex', 'items-center', 'justify-center', 'bg-gray-50')}>
        <Refresh weight="BoldDuotone" className={cn('h-6', 'w-6', 'animate-spin', 'text-gray-400')} />
      </div>
    }>
      <ClientAgreementContent />
    </Suspense>
  );
}
