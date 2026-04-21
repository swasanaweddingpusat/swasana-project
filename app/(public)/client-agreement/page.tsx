"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, FileText, Lock } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

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
      const sigs = data.booking?.signatures as Record<string, unknown> | null;
      if (sigs?.client) { setStep("done"); return; }
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
      setStep("done");
      toast.success("Tanda tangan berhasil disimpan");
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSigning(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <Lock className="h-12 w-12 text-gray-400 mx-auto" />
          <h1 className="text-lg font-semibold">Link Tidak Valid</h1>
          <p className="text-sm text-gray-500">Link agreement yang Anda akses tidak valid.</p>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border p-6 text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <h1 className="text-lg font-semibold">Terima Kasih</h1>
          <p className="text-sm text-gray-500">Tanda tangan Anda telah berhasil disimpan. Anda dapat menutup halaman ini.</p>
        </div>
      </div>
    );
  }

  if (step === "sign") {
    const customer = booking?.customer as Record<string, unknown> | null;
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-sm font-semibold">Client Agreement</h1>
            <p className="text-xs text-gray-500">{(customer?.name as string) ?? "Client"}</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-8">
          <div className="bg-white rounded-lg border p-4 space-y-2 text-sm text-gray-700">
            <p className="font-medium">Informasi Booking</p>
            <p>Nama: <span className="font-medium">{(customer?.name as string) ?? "-"}</span></p>
            <p>No. PO: <span className="font-medium">{(booking?.poNumber as string) ?? "-"}</span></p>
          </div>
          {/* PDF Preview */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-gray-50">
              <p className="text-sm font-medium text-gray-700">Preview Purchase Order</p>
            </div>
            {loadingPdf ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">Memuat dokumen...</span>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} className="w-full border-0" style={{ height: "65vh", minHeight: "400px" }} title="PO Preview" />
            ) : (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-gray-400">Preview tidak tersedia</p>
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-2.5 border-b bg-gray-50">
              <p className="text-sm font-medium">Tanda Tangan Client</p>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">Dengan menandatangani, Anda menyetujui seluruh isi dokumen.</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={sigRef}
                  canvasProps={{ className: "w-full", style: { width: "100%", height: "200px" } }}
                  onEnd={() => setHasSigned(true)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { sigRef.current?.clear(); setHasSigned(false); }}>
                  Hapus
                </Button>
                <Button size="sm" className="ml-auto" onClick={handleSign} disabled={signing || !hasSigned}>
                  {signing ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Menyimpan...</> : "Kirim Tanda Tangan"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border p-6 space-y-5">
        <div className="text-center space-y-1">
          <FileText className="h-10 w-10 text-gray-700 mx-auto" />
          <h1 className="text-lg font-semibold">Client Agreement</h1>
          <p className="text-sm text-gray-500">Masukkan kode akses untuk melanjutkan</p>
        </div>
        <form onSubmit={handleValidate} className="space-y-4">
          <div>
            <Label htmlFor="accessCode">Kode Akses</Label>
            <Input
              id="accessCode"
              placeholder="Contoh: AB1C2D"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              className="mt-1 text-center text-lg tracking-widest font-mono"
              maxLength={6}
              autoFocus
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !accessCode.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memvalidasi...</> : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ClientAgreementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    }>
      <ClientAgreementContent />
    </Suspense>
  );
}
