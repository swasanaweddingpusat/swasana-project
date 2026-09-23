"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitAttendanceCorrection } from "@/hooks/use-attendance-corrections";
import { ClockSquare } from "@solar-icons/react";

interface FormState {
  date: string;
  clockInTime: string;
  clockOutTime: string;
  reason: string;
  evidenceBase64: string;
  evidenceName: string;
}

interface AttendanceCorrectionFormProps {
  inDialog?: boolean;
  onSubmitted?: () => void;
}

const EMPTY_FORM: FormState = {
  date: "",
  clockInTime: "",
  clockOutTime: "",
  reason: "",
  evidenceBase64: "",
  evidenceName: "",
};

function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AttendanceCorrectionForm({ inDialog = false, onSubmitted }: AttendanceCorrectionFormProps) {
  const submitMutation = useSubmitAttendanceCorrection();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const maxDate = useMemo(() => todayInputValue(), []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bukti harus berupa gambar");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, evidenceBase64: reader.result as string, evidenceName: file.name }));
    };
    reader.onerror = () => toast.error("Gagal membaca file");
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.date) {
      toast.error("Tanggal wajib diisi");
      return;
    }
    if (form.date > maxDate) {
      toast.error("Tidak bisa mengajukan koreksi untuk tanggal di masa depan");
      return;
    }
    if (!form.clockInTime && !form.clockOutTime) {
      toast.error("Isi minimal salah satu koreksi clock-in atau clock-out");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("Alasan koreksi wajib diisi");
      return;
    }

    const requestedClockInAt = form.clockInTime
      ? new Date(`${form.date}T${form.clockInTime}`).toISOString()
      : undefined;
    const requestedClockOutAt = form.clockOutTime
      ? new Date(`${form.date}T${form.clockOutTime}`).toISOString()
      : undefined;

    submitMutation.mutate(
      {
        date: form.date,
        requestedClockInAt,
        requestedClockOutAt,
        reason: form.reason,
        evidenceBase64: form.evidenceBase64 || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Pengajuan koreksi absen berhasil dikirim");
            setForm(EMPTY_FORM);
            onSubmitted?.();
          } else {
            toast.error(result.error ?? "Gagal mengajukan koreksi absen");
          }
        },
        onError: () => {
          toast.error("Terjadi kesalahan");
        },
      }
    );
  }, [form, maxDate, onSubmitted, submitMutation]);

  return (
    <Card className={inDialog ? "border-0 shadow-none" : "rounded-2xl shadow-sm"}>
      {!inDialog && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClockSquare weight="BoldDuotone" className="h-5 w-5" />
            </span>
            <span>Ajukan Koreksi Absen</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Lupa clock-in/out? Ajukan koreksi untuk tanggal tersebut.
          </p>
        </CardHeader>
      )}
      <CardContent className={inDialog ? "px-6 pb-6 pt-5 sm:px-7 sm:pb-7" : undefined}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="correction-date">Tanggal *</Label>
            <Input
              id="correction-date"
              type="date"
              max={maxDate}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="correction-clock-in">Clock In yang Benar</Label>
            <Input
              id="correction-clock-in"
              type="time"
              value={form.clockInTime}
              onChange={(e) => setForm((f) => ({ ...f, clockInTime: e.target.value }))}
              className="rounded-xl"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="correction-clock-out">Clock Out yang Benar</Label>
            <Input
              id="correction-clock-out"
              type="time"
              value={form.clockOutTime}
              onChange={(e) => setForm((f) => ({ ...f, clockOutTime: e.target.value }))}
              className="rounded-xl"
            />
          </div>

          <p className="sm:col-span-2 -mt-2 text-xs text-muted-foreground">
            Isi minimal salah satu: clock-in atau clock-out.
          </p>

          <div className="sm:col-span-2 grid gap-2">
            <Label htmlFor="correction-reason">Alasan *</Label>
            <Textarea
              id="correction-reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Tulis alasan koreksi absen..."
              className="rounded-xl"
              rows={3}
            />
          </div>

          <div className="sm:col-span-2 grid gap-2">
            <Label htmlFor="correction-evidence">Bukti (opsional)</Label>
            <Input
              id="correction-evidence"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="rounded-xl"
            />
            {form.evidenceName ? (
              <p className="text-xs text-muted-foreground truncate">Terpilih: {form.evidenceName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Lampirkan foto pendukung bila ada (mis. screenshot lokasi/aktivitas).
              </p>
            )}
          </div>

          <div className="sm:col-span-2 flex justify-end border-t pt-5">
            <Button
              className="w-full rounded-xl sm:w-auto"
              onClick={handleSubmit}
              disabled={
                submitMutation.isPending ||
                !form.date ||
                !form.reason.trim() ||
                (!form.clockInTime && !form.clockOutTime)
              }
            >
              {submitMutation.isPending ? "Mengirim..." : "Ajukan Koreksi"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
