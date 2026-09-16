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
import { countWeekdays, getAvailableBalance } from "@/lib/leave-helpers";
import { uploadFileDirect } from "@/lib/upload-client";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/validations/upload";
import { DocumentText } from "@solar-icons/react";

interface FormState {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
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

  const calculatedDays = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start > end) return 0;
    return countWeekdays(start, end);
  }, [form.startDate, form.endDate]);

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

  const handleSubmit = useCallback(async () => {
    if (!form.leaveTypeId) {
      toast.error("Pilih jenis cuti terlebih dahulu");
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error("Tanggal mulai dan selesai wajib diisi");
      return;
    }
    if (calculatedDays === 0) {
      toast.error("Periode cuti tidak mengandung hari kerja");
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
        endDate: form.endDate,
        reason: form.reason || undefined,
        documentKey,
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
  }, [form, calculatedDays, onSubmitted, selectedFile, submitMutation]);

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
                setForm((f) => ({ ...f, leaveTypeId: v }))
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

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="leave-document">Surat Cuti (opsional)</Label>
            <Input
              ref={fileInputRef}
              id="leave-document"
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              className="h-auto rounded-xl py-2.5"
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
            <p className="text-xs text-muted-foreground">
              PDF, Word, atau gambar. Maksimal 10MB.
            </p>
          </div>

          {calculatedDays > 0 && (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
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

          <div className="sm:col-span-2 flex justify-end border-t pt-5">
            <Button
              className="w-full rounded-xl sm:w-auto"
              onClick={handleSubmit}
              disabled={
                submitMutation.isPending ||
                isUploading ||
                !form.leaveTypeId ||
                !form.startDate ||
                !form.endDate ||
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
