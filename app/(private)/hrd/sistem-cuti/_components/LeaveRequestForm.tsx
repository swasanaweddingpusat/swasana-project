"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeaveTypes } from "@/hooks/use-leave-types";
import { useLeaveBalances } from "@/hooks/use-leave-balances";
import { useSubmitLeaveRequest } from "@/hooks/use-leave-requests";
import { useHolidayTokens } from "@/hooks/use-holiday-tokens";
import { countWeekdays, getAvailableBalance } from "@/lib/leave-helpers";
import { uploadFileDirect } from "@/lib/upload-client";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/validations/upload";
import { DocumentText, UploadMinimalistic, FileText, CloseCircle, Camera, Wallet } from "@solar-icons/react";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FormState {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  photoBase64: string;
  photoName: string;
  publicHolidayId: string;
}

interface LeaveRequestFormProps {
  inDialog?: boolean;
  onSubmitted?: () => void;
}

const EMPTY_FORM: FormState = {
  leaveTypeId: "",
  startDate: "",
  endDate: "",
  reason: "",
  photoBase64: "",
  photoName: "",
  publicHolidayId: "",
};

export function LeaveRequestForm({ inDialog = false, onSubmitted }: LeaveRequestFormProps) {
  const { data: session } = useSession();
  const { data: leaveTypes } = useLeaveTypes();
  const submitMutation = useSubmitLeaveRequest();

  const profileId = session?.user?.profileId;
  const currentYear = new Date().getFullYear();
  const { data: balances } = useLeaveBalances(
    profileId ? { profileId, year: currentYear } : undefined
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedType = useMemo(
    () => leaveTypes?.find((t) => t.id === form.leaveTypeId),
    [leaveTypes, form.leaveTypeId]
  );

  const isHolidayToken = selectedType?.code === "public_holiday";
  const { data: holidayTokens } = useHolidayTokens();

  const calculatedDays = useMemo(() => {
    if (isHolidayToken) return form.startDate ? 1 : 0;
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start > end) return 0;
    return countWeekdays(start, end);
  }, [isHolidayToken, form.startDate, form.endDate]);

  const balanceForType = useMemo(() => {
    if (!selectedType?.isDeductible || !balances) return null;
    return balances.find((b) => b.leaveTypeId === selectedType.id) ?? null;
  }, [selectedType, balances]);

  const availableDays = useMemo(() => {
    if (!balanceForType) return null;
    return getAvailableBalance(balanceForType);
  }, [balanceForType]);

  const isInsufficientBalance =
    availableDays !== null && calculatedDays > 0 && calculatedDays > availableDays;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bukti harus berupa gambar");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, photoBase64: reader.result as string, photoName: file.name }));
    };
    reader.onerror = () => toast.error("Gagal membaca file");
    reader.readAsDataURL(file);
  }, []);


  const handleSubmit = useCallback(async () => {
    if (!form.leaveTypeId) {
      toast.error("Pilih jenis cuti terlebih dahulu");
      return;
    }
    if (isHolidayToken) {
      if (!form.publicHolidayId) {
        toast.error("Pilih token hari besar terlebih dahulu");
        return;
      }
      if (!form.startDate) {
        toast.error("Tanggal libur wajib diisi");
        return;
      }
    } else {
      if (!form.startDate || !form.endDate) {
        toast.error("Tanggal mulai dan selesai wajib diisi");
        return;
      }
      if (calculatedDays === 0) {
        toast.error("Periode cuti tidak mengandung hari kerja");
        return;
      }
    }
    if (!form.photoBase64) {
      toast.error("Bukti wajib diupload");
      return;
    }

    let documentKey: string | undefined;
    if (selectedFile) {
      setIsUploading(true);
      try {
        const upload = await uploadFileDirect(selectedFile, "leave-documents");
        documentKey = upload.key;
      } catch (error) {
        setIsUploading(false);
        toast.error(error instanceof Error ? error.message : "Gagal mengunggah surat cuti");
        return;
      }
    }

    submitMutation.mutate(
      {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: isHolidayToken ? form.startDate : form.endDate,
        reason: form.reason || undefined,
        documentKey,
        photoBase64: form.photoBase64,
        publicHolidayId: isHolidayToken ? form.publicHolidayId : undefined,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Pengajuan cuti berhasil dikirim");
            setForm(EMPTY_FORM);
            setSelectedFile(null);
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            onSubmitted?.();
          } else {
            setIsUploading(false);
            toast.error(result.error ?? "Gagal mengajukan cuti");
          }
        },
        onError: () => {
          setIsUploading(false);
          toast.error("Terjadi kesalahan");
        },
      }
    );
  }, [form, isHolidayToken, calculatedDays, onSubmitted, selectedFile, submitMutation]);

  return (
    <Card className={inDialog ? "border-0 shadow-none" : "rounded-2xl shadow-sm"}>
      {!inDialog && <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DocumentText weight="BoldDuotone" className="h-5 w-5" />
          </span>
          <span>Ajukan Cuti</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Isi periode cuti dan alasan pengajuan Anda.
        </p>
      </CardHeader>}
      <CardContent className={inDialog ? "px-6 pb-6 pt-5 sm:px-7 sm:pb-7" : undefined}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="leave-type">Jenis Cuti *</Label>
            <Select
              value={form.leaveTypeId}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...EMPTY_FORM,
                  leaveTypeId: v,
                  reason: f.reason,
                }))
              }
            >
              <SelectTrigger id="leave-type" className="rounded-xl">
                <SelectValue placeholder="Pilih jenis cuti" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes?.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>
                    {lt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden sm:block" />

          {isHolidayToken ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="holiday-token">Hari Besar *</Label>
                <Select
                  value={form.publicHolidayId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, publicHolidayId: v }))
                  }
                >
                  <SelectTrigger id="holiday-token" className="rounded-xl">
                    <SelectValue placeholder="Pilih hari besar" />
                  </SelectTrigger>
                  <SelectContent>
                    {holidayTokens?.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {holidayTokens && holidayTokens.length === 0 ? (
                  <p className="text-xs text-destructive">
                    Tidak ada token libur hari besar tersisa.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sisa token: {holidayTokens?.length ?? 0}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="token-date">Tanggal Libur (bebas) *</Label>
                <Input
                  id="token-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="start-date">Tanggal Mulai *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="end-date">Tanggal Selesai *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
            </>
          )}

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="leave-document">Surat Cuti (opsional)</Label>
            <div className="relative flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
                <UploadMinimalistic weight="BoldDuotone" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Klik untuk pilih file</p>
                <p className="text-xs text-muted-foreground">PDF, Word, atau gambar. Maksimal 10MB.</p>
              </div>
              <input
                ref={fileInputRef}
                id="leave-document"
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > MAX_UPLOAD_SIZE_BYTES) {
                    toast.error("Ukuran surat cuti maksimal 10MB");
                    event.target.value = "";
                    setSelectedFile(null);
                    return;
                  }
                  setSelectedFile(file);
                }}
              />
            </div>
            {selectedFile && (
              <div className="flex animate-in items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm fade-in-0 slide-in-from-top-1">
                <FileText weight="BoldDuotone" className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{selectedFile.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </span>
                <button
                  type="button"
                  aria-label="Hapus file"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {calculatedDays > 0 && (
            <div className="sm:col-span-2 flex flex-wrap animate-in items-center gap-x-6 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3 fade-in-0 zoom-in-95">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Wallet weight="BoldDuotone" className="h-4 w-4 text-primary" />
                Total hari kerja:{" "}
                <span className="font-semibold">{calculatedDays} hari</span>
              </p>
              {availableDays !== null && (
                <p
                  className={`text-sm ${isInsufficientBalance ? "text-destructive font-medium" : "text-muted-foreground"}`}
                >
                  Saldo tersedia: {availableDays} hari
                  {isInsufficientBalance && " (tidak cukup)"}
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2 grid gap-2">
            <Label htmlFor="reason">Alasan (opsional)</Label>
            <Textarea
              id="reason"
              value={form.reason}
              onChange={(e) =>
                setForm((f) => ({ ...f, reason: e.target.value }))
              }
              placeholder="Tulis alasan cuti..."
              className="rounded-xl"
              rows={3}
            />
          </div>

          <div className="sm:col-span-2 grid gap-2">
            <Label htmlFor="evidence">Bukti *</Label>
            <div className="relative flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
                <Camera weight="BoldDuotone" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Klik untuk pilih foto bukti</p>
                <p className="text-xs text-muted-foreground">
                  Wajib lampirkan foto bukti (mis. surat, dokumen pendukung).
                </p>
              </div>
              <input
                id="evidence"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
            {form.photoName && (
              <div className="flex animate-in items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm fade-in-0 slide-in-from-top-1">
                <FileText weight="BoldDuotone" className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{form.photoName}</span>
                <button
                  type="button"
                  aria-label="Hapus foto"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => setForm((f) => ({ ...f, photoBase64: "", photoName: "" }))}
                >
                  <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>


          <div className="sm:col-span-2 flex justify-end border-t pt-5">
            <Button
              className="w-full rounded-xl shadow-sm transition-shadow hover:shadow-md sm:w-auto"
              onClick={handleSubmit}
              disabled={
                submitMutation.isPending ||
                isUploading ||
                !form.leaveTypeId ||
                !form.startDate ||
                !form.photoBase64 ||
                (isHolidayToken ? !form.publicHolidayId : !form.endDate) ||
                isInsufficientBalance
              }
            >
              {isUploading ? "Mengunggah..." : submitMutation.isPending ? "Mengirim..." : "Ajukan Cuti"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
