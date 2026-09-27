"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useWorkShifts } from "@/hooks/use-work-shifts";
import { useWorkLocations } from "@/hooks/use-work-locations";
import { useSubmitAttendanceCorrection } from "@/hooks/use-attendance-corrections";
import type { AttendanceCorrectionTypeValue } from "@/lib/validations/attendanceCorrection";
import { GalleryEdit } from "@solar-icons/react";

interface FormState {
  date: string;
  type: AttendanceCorrectionTypeValue | "";
  clockInTime: string;
  clockOutTime: string;
  workShiftId: string;
  workType: "WFO" | "WFH" | "WFA" | "";
  workLocationId: string;
  reason: string;
  photoBase64: string;
  photoName: string;
}

const EMPTY_FORM: FormState = {
  date: "",
  type: "",
  clockInTime: "",
  clockOutTime: "",
  workShiftId: "",
  workType: "",
  workLocationId: "",
  reason: "",
  photoBase64: "",
  photoName: "",
};

const TYPE_OPTIONS: { value: AttendanceCorrectionTypeValue; label: string }[] = [
  { value: "CLOCK_IN", label: "Clock In Saja" },
  { value: "CLOCK_OUT", label: "Clock Out Saja" },
  { value: "BOTH", label: "Clock In & Clock Out" },
];

const WORK_TYPE_OPTIONS: { value: "WFO" | "WFH" | "WFA"; label: string }[] = [
  { value: "WFO", label: "Kerja dari Kantor (WFO)" },
  { value: "WFH", label: "Kerja dari Rumah (WFH)" },
  { value: "WFA", label: "Kerja dari Mana Saja (WFA)" },
];

function todayDateInputValue(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function AttendanceCorrectionDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: workShifts } = useWorkShifts();
  const { data: workLocations } = useWorkLocations();
  const submitMutation = useSubmitAttendanceCorrection();

  const needsClockIn = form.type === "CLOCK_IN" || form.type === "BOTH";
  const needsClockOut = form.type === "CLOCK_OUT" || form.type === "BOTH";

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetForm();
    },
    [resetForm],
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Bukti harus berupa file gambar");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, photoBase64: reader.result as string, photoName: file.name }));
    };
    reader.onerror = () => toast.error("Gagal membaca file");
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.date) {
      toast.error("Tanggal wajib diisi");
      return;
    }
    if (!form.type) {
      toast.error("Jenis koreksi wajib dipilih");
      return;
    }
    if (needsClockIn) {
      if (!form.clockInTime) {
        toast.error("Jam clock-in wajib diisi");
        return;
      }
      if (!form.workShiftId) {
        toast.error("Shift wajib dipilih");
        return;
      }
      if (!form.workType) {
        toast.error("Tipe kerja wajib dipilih");
        return;
      }
      if (form.workType === "WFO" && !form.workLocationId) {
        toast.error("Lokasi kerja wajib dipilih");
        return;
      }
    }
    if (needsClockOut && !form.clockOutTime) {
      toast.error("Jam clock-out wajib diisi");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("Alasan wajib diisi");
      return;
    }
    if (!form.photoBase64) {
      toast.error("Bukti foto wajib diupload");
      return;
    }

    const requestedClockInAt = needsClockIn
      ? new Date(`${form.date}T${form.clockInTime}:00`).toISOString()
      : undefined;
    const requestedClockOutAt = needsClockOut
      ? new Date(`${form.date}T${form.clockOutTime}:00`).toISOString()
      : undefined;

    submitMutation.mutate(
      {
        date: form.date,
        type: form.type,
        requestedClockInAt,
        requestedClockOutAt,
        workShiftId: needsClockIn ? form.workShiftId : undefined,
        workLocationId: needsClockIn && form.workType === "WFO" ? form.workLocationId : undefined,
        workType: needsClockIn ? form.workType : undefined,
        reason: form.reason,
        photoBase64: form.photoBase64,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Pengajuan koreksi absen berhasil dikirim");
            handleOpenChange(false);
          } else {
            toast.error(result.error ?? "Gagal mengajukan koreksi absen");
          }
        },
        onError: () => toast.error("Terjadi kesalahan, coba lagi"),
      },
    );
  }, [form, needsClockIn, needsClockOut, submitMutation, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" className="rounded-full">
            <GalleryEdit weight="BoldDuotone" className="h-4 w-4" />
            Koreksi Absen
          </Button>
        }
      />
      <DialogContent className="rounded-2xl sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Ajukan Koreksi Absen</DialogTitle>
          <DialogDescription>
            Untuk absen yang lupa atau salah tercatat. Pengajuan butuh persetujuan HRD.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="correction-date">Tanggal *</Label>
              <Input
                id="correction-date"
                type="date"
                value={form.date}
                max={todayDateInputValue()}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="correction-type">Jenis Koreksi *</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as AttendanceCorrectionTypeValue }))
                }
              >
                <SelectTrigger id="correction-type" className="rounded-xl w-full">
                  <SelectValue placeholder="Pilih jenis" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsClockIn && (
            <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Koreksi Clock In</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="clock-in-time">Jam Masuk *</Label>
                  <Input
                    id="clock-in-time"
                    type="time"
                    value={form.clockInTime}
                    onChange={(e) => setForm((f) => ({ ...f, clockInTime: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="correction-shift">Shift *</Label>
                  <Select
                    value={form.workShiftId}
                    onValueChange={(v) => setForm((f) => ({ ...f, workShiftId: v }))}
                  >
                    <SelectTrigger id="correction-shift" className="rounded-xl w-full">
                      <SelectValue placeholder="Pilih shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {workShifts?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.startTime}-{s.endTime})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="correction-worktype">Tipe Kerja *</Label>
                  <Select
                    value={form.workType}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        workType: v as "WFO" | "WFH" | "WFA",
                        workLocationId: v === "WFO" ? f.workLocationId : "",
                      }))
                    }
                  >
                    <SelectTrigger id="correction-worktype" className="rounded-xl w-full">
                      <SelectValue placeholder="Pilih tipe kerja" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.workType === "WFO" && (
                  <div className="grid gap-2">
                    <Label htmlFor="correction-location">Lokasi Kerja *</Label>
                    <Select
                      value={form.workLocationId}
                      onValueChange={(v) => setForm((f) => ({ ...f, workLocationId: v }))}
                    >
                      <SelectTrigger id="correction-location" className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih lokasi" />
                      </SelectTrigger>
                      <SelectContent>
                        {workLocations?.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {needsClockOut && (
            <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Koreksi Clock Out</p>
              <div className="grid gap-2 sm:max-w-48">
                <Label htmlFor="clock-out-time">Jam Keluar *</Label>
                <Input
                  id="clock-out-time"
                  type="time"
                  value={form.clockOutTime}
                  onChange={(e) => setForm((f) => ({ ...f, clockOutTime: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="correction-reason">Alasan *</Label>
            <Textarea
              id="correction-reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Jelaskan kenapa lupa atau salah absen..."
              className="rounded-xl"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="correction-evidence">Bukti Foto *</Label>
            <Input
              ref={fileInputRef}
              id="correction-evidence"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="rounded-xl"
            />
            {form.photoName ? (
              <p className="text-xs text-muted-foreground truncate">Terpilih: {form.photoName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Wajib lampirkan foto bukti pendukung.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => handleOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Batal
          </Button>
          <Button className="rounded-full" onClick={handleSubmit} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Mengirim..." : "Ajukan Koreksi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
