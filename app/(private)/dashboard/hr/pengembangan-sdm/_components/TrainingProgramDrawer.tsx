"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AddCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer } from "@/components/shared/drawer";
import {
  useCreateTrainingProgram,
  useUpdateTrainingProgram,
} from "@/hooks/use-hr-development";
import type { TrainingProgramItem } from "@/lib/queries/hrDevelopment";

type TrainingForm = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  participantsCount: string;
  completionPercentage: string;
};

const EMPTY_FORM: TrainingForm = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  status: "SCHEDULED",
  participantsCount: "0",
  completionPercentage: "0",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Terjadwal",
  ONGOING: "Berlangsung",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

function toIsoDateString(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

interface TrainingProgramDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: TrainingProgramItem | null;
}

export function TrainingProgramDrawer({
  isOpen,
  onClose,
  editItem,
}: TrainingProgramDrawerProps) {
  const [form, setForm] = useState<TrainingForm>(EMPTY_FORM);
  const createTrainingMutation = useCreateTrainingProgram();
  const updateTrainingMutation = useUpdateTrainingProgram();

  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setForm({
          name: editItem.name,
          description: editItem.description ?? "",
          startDate: toIsoDateString(editItem.startDate),
          endDate: toIsoDateString(editItem.endDate),
          status: editItem.status,
          participantsCount: String(editItem.participantsCount ?? 0),
          completionPercentage: String(editItem.completionPercentage ?? 0),
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, editItem]);

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Nama program wajib diisi");
      return;
    }
    if (!form.startDate) {
      toast.error("Tanggal mulai wajib diisi");
      return;
    }
    if (!form.endDate) {
      toast.error("Tanggal selesai wajib diisi");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      participantsCount: Number(form.participantsCount) || 0,
      completionPercentage: Number(form.completionPercentage) || 0,
    };

    if (editItem) {
      const result = await updateTrainingMutation.mutateAsync({
        id: editItem.id,
        data: payload,
      });
      if (result.success) {
        toast.success("Program berhasil diperbarui");
        setForm(EMPTY_FORM);
        onClose();
        return;
      }
      toast.error(result.error ?? "Gagal memperbarui program");
    } else {
      const result = await createTrainingMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Program berhasil dibuat");
        setForm(EMPTY_FORM);
        onClose();
        return;
      }
      toast.error(result.error ?? "Gagal membuat program");
    }
  }

  const isPending =
    createTrainingMutation.isPending || updateTrainingMutation.isPending;
  const title = editItem ? "Edit Program" : "Tambah Program";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm:max-w-lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-training-name">Nama Program</Label>
          <Input
            id="drawer-training-name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Misal: Pelatihan Leadership"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="drawer-training-start-date">Tanggal Mulai</Label>
            <Input
              id="drawer-training-start-date"
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-training-end-date">Tanggal Selesai</Label>
            <Input
              id="drawer-training-end-date"
              type="date"
              value={form.endDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer-training-status">Status</Label>
          <select
            id="drawer-training-status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({ ...current, status: event.target.value }))
            }
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="drawer-training-participants">Jumlah Peserta</Label>
            <Input
              id="drawer-training-participants"
              type="number"
              min={0}
              value={form.participantsCount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  participantsCount: event.target.value,
                }))
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-training-progress">Progres %</Label>
            <Input
              id="drawer-training-progress"
              type="number"
              min={0}
              max={100}
              value={form.completionPercentage}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  completionPercentage: event.target.value,
                }))
              }
              placeholder="0"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer-training-description">Deskripsi</Label>
          <Textarea
            id="drawer-training-description"
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Tujuan dan materi pelatihan"
          />
        </div>

        <Button
          className="w-full rounded-full gap-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          {editItem ? "Simpan Perubahan" : "Tambah Program"}
        </Button>

        {editItem && (
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={onClose}
            disabled={isPending}
          >
            Batal
          </Button>
        )}
      </div>
    </Drawer>
  );
}
