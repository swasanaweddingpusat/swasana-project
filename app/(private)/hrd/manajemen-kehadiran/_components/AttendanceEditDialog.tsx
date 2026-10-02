"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateAttendanceRecord } from "@/hooks/use-attendance";
import { useWorkLocations } from "@/hooks/use-work-locations";
import { useWorkShifts } from "@/hooks/use-work-shifts";
import type { AttendanceListItem } from "@/lib/queries/attendance";

interface AttendanceEditDialogProps {
  record: AttendanceListItem | null;
  onClose: () => void;
}

function toDatetimeLocalValue(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AttendanceEditDialog({ record, onClose }: AttendanceEditDialogProps) {
  const updateMutation = useUpdateAttendanceRecord();
  const { data: locations } = useWorkLocations();
  const { data: shifts } = useWorkShifts();

  const [clockInAt, setClockInAt] = useState(() => toDatetimeLocalValue(record?.clockInAt ?? null));
  const [clockOutAt, setClockOutAt] = useState(() => toDatetimeLocalValue(record?.clockOutAt ?? null));
  const [status, setStatus] = useState<string>(() => record?.status ?? "on_time");
  const [attendantType, setAttendantType] = useState<string>(() => record?.attendantType ?? "WORKDAY");
  const [workLocationId, setWorkLocationId] = useState<string>(() => record?.workLocation?.id ?? "");
  const [workShiftId, setWorkShiftId] = useState<string>(() => record?.workShift?.id ?? "");
  const [workType, setWorkType] = useState<string>(() => record?.workType ?? "");

  if (!record) return null;

  function handleSubmit() {
    if (!record) return;
    updateMutation.mutate(
      {
        id: record.id,
        data: {
          clockInAt: clockInAt ? new Date(clockInAt).toISOString() : null,
          clockOutAt: clockOutAt ? new Date(clockOutAt).toISOString() : null,
          status: status as "on_time" | "late" | "absent",
          attendantType: attendantType as "WORKDAY" | "DAY_OFF",
          workLocationId: workLocationId || null,
          workShiftId: workShiftId || null,
          workType: (workType || null) as "WFO" | "WFH" | "WFA" | null,
        },
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Data kehadiran berhasil diperbarui");
            onClose();
          } else {
            toast.error(result.error ?? "Gagal memperbarui data kehadiran");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      }
    );
  }

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Edit Kehadiran</DialogTitle>
          <DialogDescription>
            Perbarui data kehadiran {record.profile.fullName ?? "-"} pada tanggal{" "}
            {new Date(record.date).toLocaleDateString("id-ID")}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-clock-in">Clock In</Label>
              <Input
                id="edit-clock-in"
                type="datetime-local"
                value={clockInAt}
                onChange={(e) => setClockInAt(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-clock-out">Clock Out</Label>
              <Input
                id="edit-clock-out"
                type="datetime-local"
                value={clockOutAt}
                onChange={(e) => setClockOutAt(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_time">Hadir</SelectItem>
                <SelectItem value="late">Terlambat</SelectItem>
                <SelectItem value="absent">Absen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Tipe Hari</Label>
            <Select value={attendantType} onValueChange={setAttendantType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih tipe hari" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WORKDAY">Work Day</SelectItem>
                <SelectItem value="DAY_OFF">Day Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Tipe Kerja</Label>
            <Select value={workType || "none"} onValueChange={(v) => setWorkType(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih tipe kerja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                <SelectItem value="WFO">WFO</SelectItem>
                <SelectItem value="WFH">WFH</SelectItem>
                <SelectItem value="WFA">WFA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Lokasi Kerja</Label>
            <Select value={workLocationId || "none"} onValueChange={(v) => setWorkLocationId(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {(locations ?? []).map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Shift</Label>
            <Select value={workShiftId || "none"} onValueChange={(v) => setWorkShiftId(v === "none" ? "" : v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Pilih shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ada</SelectItem>
                {(shifts ?? []).map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>{shift.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={updateMutation.isPending}>
            Batal
          </Button>
          <Button className="rounded-full" onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
