// FILE: app/(private)/(general)/kpi-insentif/penugasan/_components/PenugasanDrawer.tsx
"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AddCircle, Pen, InfoCircle } from "@solar-icons/react";
import { toast } from "sonner";
import { useCreateAssignment, useUpdateAssignment, useKpiMasters, useProfilesForAssignment } from "@/hooks/useKpiInsentif";
import { useVenues } from "@/hooks/use-venues";
import { formatRupiah } from "@/lib/utils/kpiFormatters";
import type { KpiAssignmentItem, KpiMasterItem } from "@/types/kpiInsentif";
import { SectionLabel } from "../../_components/SectionLabel";
import { DrawerFooter } from "../../_components/DrawerFooter";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface PenugasanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: KpiAssignmentItem | null;
  defaultMonth: number;
  defaultYear: number;
}

type FormState = {
  profileId: string;
  kpiMasterId: string;
  periodMonth: string;
  periodYear: string;
  venueId: string;
  notes: string;
  isDraft: boolean;
};

type FormErrors = Partial<Record<"profileId" | "kpiMasterId" | "period", string>>;

const EMPTY: FormState = {
  profileId: "",
  kpiMasterId: "",
  periodMonth: "",
  periodYear: "",
  venueId: "all",
  notes: "",
  isDraft: false,
};

export function PenugasanDrawer({
  isOpen,
  onClose,
  editItem,
  defaultMonth,
  defaultYear,
}: PenugasanDrawerProps) {
  const isEdit = editItem != null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedMaster, setSelectedMaster] = useState<KpiMasterItem | null>(null);

  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Profile picker menyempit sesuai businessRole KPI Master yang dipilih —
  // Profile tidak punya kolom businessRole sendiri, jadi ini narrowing di UI
  // (lihat catatan di lib/queries/kpiInsentif.ts#getProfilesForKpiAssignment),
  // bukan validasi keras di server.
  const { data: profiles = [] } = useProfilesForAssignment(selectedMaster?.businessRole);
  const { data: masters = [] } = useKpiMasters();
  const { data: venues = [] } = useVenues();

  const yearOptions = Array.from({ length: 5 }, (_, i) => defaultYear - 2 + i);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({});
    if (isEdit && editItem) {
      const d = new Date(editItem.period);
      setForm({
        profileId: editItem.profileId,
        kpiMasterId: editItem.kpiMasterId,
        periodMonth: String(d.getMonth() + 1),
        periodYear: String(d.getFullYear()),
        venueId: editItem.venueId ?? "all",
        notes: editItem.notes ?? "",
        isDraft: editItem.isDraft,
      });
      setSelectedMaster(editItem.kpiMaster as KpiMasterItem);
    } else {
      setForm({
        ...EMPTY,
        periodMonth: String(defaultMonth),
        periodYear: String(defaultYear),
      });
      setSelectedMaster(null);
    }
  }, [isOpen, isEdit, editItem, defaultMonth, defaultYear]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleMasterSelect(masterId: string) {
    setField("kpiMasterId", masterId);
    setErrors((prev) => ({ ...prev, kpiMasterId: undefined }));
    const master = masters.find((m) => m.id === masterId) ?? null;
    setSelectedMaster(master as KpiMasterItem | null);
    if (master) {
      const d = new Date(master.month);
      setField("periodMonth", String(d.getMonth() + 1));
      setField("periodYear", String(d.getFullYear()));
      // KPI Master baru bisa punya businessRole beda dari sebelumnya — reset
      // pilihan karyawan supaya tidak ada Sales ter-assign ke KPI Manager (atau
      // sebaliknya) hanya karena karyawan dipilih sebelum master diganti.
      setField("profileId", "");
    }
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.profileId) next.profileId = "Pilih karyawan terlebih dahulu";
    if (!form.kpiMasterId) next.kpiMasterId = "Pilih KPI Master terlebih dahulu";
    if (!form.periodMonth || !form.periodYear) next.period = "Periode wajib diisi";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      toast.error("Lengkapi data yang wajib diisi terlebih dahulu");
      return;
    }

    const payload = {
      profileId: form.profileId,
      kpiMasterId: form.kpiMasterId,
      periodMonth: Number(form.periodMonth),
      periodYear: Number(form.periodYear),
      venueId: form.venueId === "all" ? null : form.venueId || null,
      notes: form.notes.trim() || null,
      isDraft: form.isDraft,
    };

    if (isEdit && editItem) {
      const res = await updateMutation.mutateAsync({ id: editItem.id, data: payload });
      if (res.success) {
        toast.success("Penugasan berhasil diperbarui");
        onClose();
      } else {
        toast.error(res.error ?? "Gagal memperbarui penugasan");
      }
    } else {
      const res = await createMutation.mutateAsync(payload);
      if (res.success) {
        toast.success("Penugasan berhasil dibuat");
        onClose();
      } else {
        toast.error(res.error ?? "Gagal membuat penugasan");
      }
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Penugasan KPI" : "Tambah Penugasan KPI"}
      maxWidth="sm:max-w-lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 space-y-4 overflow-y-auto pb-2">
          {/* KPI Master & Karyawan */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Data Penugasan" />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                KPI Master <span className="text-destructive">*</span>
              </Label>
              <Select value={form.kpiMasterId} onValueChange={handleMasterSelect}>
                <SelectTrigger className="rounded-xl w-full" aria-invalid={!!errors.kpiMasterId}>
                  <SelectValue placeholder="Pilih KPI Master" />
                </SelectTrigger>
                <SelectContent>
                  {masters.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                  {masters.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Belum ada KPI Master
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.kpiMasterId && (
                <p className="text-xs text-destructive">{errors.kpiMasterId}</p>
              )}
            </div>

            {selectedMaster && (
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <InfoCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                  Info KPI Master
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Target Item</span>
                  <span className="font-medium">{selectedMaster.targetItem?.name ?? "-"}</span>
                  <span className="text-muted-foreground">Periode</span>
                  <span className="font-medium">
                    {(() => { const d = new Date(selectedMaster.month); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; })()}
                  </span>
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium capitalize">{selectedMaster.businessRole}</span>
                  <span className="text-muted-foreground">Dealing</span>
                  <span className="font-medium">
                    {selectedMaster.targetItem?.dealingQty != null ? `${selectedMaster.targetItem.dealingQty} qty` : "-"}
                  </span>
                  <span className="text-muted-foreground">Omset</span>
                  <span className="font-medium">{formatRupiah(selectedMaster.targetItem?.omsetPrice)}</span>
                  <span className="text-muted-foreground">Homebase</span>
                  <span className="font-medium">
                    {selectedMaster.targetItem?.homebaseQty != null ? `${selectedMaster.targetItem.homebaseQty} qty` : "-"}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Karyawan <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.profileId}
                onValueChange={(v) => {
                  setField("profileId", v);
                  setErrors((prev) => ({ ...prev, profileId: undefined }));
                }}
              >
                <SelectTrigger className="rounded-xl w-full" aria-invalid={!!errors.profileId}>
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName ?? p.id}
                      {p.roleName ? ` — ${p.roleName}` : ""}
                    </SelectItem>
                  ))}
                  {profiles.length === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Tidak ada karyawan yang cocok
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.profileId ? (
                <p className="text-xs text-destructive">{errors.profileId}</p>
              ) : selectedMaster ? (
                <p className="text-xs text-muted-foreground">
                  Menampilkan karyawan dengan role &ldquo;{selectedMaster.businessRole}&rdquo;
                </p>
              ) : null}
            </div>
          </div>

          {/* Periode */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Periode & Venue" />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Bulan <span className="text-destructive">*</span></Label>
                <Select value={form.periodMonth} onValueChange={(v) => setField("periodMonth", v)}>
                  <SelectTrigger className="rounded-xl w-full">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tahun <span className="text-destructive">*</span></Label>
                <Select value={form.periodYear} onValueChange={(v) => setField("periodYear", v)}>
                  <SelectTrigger className="rounded-xl w-full">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {errors.period && <p className="text-xs text-destructive">{errors.period}</p>}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Venue (opsional)</Label>
              <Select value={form.venueId} onValueChange={(v) => setField("venueId", v)}>
                <SelectTrigger className="rounded-xl w-full">
                  <SelectValue placeholder="Semua venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Catatan & Draft */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Catatan & Status" />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Catatan (opsional)</Label>
              <Textarea
                placeholder="Catatan tambahan tentang penugasan ini..."
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                className="rounded-xl min-h-20 resize-y"
              />
            </div>

            <div className="flex items-center gap-3 rounded-xl border p-3">
              <Switch
                id="isDraft"
                checked={form.isDraft}
                onCheckedChange={(v) => setField("isDraft", v)}
              />
              <div>
                <Label htmlFor="isDraft" className="text-sm font-medium cursor-pointer">
                  Simpan sebagai draft
                </Label>
                <p className="text-xs text-muted-foreground">
                  Periode / cakupan belum dikonfirmasi
                </p>
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter
          onCancel={onClose}
          isSaving={isSaving}
          submitLabel={isEdit ? "Simpan" : "Tambah Penugasan"}
          submitIcon={
            isEdit ? (
              <Pen weight="BoldDuotone" className="h-4 w-4" />
            ) : (
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            )
          }
        />
      </form>
    </Drawer>
  );
}
