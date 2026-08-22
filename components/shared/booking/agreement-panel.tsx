"use client";

import React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Refresh, Copy, UploadMinimalistic, FileText, CloseCircle, CheckCircle, DangerTriangle, DownloadMinimalistic } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { generateAgreementToken, uploadManualAgreement } from "@/actions/client-agreement";
import { uploadFileDirect } from "@/lib/upload-client";
import { MAX_UPLOAD_SIZE_BYTES, isAllowedAgreementUploadMimeType } from "@/lib/validations/upload";
import { ApprovalWarningDialog } from "@/components/shared/approval-warning-dialog";

const RefreshCw = Refresh;

// Baca nomor PO otomatis via Claude (9router) — dimatikan sementara. Set true
// buat aktifin lagi; sisanya (input No PO, guard mismatch, upload) tetep jalan.
const AI_PO_EXTRACT_ENABLED: boolean = false;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

export interface AgreementPanelProps {
  bookingId: string;
  /** Called after a successful manual PO upload (and after regenerate). Hosts use
   *  this to close a dialog or refresh the surrounding view. */
  onCompleted?: () => void;
}

/**
 * The interactive Client Agreement body: generate/copy link + access code,
 * regenerate, and the manual PO (physically-signed PDF) upload toggle. Rendered
 * both inside {@link AgreementModal} and directly in the booking detail
 * "Client Agreement" tab (page + modal). It owns its own data fetch, so it works
 * standalone in any host surface.
 */
export function AgreementPanel({ bookingId, onCompleted }: AgreementPanelProps): React.JSX.Element {
  const [agreement, setAgreement] = React.useState<{ token: string; accessCode: string; status?: string } | null>(null);
  const [bookingStatus, setBookingStatus] = React.useState<string>("");
  const [confirmRegen, setConfirmRegen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [manualFile, setManualFile] = React.useState<File | null>(null);
  const [uploadingManual, setUploadingManual] = React.useState(false);
  const [showManualUpload, setShowManualUpload] = React.useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = React.useState(false);
  const [noPO, setNoPO] = React.useState("");
  const [systemPoNumber, setSystemPoNumber] = React.useState("");
  // PO manual (scan PO fisik yg diupload staff sbg ganti ttd digital). fileUrl
  // di-resolve server-side di GET /api/bookings/[id]. Null kalau step diselesaikan
  // via ttd digital atau belum ada upload.
  const [uploaded, setUploaded] = React.useState<{ fileName: string; fileUrl?: string } | null>(null);
  // Hasil baca nomor PO otomatis dari dokumen (Claude via 9router). Asisten
  // auto-fill + indikator — bukan gerbang; server tetap sumber kebenaran.
  const [extracting, setExtracting] = React.useState(false);
  const [extraction, setExtraction] = React.useState<{ found: boolean; poNumber: string | null; confidence: number } | null>(null);
  const manualFileInputRef = React.useRef<HTMLInputElement>(null);

  const agreementUrl = agreement ? `${window.location.origin}/client-agreement?token=${agreement.token}` : null;
  // Live compare No PO ketikan staff vs poNumber sistem. Kosong (belum loaded /
  // belum ngetik) = belum dianggap mismatch.
  const poMismatch = systemPoNumber.length > 0 && noPO.trim().length > 0 && noPO.trim() !== systemPoNumber;

  const normalizePo = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");

  // Kirim PDF ke Claude buat baca nomor PO. Auto-isi field HANYA kalau masih
  // kosong & AI cukup yakin (jangan nimpa ketikan staff). Gagal baca = diam,
  // staff isi manual seperti biasa.
  const runExtraction = React.useCallback(async (file: File) => {
    setExtracting(true);
    setExtraction(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/client-agreement/extract-po", { method: "POST", body: fd });
      const data = (await res.json()) as { success: boolean; found?: boolean; poNumber?: string | null; confidence?: number };
      if (!data.success) return;
      const found = data.found ?? false;
      const poNumber = data.poNumber ?? null;
      const confidence = data.confidence ?? 0;
      setExtraction({ found, poNumber, confidence });
      if (found && poNumber && confidence >= 0.6) {
        setNoPO((prev) => (prev.trim().length === 0 ? poNumber : prev));
      }
    } catch {
      // biarin — indikator gak muncul, staff isi manual
    } finally {
      setExtracting(false);
    }
  }, []);

  // Status baca AI buat ditampilin di bawah input No PO. Dihitung ulang tiap
  // render; if/else (bukan ternary statement) sesuai aturan ESLint project.
  let aiStatus: { tone: "loading" | "ok" | "bad" | "warn" | "info"; text: string } | null = null;
  if (extracting) {
    aiStatus = { tone: "loading", text: "Membaca nomor PO dari dokumen…" };
  } else if (extraction) {
    if (!extraction.found || !extraction.poNumber) {
      aiStatus = { tone: "warn", text: "Nomor PO tidak terbaca otomatis. Silakan isi manual." };
    } else if (extraction.confidence < 0.6) {
      aiStatus = { tone: "warn", text: `AI kurang yakin (terbaca: ${extraction.poNumber}). Periksa manual.` };
    } else if (!systemPoNumber) {
      aiStatus = { tone: "info", text: `Nomor PO terbaca dari dokumen: ${extraction.poNumber}.` };
    } else if (normalizePo(extraction.poNumber) === normalizePo(systemPoNumber)) {
      aiStatus = { tone: "ok", text: "Nomor PO dokumen cocok dengan sistem." };
    } else {
      aiStatus = { tone: "bad", text: `Nomor PO dokumen (${extraction.poNumber}) beda dengan sistem.` };
    }
  }

  const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (manualFileInputRef.current) manualFileInputRef.current.value = "";
    if (!file) return;
    if (!isAllowedAgreementUploadMimeType(file.type)) {
      toast.error("Tipe file tidak didukung. Gunakan file PDF.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("Ukuran file maksimal 10MB.");
      return;
    }
    setManualFile(file);
    if (AI_PO_EXTRACT_ENABLED) void runExtraction(file);
  };

  const uploadManual = async () => {
    if (!manualFile) return;
    if (!noPO.trim()) { toast.error("Nomor PO wajib diisi."); return; }
    // Guard cepat client-side (server tetap jadi sumber kebenaran).
    if (systemPoNumber && noPO.trim() !== systemPoNumber) {
      toast.error("No PO tidak sama dengan sistem saat ini.");
      return;
    }
    setUploadingManual(true);
    try {
      const { key } = await uploadFileDirect(manualFile, "client-agreements");
      const result = await uploadManualAgreement({
        bookingId,
        path: key,
        fileName: manualFile.name,
        fileType: manualFile.type,
        noPO: noPO.trim(),
      });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("PO manual berhasil diupload");
      onCompleted?.();
    } catch {
      toast.error("Gagal mengupload PO manual");
    } finally {
      setUploadingManual(false);
    }
  };

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
      const data = await res.json() as {
        bookingStatus?: string;
        poNumber?: string | null;
        clientAgreement?: { token: string; accessCode: string; status: string } | null;
        clientSignature?: string | null;
        clientAgreementUploaded?: { fileName: string; fileUrl?: string } | null;
      };
      if (data.bookingStatus) setBookingStatus(data.bookingStatus);
      if (data.poNumber) setSystemPoNumber(data.poNumber.trim());
      // Only show existing agreement if booking is Confirmed or agreement is genuinely pending/sent
      if (data.clientAgreement && (data.bookingStatus === "Confirmed" || data.clientAgreement.status !== "Signed")) {
        setAgreement({ token: data.clientAgreement.token, accessCode: data.clientAgreement.accessCode, status: data.clientAgreement.status });
      }
      // PO manual (scan fisik) hanya tampil kalau step BUKAN diselesaikan lewat
      // ttd digital — ttd digital jadi bukti utama & lebih diprioritaskan.
      if (data.clientAgreementUploaded && !data.clientSignature) {
        setUploaded({ fileName: data.clientAgreementUploaded.fileName, fileUrl: data.clientAgreementUploaded.fileUrl });
      }
    });
  }, [bookingId]);

  if (isPending) {
    return (
      <div className={cn('flex', 'items-center', 'justify-center', 'py-8', 'gap-2', 'text-sm', 'text-muted-foreground')}>
        <RefreshCw weight="BoldDuotone" className={cn('h-4', 'w-4', 'animate-spin')} /> Loading...
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-8', 'gap-3', 'text-center')}>
        <p className={cn('text-sm', 'text-muted-foreground')}>Belum ada link agreement untuk booking ini.</p>
        <Button size="sm" onClick={generate} disabled={isPending}>Generate Link</Button>
      </div>
    );
  }

  return (
    <div className={cn('min-w-0', 'space-y-3', 'py-1')}>
      {agreement.status !== "Signed" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText weight="BoldDuotone" className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Upload PO Manual</p>
              <p className="text-[10px] text-muted-foreground">Client sudah tanda tangan fisik di kertas</p>
            </div>
          </div>
          <Switch
            checked={showManualUpload}
            onCheckedChange={(checked) => { setShowManualUpload(checked); setConfirmRegen(false); }}
            disabled={isPending || uploadingManual}
          />
        </div>
      )}

      {agreement.status === "Pending" && !showManualUpload && (
        <div className="rounded-lg border border-border bg-muted/50 p-2.5">
          <p className="text-xs text-muted-foreground font-medium">Link dan kode akses sudah siap. Silakan kirimkan ke client untuk menandatangani PO.</p>
        </div>
      )}

      {showManualUpload && agreement.status !== "Signed" ? (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <label htmlFor="manual-po-number" className="text-xs font-medium text-foreground">
              Nomor PO <span className="text-destructive">*</span>
            </label>
            <Input
              id="manual-po-number"
              value={noPO}
              onChange={(e) => setNoPO(e.target.value)}
              placeholder="Ketik Nomor PO sesuai dokumen"
              disabled={uploadingManual}
              aria-invalid={poMismatch}
              className={cn("rounded-xl text-sm", poMismatch && "border-destructive")}
            />
            <p className={cn("text-[10px]", poMismatch ? "font-medium text-destructive" : "text-muted-foreground")}>
              {poMismatch
                ? "Nomor PO tidak sama dengan sistem saat ini."
                : "Wajib sama persis dengan Nomor PO booking di sistem."}
            </p>

            {aiStatus && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px]",
                  aiStatus.tone === "bad" && "border-destructive/30 bg-destructive/10 text-destructive",
                  aiStatus.tone === "ok" && "border-primary/30 bg-primary/5 text-foreground",
                  (aiStatus.tone === "loading" || aiStatus.tone === "warn" || aiStatus.tone === "info") &&
                    "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {aiStatus.tone === "loading" ? (
                  <Refresh weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : aiStatus.tone === "ok" ? (
                  <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : aiStatus.tone === "bad" ? (
                  <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <DangerTriangle weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{aiStatus.text}</span>
              </div>
            )}
          </div>

          {manualFile ? (
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText weight="BoldDuotone" className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground" title={manualFile.name}>{manualFile.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(manualFile.size)}</p>
              </div>
              <button
                type="button"
                aria-label="Hapus file"
                className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={() => { setManualFile(null); setExtraction(null); }}
                disabled={uploadingManual}
              >
                <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-3 text-muted-foreground transition-colors hover:bg-accent/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UploadMinimalistic weight="BoldDuotone" className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Pilih file untuk diupload</p>
                <p className="text-[10px] text-muted-foreground">PDF · maks 10MB</p>
              </div>
              <input
                ref={manualFileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleManualFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          )}

          <Button
            variant="default"
            className="h-auto w-full rounded-lg py-3"
            onClick={() => setShowUploadConfirm(true)}
            disabled={!manualFile || !noPO.trim() || uploadingManual}
          >
            {uploadingManual ? "Mengupload..." : "Upload PO Manual"}
          </Button>
        </div>
      ) : (
        <>
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
              <p className="text-xs text-muted-foreground">Link dan kode lama akan langsung nonaktif dan diganti yang baru. Tanda tangan client dan status booking tidak berubah.</p>
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
        </>
      )}

      {uploaded && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">PO Manual (Upload)</p>
          <a
            href={uploaded.fileUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <FileText weight="BoldDuotone" className="h-4 w-4 text-primary" />
            <span className="max-w-60 truncate">{uploaded.fileName}</span>
            <DownloadMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      )}

      {agreement.status === "Signed" && bookingStatus === "Confirmed" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5 text-primary" /> Sudah ditandatangani
        </div>
      )}

      <ApprovalWarningDialog
        open={showUploadConfirm}
        onOpenChange={setShowUploadConfirm}
        title="Konfirmasi Upload PO Manual"
        description="Anda akan menyelesaikan tahap Client Agreement dengan mengunggah PO yang sudah ditandatangani client secara fisik."
        warnings={[
          "Dokumen PO yang diunggah akan tercatat sebagai bukti persetujuan resmi client pada booking ini.",
          "Nomor PO yang Anda masukkan wajib sama persis dengan Nomor PO booking di sistem saat ini.",
          "Setelah diunggah, tahap Client Agreement langsung berstatus disetujui dan tidak bisa diubah tanpa proses reset approval oleh pihak yang berwenang.",
          "Jika terjadi perubahan pada booking — seperti paket, tanggal event, venue, harga, atau ketentuan pembayaran — setelah PO diunggah, tanda tangan Manager harus di-approve ulang untuk mengecek kembali setiap perubahan.",
          "Pastikan PO yang diunggah sudah benar dan sudah ditandatangani client, karena persetujuan ini bersifat mengikat.",
          ...(poMismatch
            ? ["PERHATIAN: Nomor PO yang Anda masukkan TIDAK sama dengan Nomor PO di sistem. Upload akan DITOLAK — periksa kembali dokumen PO sebelum melanjutkan."]
            : []),
        ]}
        confirmLabel="Ya, Upload PO"
        onConfirm={() => {
          setShowUploadConfirm(false);
          void uploadManual();
        }}
        submitting={uploadingManual}
      />
    </div>
  );
}
