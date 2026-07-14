"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AddCircle, Pen } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer } from "@/components/shared/drawer";
import {
  useCreateEmployeeDevelopment,
  useUpdateEmployeeDevelopment,
} from "@/hooks/use-hr-development";
import type { EmployeeDevelopmentItem } from "@/lib/queries/hrDevelopment";

// ─── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type DevelopmentForm = {
  profileId: string;
  skill: string;
  level: string;
  startDate: string;
  targetCompletionDate: string;
  progressPercentage: string;
  notes: string;
};

const EMPTY_FORM: DevelopmentForm = {
  profileId: "",
  skill: "",
  level: "BEGINNER",
  startDate: "",
  targetCompletionDate: "",
  progressPercentage: "0",
  notes: "",
};

// ─── Helper ────────────────────────────────────────────────────────────────────

function toIsoDateString(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface EmployeeDevelopmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: EmployeeDevelopmentItem | null;
  employees: Array<{ id: string; fullName: string | null }>;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function EmployeeDevelopmentDrawer({
  isOpen,
  onClose,
  editItem,
  employees,
}: EmployeeDevelopmentDrawerProps) {
  const [form, setForm] = useState<DevelopmentForm>(EMPTY_FORM);

  const createDevelopmentMutation = useCreateEmployeeDevelopment();
  const updateDevelopmentMutation = useUpdateEmployeeDevelopment();

  const isPending =
    createDevelopmentMutation.isPending || updateDevelopmentMutation.isPending;

  // Populate or reset the form whenever the drawer opens or the edit target changes
  useEffect(() => {
    if (!isOpen) return;
    let t: number | undefined;

    if (editItem) {
      t = window.setTimeout(() => {
        setForm({
          profileId: editItem.profileId,
          skill: editItem.skill,
          level: editItem.level,
          startDate: toIsoDateString(editItem.startDate),
          targetCompletionDate: toIsoDateString(editItem.targetCompletionDate),
          progressPercentage: String(editItem.progressPercentage),
          notes: editItem.notes ?? "",
        });
      }, 0);
    } else {
      t = window.setTimeout(() => setForm(EMPTY_FORM), 0);
    }

    return () => {
      if (t) clearTimeout(t);
    };
  }, [isOpen, editItem]);

  async function handleSubmit() {
    if (!editItem && !form.profileId) {
      toast.error("Karyawan wajib dipilih");
      return;
    }
    if (!form.skill.trim()) {
      toast.error("Skill wajib diisi");
      return;
    }
    if (!form.startDate) {
      toast.error("Tanggal mulai wajib diisi");
      return;
    }

    if (editItem) {
      const payload = {
        skill: form.skill.trim(),
        level: form.level,
        startDate: form.startDate,
        targetCompletionDate: form.targetCompletionDate || undefined,
        progressPercentage: Number(form.progressPercentage) || 0,
        notes: form.notes.trim() || undefined,
      };
      const result = await updateDevelopmentMutation.mutateAsync({
        id: editItem.id,
        data: payload,
      });
      if (result.success) {
        toast.success("Pengembangan karyawan diperbarui");
        setForm(EMPTY_FORM);
        onClose();
        return;
      }
      toast.error(result.error ?? "Gagal memperbarui pengembangan");
      return;
    }

    const payload = {
      profileId: form.profileId,
      skill: form.skill.trim(),
      level: form.level,
      startDate: form.startDate,
      targetCompletionDate: form.targetCompletionDate || undefined,
      progressPercentage: Number(form.progressPercentage) || 0,
      notes: form.notes.trim() || undefined,
    };
    const result = await createDevelopmentMutation.mutateAsync(payload);
    if (result.success) {
      toast.success("Pengembangan karyawan ditambahkan");
      setForm(EMPTY_FORM);
      onClose();
      return;
    }
    toast.error(result.error ?? "Gagal menambah pengembangan");
  }

  const title = editItem ? "Edit Pengembangan" : "Tambah Pengembangan";

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm:max-w-lg">
      <div className="space-y-4">
        {/* Karyawan */}
        <div className="space-y-2">
          <Label htmlFor="drawer-dev-profile">Karyawan</Label>
          <select
            id="drawer-dev-profile"
            value={form.profileId}
            onChange={(event) =>
              setForm((current) => ({ ...current, profileId: event.target.value }))
            }
            disabled={!!editItem}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none disabled:opacity-60"
          >
            <option value="">Pilih karyawan</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Skill */}
        <div className="space-y-2">
          <Label htmlFor="drawer-dev-skill">Skill</Label>
          <Input
            id="drawer-dev-skill"
            value={form.skill}
            onChange={(event) =>
              setForm((current) => ({ ...current, skill: event.target.value }))
            }
            placeholder="Misal: Public Speaking"
          />
        </div>

        {/* Level */}
        <div className="space-y-2">
          <Label htmlFor="drawer-dev-level">Level</Label>
          <select
            id="drawer-dev-level"
            value={form.level}
            onChange={(event) =>
              setForm((current) => ({ ...current, level: event.target.value }))
            }
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none disabled:opacity-60"
          >
            {Object.entries(LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Tanggal Mulai / Target Selesai */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="drawer-dev-start">Tanggal Mulai</Label>
            <Input
              id="drawer-dev-start"
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-dev-target">Target Selesai</Label>
            <Input
              id="drawer-dev-target"
              type="date"
              value={form.targetCompletionDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetCompletionDate: event.target.value,
                }))
              }
            />
          </div>
        </div>

        {/* Progres % */}
        <div className="space-y-2">
          <Label htmlFor="drawer-dev-progress">Progres (%)</Label>
          <Input
            id="drawer-dev-progress"
            type="number"
            min="0"
            max="100"
            value={form.progressPercentage}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                progressPercentage: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>

        {/* Catatan */}
        <div className="space-y-2">
          <Label htmlFor="drawer-dev-notes">Catatan</Label>
          <Textarea
            id="drawer-dev-notes"
            rows={3}
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="Catatan tambahan"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-full gap-2"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {editItem ? (
              <Pen weight="BoldDuotone" className="h-4 w-4" />
            ) : (
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            )}
            {editItem ? "Simpan perubahan" : "Tambah pengembangan"}
          </Button>
          {editItem && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onClose}
              disabled={isPending}
            >
              Batal
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
