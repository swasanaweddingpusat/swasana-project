"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AddCircle } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import {
  useCreateEmployeeCertification,
  useUpdateEmployeeCertification,
} from "@/hooks/use-hr-development";
import type { EmployeeCertificationItem } from "@/lib/queries/hrDevelopment";

type CertificationForm = {
  profileId: string;
  certificationName: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: CertificationForm = {
  profileId: "",
  certificationName: "",
  issueDate: "",
  expiryDate: "",
  status: "ACTIVE",
  notes: "",
};

const CERT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  PENDING: "Menunggu",
  EXPIRED: "Kedaluwarsa",
};

function toIsoDateString(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

interface CertificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: EmployeeCertificationItem | null;
  employees: Array<{ id: string; fullName: string | null }>;
}

export function CertificationDrawer({
  isOpen,
  onClose,
  editItem,
  employees,
}: CertificationDrawerProps) {
  const [form, setForm] = useState<CertificationForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CertificationForm, string>>>({});

  const createCertificationMutation = useCreateEmployeeCertification();
  const updateCertificationMutation = useUpdateEmployeeCertification();

  const isEditing = Boolean(editItem);
  const isPending =
    createCertificationMutation.isPending || updateCertificationMutation.isPending;

  useEffect(() => {
    if (isOpen && editItem) {
      setForm({
        profileId: editItem.profileId,
        certificationName: editItem.certificationName,
        issueDate: toIsoDateString(editItem.issueDate),
        expiryDate: toIsoDateString(editItem.expiryDate),
        status: editItem.status,
        notes: editItem.notes ?? "",
      });
    } else if (isOpen && !editItem) {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [isOpen, editItem]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof CertificationForm]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof CertificationForm, string>> = {};
    if (!isEditing && !form.profileId) {
      next.profileId = "Karyawan wajib dipilih";
    }
    if (!form.certificationName.trim()) {
      next.certificationName = "Nama sertifikasi wajib diisi";
    }
    if (!form.issueDate) {
      next.issueDate = "Tanggal terbit wajib diisi";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && editItem) {
      const payload = {
        certificationName: form.certificationName.trim(),
        issueDate: form.issueDate,
        expiryDate: form.expiryDate || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      const result = await updateCertificationMutation.mutateAsync({
        id: editItem.id,
        data: payload,
      });
      if (result.success) {
        toast.success("Sertifikasi berhasil diperbarui");
        setForm(EMPTY_FORM);
        onClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui sertifikasi");
      }
    } else {
      const payload = {
        profileId: form.profileId,
        certificationName: form.certificationName.trim(),
        issueDate: form.issueDate,
        expiryDate: form.expiryDate || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      const result = await createCertificationMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Sertifikasi berhasil ditambahkan");
        setForm(EMPTY_FORM);
        onClose();
      } else {
        toast.error(result.error ?? "Gagal menambahkan sertifikasi");
      }
    }
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setErrors({});
    onClose();
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? "Edit Sertifikasi" : "Tambah Sertifikasi"}
      maxWidth="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pb-4">
        {/* Karyawan */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Karyawan <span className="text-destructive">*</span>
          </label>
          <select
            name="profileId"
            value={form.profileId}
            onChange={handleChange}
            disabled={isEditing}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none disabled:opacity-60"
          >
            <option value="">Pilih karyawan</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName ?? emp.id}
              </option>
            ))}
          </select>
          {errors.profileId && (
            <p className="text-xs text-destructive">{errors.profileId}</p>
          )}
        </div>

        {/* Nama Sertifikasi */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Nama Sertifikasi <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            name="certificationName"
            value={form.certificationName}
            onChange={handleChange}
            placeholder="Contoh: AWS Certified Solutions Architect"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          {errors.certificationName && (
            <p className="text-xs text-destructive">{errors.certificationName}</p>
          )}
        </div>

        {/* Tanggal Terbit / Tanggal Kedaluwarsa */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Tanggal Terbit <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              name="issueDate"
              value={form.issueDate}
              onChange={handleChange}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.issueDate && (
              <p className="text-xs text-destructive">{errors.issueDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Tanggal Kedaluwarsa
            </label>
            <input
              type="date"
              name="expiryDate"
              value={form.expiryDate}
              onChange={handleChange}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none disabled:opacity-60"
          >
            {Object.entries(CERT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Catatan */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Catatan</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Catatan tambahan (opsional)"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            {isPending
              ? isEditing
                ? "Menyimpan..."
                : "Menambahkan..."
              : isEditing
              ? "Simpan Perubahan"
              : "Tambah Sertifikasi"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="rounded-full border border-input px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Batal
            </button>
          )}
        </div>
      </form>
    </Drawer>
  );
}
