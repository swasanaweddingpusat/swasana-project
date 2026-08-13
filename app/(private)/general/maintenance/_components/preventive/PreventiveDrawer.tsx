"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloseCircle, UploadMinimalistic } from "@solar-icons/react";
import { useVenues } from "@/hooks/use-venues";
import { useMaintenanceCategories } from "@/hooks/useMaintenanceCategories";
import { useMaintenancePriorities } from "@/hooks/useMaintenancePriorities";
import { useMaintenanceStatuses } from "@/hooks/useMaintenanceStatuses";
import { useCreateMaintenance, useUpdateMaintenance, useInvalidateMaintenance } from "@/hooks/useMaintenance";
import { useUsers } from "@/hooks/use-users";
import type { MaintenanceTicketItem } from "@/lib/queries/maintenance";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function uploadMaintenanceImage(ticketId: string, file: File): Promise<{ id: string; url: string; fileName: string }> {
  const fd = new FormData();
  fd.set("ticketId", ticketId);
  fd.set("file", file);
  const res = await fetch("/api/maintenance/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal upload gambar");
  }
  return res.json() as Promise<{ id: string; url: string; fileName: string }>;
}

async function deleteMaintenanceImage(imageId: string): Promise<void> {
  const res = await fetch(`/api/maintenance/upload?imageId=${imageId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal menghapus gambar");
  }
}

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
  { value: "quarterly", label: "Triwulan" },
  { value: "yearly", label: "Tahunan" },
] as const;

interface PreventiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem: MaintenanceTicketItem | null;
  onSuccess: () => void;
}

interface FormState {
  venueId: string;
  statusId: string;
  priorityId: string;
  categoryId: string;
  assignedToId: string;
  isVendor: boolean;
  isAudit: boolean;
  description: string;
  frequency: string;
  nextDueDate: string;
}

const DEFAULT_FORM: FormState = {
  venueId: "",
  statusId: "",
  priorityId: "",
  categoryId: "",
  assignedToId: "",
  isVendor: false,
  isAudit: false,
  description: "",
  frequency: "",
  nextDueDate: "",
};

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function PreventiveDrawer({
  open,
  onOpenChange,
  editItem,
  onSuccess,
}: PreventiveDrawerProps) {
  const isEdit = !!editItem;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: string; url: string; fileName: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: venues = [] } = useVenues();
  const { data: statuses = [] } = useMaintenanceStatuses();
  const { data: priorities = [] } = useMaintenancePriorities();
  const { data: categories = [] } = useMaintenanceCategories();
  const { data: usersData } = useUsers(undefined, { limit: 200 });
  const users = usersData?.users ?? [];

  const { mutateAsync: createMutation, isPending: isCreating } = useCreateMaintenance();
  const { mutateAsync: updateMutation, isPending: isUpdating } = useUpdateMaintenance();
  const invalidateMaintenance = useInvalidateMaintenance();
  const isPending = isCreating || isUpdating || isUploading;

  const resetKey = open ? (editItem?.id ?? "__new__") : "";
  const [prevResetKey, setPrevResetKey] = useState("");
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setSelectedFiles([]);
      if (editItem) {
        setForm({
          venueId: editItem.venue.id,
          statusId: editItem.status.id,
          priorityId: editItem.priority.id,
          categoryId: editItem.category.id,
          assignedToId: editItem.assignedTo?.id ?? "",
          isVendor: editItem.isVendor,
          isAudit: editItem.isAudit,
          description: editItem.description,
          frequency: editItem.frequency ?? "",
          nextDueDate: toDateInputValue(editItem.nextDueDate),
        });
        setExistingImages(editItem.images.map((img: { id: string; url: string; fileName: string }) => ({ id: img.id, url: img.url, fileName: img.fileName })));
      } else {
        setForm(DEFAULT_FORM);
        setExistingImages([]);
      }
    }
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    for (const f of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
        toast.error(`${f.name}: Tipe file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF.`);
        continue;
      }
      if (f.size > MAX_IMAGE_SIZE) {
        toast.error(`${f.name}: Ukuran file maksimal 5MB.`);
        continue;
      }
      valid.push(f);
    }
    setSelectedFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleRemoveExistingImage(imageId: string) {
    try {
      await deleteMaintenanceImage(imageId);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
      toast.success("Foto berhasil dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus foto.");
    }
  }

  async function handleSubmit() {
    if (!form.venueId || !form.statusId || !form.priorityId || !form.categoryId) {
      toast.error("Venue, Status, Prioritas, dan Kategori wajib dipilih.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Deskripsi wajib diisi.");
      return;
    }
    if (!form.frequency) {
      toast.error("Frekuensi wajib dipilih.");
      return;
    }
    if (!form.nextDueDate) {
      toast.error("Tanggal jatuh tempo wajib diisi.");
      return;
    }

    const payload = {
      type: "PREVENTIVE" as const,
      venueId: form.venueId,
      statusId: form.statusId,
      priorityId: form.priorityId,
      categoryId: form.categoryId,
      assignedToId: form.assignedToId || null,
      isVendor: form.isVendor,
      isAudit: form.isAudit,
      description: form.description.trim(),
      frequency: form.frequency,
      nextDueDate: form.nextDueDate,
    };

    try {
      let ticketId: string;
      if (isEdit && editItem) {
        await updateMutation({ id: editItem.id, ...payload });
        ticketId = editItem.id;
        toast.success("Jadwal preventive berhasil diperbarui.");
      } else {
        const created = await createMutation(payload);
        ticketId = created.id;
        toast.success("Jadwal preventive berhasil dibuat.");
      }

      if (selectedFiles.length > 0) {
        setIsUploading(true);
        let uploadedCount = 0;
        for (const file of selectedFiles) {
          try {
            await uploadMaintenanceImage(ticketId, file);
            uploadedCount++;
          } catch {
            toast.error(`Gagal upload: ${file.name}`);
          }
        }
        if (uploadedCount > 0) {
          toast.success(`${uploadedCount} foto berhasil diupload.`);
        }
        setIsUploading(false);
      }

      await invalidateMaintenance();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan jadwal preventive.");
    }
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Jadwal Preventive" : "Tambah Jadwal Preventive"}
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Venue */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-venue">Venue *</Label>
            <Select value={form.venueId} onValueChange={(v) => set("venueId", v)}>
              <SelectTrigger id="prev-drawer-venue" className="w-full">
                <SelectValue placeholder="Pilih venue..." />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-status">Status *</Label>
            <Select value={form.statusId} onValueChange={(v) => set("statusId", v)}>
              <SelectTrigger id="prev-drawer-status" className="w-full">
                <SelectValue placeholder="Pilih status..." />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-priority">Prioritas *</Label>
            <Select value={form.priorityId} onValueChange={(v) => set("priorityId", v)}>
              <SelectTrigger id="prev-drawer-priority" className="w-full">
                <SelectValue placeholder="Pilih prioritas..." />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.name}
                      <span className="text-xs text-muted-foreground">
                        ({p.deadlineDays} hari)
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-category">Kategori *</Label>
            <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger id="prev-drawer-category" className="w-full">
                <SelectValue placeholder="Pilih kategori..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-frequency">Frekuensi *</Label>
            <Select value={form.frequency || "none"} onValueChange={(v) => set("frequency", v === "none" ? "" : v)}>
              <SelectTrigger id="prev-drawer-frequency" className="w-full">
                <SelectValue placeholder="Pilih frekuensi..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Pilih frekuensi...</SelectItem>
                {FREQUENCY_OPTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Next Due Date */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-due-date">Tanggal Jatuh Tempo *</Label>
            <Input
              id="prev-drawer-due-date"
              type="date"
              value={form.nextDueDate}
              onChange={(e) => set("nextDueDate", e.target.value)}
              className="w-full"
            />
          </div>

          {/* Assigned To */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-assigned">Assign To</Label>
            <Select
              value={form.assignedToId || "none"}
              onValueChange={(v) => set("assignedToId", v === "none" ? "" : v)}
            >
              <SelectTrigger id="prev-drawer-assigned" className="w-full">
                <SelectValue placeholder="Tidak di-assign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak di-assign</SelectItem>
                {users.flatMap((u) =>
                  u.profile
                    ? [
                        <SelectItem key={u.profile.id} value={u.profile.id}>
                          {u.profile.fullName ?? u.name}
                        </SelectItem>,
                      ]
                    : []
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="prev-drawer-vendor"
                checked={form.isVendor}
                onCheckedChange={(checked) => set("isVendor", checked === true)}
              />
              <Label htmlFor="prev-drawer-vendor" className="cursor-pointer">
                Vendor
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="prev-drawer-audit"
                checked={form.isAudit}
                onCheckedChange={(checked) => set("isAudit", checked === true)}
              />
              <Label htmlFor="prev-drawer-audit" className="cursor-pointer">
                Audit
              </Label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="prev-drawer-description">Deskripsi *</Label>
            <Textarea
              id="prev-drawer-description"
              rows={4}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Deskripsi pekerjaan preventive maintenance..."
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label>Foto</Label>

            {existingImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {existingImages.map((img) => (
                  <div key={img.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.fileName}
                      className="h-16 w-16 rounded-lg object-cover border"
                    />
                    <button
                      type="button"
                      onClick={() => { void handleRemoveExistingImage(img.id); }}
                      className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <CloseCircle weight="Bold" className="h-5 w-5 text-destructive bg-background rounded-full" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-16 w-16 rounded-lg object-cover border border-dashed border-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(idx)}
                      className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <CloseCircle weight="Bold" className="h-5 w-5 text-destructive bg-background rounded-full" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 p-4 transition-colors cursor-pointer"
            >
              <UploadMinimalistic weight="BoldDuotone" className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Klik untuk pilih foto (JPEG, PNG, WebP, GIF — maks 5MB)
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-background pt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              onClick={() => { void handleSubmit(); }}
              className="flex-1"
              disabled={isPending}
            >
              {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
