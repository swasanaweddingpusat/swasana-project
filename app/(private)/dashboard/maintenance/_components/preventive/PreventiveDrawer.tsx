"use client";

import { useEffect, useState } from "react";
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
import { useVenues } from "@/hooks/use-venues";
import { useMaintenanceCategories } from "@/hooks/useMaintenanceCategories";
import { useMaintenancePriorities } from "@/hooks/useMaintenancePriorities";
import { useMaintenanceStatuses } from "@/hooks/useMaintenanceStatuses";
import { useCreateMaintenance, useUpdateMaintenance } from "@/hooks/useMaintenance";
import { useUsers } from "@/hooks/use-users";
import type { MaintenanceTicketItem } from "@/lib/queries/maintenance";

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

  const { data: venues = [] } = useVenues();
  const { data: statuses = [] } = useMaintenanceStatuses();
  const { data: priorities = [] } = useMaintenancePriorities();
  const { data: categories = [] } = useMaintenanceCategories();
  const { data: usersData } = useUsers(undefined, { limit: 200 });
  const users = usersData?.users ?? [];

  const { mutateAsync: createMutation, isPending: isCreating } = useCreateMaintenance();
  const { mutateAsync: updateMutation, isPending: isUpdating } = useUpdateMaintenance();
  const isPending = isCreating || isUpdating;

  useEffect(() => {
    if (!open) return;
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
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [open, editItem]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      if (isEdit && editItem) {
        await updateMutation({ id: editItem.id, ...payload });
        toast.success("Jadwal preventive berhasil diperbarui.");
      } else {
        await createMutation(payload);
        toast.success("Jadwal preventive berhasil dibuat.");
      }
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

          {/* Attached images when editing */}
          {isEdit && editItem && editItem.images.length > 0 && (
            <div className="space-y-1.5">
              <Label>Foto Terlampir</Label>
              <div className="flex flex-wrap gap-2">
                {editItem.images.map((img) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.fileName}
                    className="h-16 w-16 rounded-lg object-cover border"
                  />
                ))}
              </div>
            </div>
          )}

          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              Foto dapat dilampirkan setelah jadwal dibuat.
            </p>
          )}
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
