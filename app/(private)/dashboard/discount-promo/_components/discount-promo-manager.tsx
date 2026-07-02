"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  AddCircle,
  PenNewSquare,
  TrashBinTrash,
  Magnifer,
  TagPrice,
  CalendarDate,
  SaleSquare,
  MoneyBag,
  UsersGroupRounded,
  ClockCircle,
  CheckCircle,
  Archive,
  Hourglass,
  Fire,
  Refresh,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { createPromo, updatePromo, deletePromo } from "@/actions/promo";
import type { PromoProgramsResult, PromoProgramItem } from "@/lib/queries/promo";

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscountType = "percentage" | "nominal";
type ProgramStatus = "live" | "upcoming" | "quota-full" | "ended" | "inactive";

interface DiscountProgram {
  id: string;
  name: string;
  isActive: boolean;
  discountType: DiscountType;
  discountValue: number;
  minTransaction: number | null;
  periodStart: Date;
  periodEnd: Date;
  eventEligibleStart: Date | null;
  eventEligibleEnd: Date | null;
  quota: number | null;
  usedCount: number;
  description: string;
}

interface Props {
  initialData: PromoProgramsResult;
}

// ─── Mapper: DB → local ───────────────────────────────────────────────────────

function mapDbToLocal(item: PromoProgramItem): DiscountProgram {
  return {
    id: item.id,
    name: item.name,
    isActive: item.isActive,
    discountType: item.discountType === "PERCENTAGE" ? "percentage" : "nominal",
    discountValue: item.discountValue,
    minTransaction: item.minTransaction,
    periodStart: new Date(item.periodStart),
    periodEnd: new Date(item.periodEnd),
    eventEligibleStart: item.eventEligibleStart ? new Date(item.eventEligibleStart) : null,
    eventEligibleEnd: item.eventEligibleEnd ? new Date(item.eventEligibleEnd) : null,
    quota: item.quota,
    usedCount: item.usedCount,
    description: item.description ?? "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return format(d, "d MMM yyyy", { locale: localeId });
}

function fmtDiscount(program: DiscountProgram): string {
  if (program.discountType === "percentage") return `${program.discountValue}%`;
  const v = program.discountValue;
  if (v >= 1_000_000) {
    const juta = v / 1_000_000;
    return `Rp ${Number.isInteger(juta) ? juta : juta.toFixed(1)} jt`;
  }
  return `Rp ${fmtRp(v)}`;
}

function fmtDiscountFull(program: DiscountProgram): string {
  if (program.discountType === "percentage") return `${program.discountValue}%`;
  return `Rp ${fmtRp(program.discountValue)}`;
}

function parseRp(s: string): number | null {
  const n = parseInt(s.replace(/\D/g, ""), 10);
  return isNaN(n) ? null : n;
}

// ─── Status derivation ────────────────────────────────────────────────────────

function deriveStatus(program: DiscountProgram, now: Date): ProgramStatus {
  const expired = now > program.periodEnd;
  const quotaFull = program.quota !== null && program.usedCount >= program.quota;
  if (expired) return "ended";
  if (!program.isActive) return "inactive";
  if (now < program.periodStart) return "upcoming";
  if (quotaFull) return "quota-full";
  return "live";
}

const STATUS_SORT_ORDER: Record<ProgramStatus, number> = {
  live: 0,
  "quota-full": 1,
  upcoming: 2,
  ended: 3,
  inactive: 4,
};

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  isActive: boolean;
  discountType: DiscountType;
  discountValue: string;
  minTransaction: string;
  periodStart: Date | undefined;
  periodEnd: Date | undefined;
  eventEligibleStart: Date | undefined;
  eventEligibleEnd: Date | undefined;
  quota: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  isActive: true,
  discountType: "percentage",
  discountValue: "",
  minTransaction: "",
  periodStart: undefined,
  periodEnd: undefined,
  eventEligibleStart: undefined,
  eventEligibleEnd: undefined,
  quota: "",
  description: "",
};

function programToForm(p: DiscountProgram): FormState {
  return {
    name: p.name,
    isActive: p.isActive,
    discountType: p.discountType,
    discountValue: String(p.discountValue),
    minTransaction: p.minTransaction !== null ? fmtRp(p.minTransaction) : "",
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    eventEligibleStart: p.eventEligibleStart ?? undefined,
    eventEligibleEnd: p.eventEligibleEnd ?? undefined,
    quota: p.quota !== null ? String(p.quota) : "",
    description: p.description,
  };
}

type FilterKey = "all" | "live" | "upcoming" | "ended";

// ─── Component ────────────────────────────────────────────────────────────────

export function DiscountPromoManager({ initialData }: Props) {
  const { can } = usePermissions();
  const canCreate = can("promo", "create");
  const canEdit = can("promo", "edit");
  const canDelete = can("promo", "delete");

  const [programs, setPrograms] = useState<DiscountProgram[]>(
    () => initialData.map(mapDbToLocal)
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DiscountProgram | null>(null);

  // ── Refresh ───────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/promos?activeOnly=false");
      if (res.ok) {
        const data = (await res.json()) as { items: PromoProgramsResult };
        setPrograms(data.items.map(mapDbToLocal));
        toast.success("Data diperbarui.");
      } else {
        toast.error("Gagal memuat ulang data.");
      }
    } catch {
      toast.error("Gagal memuat ulang data.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Derived list ─────────────────────────────────────────────────────────

  const sorted = useMemo(() => {
    const now = new Date();
    return [...programs].sort((a, b) => {
      const sa = STATUS_SORT_ORDER[deriveStatus(a, now)];
      const sb = STATUS_SORT_ORDER[deriveStatus(b, now)];
      return sa - sb;
    });
  }, [programs]);

  const filtered = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    return sorted.filter((p) => {
      const status = deriveStatus(p, now);
      if (statusFilter === "live" && status !== "live" && status !== "quota-full") return false;
      if (statusFilter === "upcoming" && status !== "upcoming") return false;
      if (statusFilter === "ended" && status !== "ended" && status !== "inactive") return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, search, statusFilter]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(p: DiscountProgram) {
    setEditingId(p.id);
    setForm(programToForm(p));
    setFormErrors({});
    setFormOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errors.name = "Nama program wajib diisi.";
    const val = parseFloat(form.discountValue);
    if (!form.discountValue || isNaN(val) || val <= 0) {
      errors.discountValue = "Nilai potongan wajib diisi dan harus > 0.";
    } else if (form.discountType === "percentage" && val > 100) {
      errors.discountValue = "Persentase tidak boleh melebihi 100%.";
    }
    if (!form.periodStart) errors.periodStart = "Tanggal mulai periode wajib diisi.";
    if (!form.periodEnd) errors.periodEnd = "Tanggal selesai periode wajib diisi.";
    if (form.periodStart && form.periodEnd && form.periodEnd < form.periodStart) {
      errors.periodEnd = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    }
    if (
      form.eventEligibleStart &&
      form.eventEligibleEnd &&
      form.eventEligibleEnd < form.eventEligibleStart
    ) {
      errors.eventEligibleEnd = "Tanggal selesai event harus setelah tanggal mulai.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    const discountValue = parseInt(form.discountValue.replace(/\D/g, ""), 10);
    const minTransaction = parseRp(form.minTransaction);
    const quota = form.quota.trim() ? parseInt(form.quota, 10) : null;
    const dbDiscountType =
      form.discountType === "percentage" ? ("PERCENTAGE" as const) : ("NOMINAL" as const);

    const input = {
      name: form.name.trim(),
      isActive: form.isActive,
      discountType: dbDiscountType,
      discountValue,
      minTransaction: minTransaction ?? null,
      periodStart: form.periodStart!,
      periodEnd: form.periodEnd!,
      eventEligibleStart: form.eventEligibleStart ?? null,
      eventEligibleEnd: form.eventEligibleEnd ?? null,
      quota: quota ?? null,
      description: form.description.trim() || null,
    };

    if (editingId) {
      const result = await updatePromo(editingId, input);
      setSaving(false);
      if (!result.success) { toast.error(result.error); return; }
      setPrograms((prev) => prev.map((p) => (p.id === editingId ? mapDbToLocal(result.item) : p)));
      toast.success("Program berhasil diperbarui.");
    } else {
      const result = await createPromo(input);
      setSaving(false);
      if (!result.success) { toast.error(result.error); return; }
      setPrograms((prev) => [mapDbToLocal(result.item), ...prev]);
      toast.success("Program berhasil ditambahkan.");
    }

    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deletePromo(deleteTarget.id);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setPrograms((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    toast.success(`Program "${deleteTarget.name}" dihapus.`);
    setDeleteTarget(null);
  }

  // ── Date picker sub-component ─────────────────────────────────────────────

  function DatePickerField({
    id,
    label,
    value,
    onChange,
    error,
    optional,
  }: {
    id: string;
    label: string;
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
    error?: string;
    optional?: boolean;
  }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {label}
          {!optional && <span className="text-destructive ml-0.5">*</span>}
          {optional && (
            <span className="text-muted-foreground text-xs ml-1">(opsional)</span>
          )}
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            id={id}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-xl border bg-background px-3 text-sm",
              "text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            <CalendarDate
              weight="BoldDuotone"
              className="h-4 w-4 shrink-0 text-muted-foreground"
            />
            {value ? format(value, "d MMMM yyyy", { locale: localeId }) : "Pilih tanggal"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(d) => {
                onChange(d ?? undefined);
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-6 pb-6 px-2 sm:px-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">Discount / Promo</h1>
            <span className="text-sm text-muted-foreground">({filtered.length})</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Magnifer
                weight="BoldDuotone"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari program..."
                className="pl-8 h-9 w-44 rounded-xl"
              />
            </div>

            {/* Lifecycle filter chips */}
            <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 p-1">
              {(
                [
                  { key: "all", label: "Semua" },
                  { key: "live", label: "Berlangsung" },
                  { key: "upcoming", label: "Akan Datang" },
                  { key: "ended", label: "Berakhir" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    statusFilter === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="cursor-pointer rounded-xl gap-1.5 h-9 px-3"
            >
              <Refresh
                weight="BoldDuotone"
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
            </Button>

            {canCreate && (
              <Button onClick={openAdd} className="cursor-pointer rounded-xl gap-2">
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah
              </Button>
            )}
          </div>
        </div>

        {/* Voucher grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <TagPrice weight="BoldDuotone" className="h-10 w-10 opacity-30" />
            <p className="text-sm">Belum ada program discount / promo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.map((program) => (
              <VoucherCard
                key={program.id}
                program={program}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => openEdit(program)}
                onDelete={() => setDeleteTarget(program)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle>
            {editingId ? "Edit Program" : "Tambah Program"} Discount / Promo
          </DialogTitle>

          <div className="space-y-5 pt-2">
            {/* Nama Program */}
            <div className="space-y-1.5">
              <Label htmlFor="dp-name">
                Nama Program <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dp-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Contoh: June Surprise"
                className={cn(formErrors.name && "border-destructive")}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>

            {/* Status Aktif */}
            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Status Aktif</p>
                <p className="text-xs text-muted-foreground">
                  Program nonaktif tidak dapat dipilih saat membuat booking
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setField("isActive", v)}
              />
            </div>

            {/* Tipe + Nilai Potongan */}
            <div className="space-y-3">
              <Label>
                Tipe Potongan <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "percentage", label: "Persentase (%)" },
                    { value: "nominal", label: "Nominal (Rp)" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setField("discountType", value);
                      setField("discountValue", "");
                    }}
                    className={cn(
                      "flex-1 rounded-xl border py-2 px-3 text-sm font-medium transition-colors cursor-pointer",
                      form.discountType === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dp-value">
                  Nilai Potongan <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="dp-value"
                    value={form.discountValue}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (form.discountType === "percentage") {
                        if (/^\d*\.?\d*$/.test(raw)) setField("discountValue", raw);
                      } else {
                        const digits = raw.replace(/\D/g, "");
                        setField("discountValue", digits ? fmtRp(parseInt(digits, 10)) : "");
                      }
                    }}
                    placeholder={
                      form.discountType === "percentage" ? "Contoh: 10" : "Contoh: 5.000.000"
                    }
                    className={cn("pr-12", formErrors.discountValue && "border-destructive")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {form.discountType === "percentage" ? "%" : "Rp"}
                  </span>
                </div>
                {formErrors.discountValue && (
                  <p className="text-xs text-destructive">{formErrors.discountValue}</p>
                )}
              </div>
            </div>

            {/* Minimal Transaksi */}
            <div className="space-y-1.5">
              <Label htmlFor="dp-min">
                Minimal Transaksi{" "}
                <span className="text-muted-foreground text-xs">(opsional)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="dp-min"
                  value={form.minTransaction}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    setField("minTransaction", digits ? fmtRp(parseInt(digits, 10)) : "");
                  }}
                  placeholder="Kosongkan jika tidak ada batas minimal"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Periode Program */}
            <div className="space-y-3">
              <Label>
                Periode Program (Aktif) <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <DatePickerField
                  id="dp-period-start"
                  label="Mulai"
                  value={form.periodStart}
                  onChange={(d) => setField("periodStart", d)}
                  error={formErrors.periodStart}
                />
                <DatePickerField
                  id="dp-period-end"
                  label="Selesai"
                  value={form.periodEnd}
                  onChange={(d) => setField("periodEnd", d)}
                  error={formErrors.periodEnd}
                />
              </div>
            </div>

            {/* Rentang Event Eligible */}
            <div className="space-y-3">
              <Label>
                Rentang Event Eligible{" "}
                <span className="text-muted-foreground text-xs">(opsional)</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Event yang pelaksanaannya jatuh dalam rentang ini berhak menggunakan program ini.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <DatePickerField
                  id="dp-event-start"
                  label="Mulai Event"
                  value={form.eventEligibleStart}
                  onChange={(d) => setField("eventEligibleStart", d)}
                  optional
                />
                <DatePickerField
                  id="dp-event-end"
                  label="Selesai Event"
                  value={form.eventEligibleEnd}
                  onChange={(d) => setField("eventEligibleEnd", d)}
                  error={formErrors.eventEligibleEnd}
                  optional
                />
              </div>
            </div>

            {/* Quota */}
            <div className="space-y-1.5">
              <Label htmlFor="dp-quota">
                Quota{" "}
                <span className="text-muted-foreground text-xs">(opsional)</span>
              </Label>
              <Input
                id="dp-quota"
                type="number"
                min={1}
                value={form.quota}
                onChange={(e) => setField("quota", e.target.value)}
                placeholder="Kosongkan untuk tanpa batas"
              />
              <p className="text-xs text-muted-foreground">
                Jumlah maksimal booking yang dapat menggunakan program ini.
              </p>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1.5">
              <Label htmlFor="dp-desc">Deskripsi / Ketentuan</Label>
              <Textarea
                id="dp-desc"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Tuliskan ketentuan lengkap program ini..."
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
                className="flex-1 cursor-pointer rounded-xl"
              >
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 cursor-pointer rounded-xl"
              >
                {saving ? "Menyimpan..." : editingId ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Program Discount</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus program{" "}
              <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>? Booking yang
              sudah menggunakan program ini tidak terpengaruh, tapi program
              tidak bisa dipilih lagi di booking baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Voucher Card ─────────────────────────────────────────────────────────────

function VoucherCard({
  program,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  program: DiscountProgram;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const now = new Date();
  const status = deriveStatus(program, now);
  const isLive = status === "live";
  const isDimmed = status === "ended" || status === "inactive";

  const daysToEnd = differenceInCalendarDays(program.periodEnd, now);
  const daysToStart = differenceInCalendarDays(program.periodStart, now);

  const timeLabel: string = (() => {
    if (status === "live" || status === "quota-full") {
      if (daysToEnd <= 0) return "Berakhir hari ini";
      if (daysToEnd === 1) return "1 hari lagi";
      return `${daysToEnd} hari lagi`;
    }
    if (status === "upcoming") {
      if (daysToStart <= 1) return "Mulai besok";
      return `Mulai ${daysToStart} hari lagi`;
    }
    return `Berakhir ${fmtDate(program.periodEnd)}`;
  })();

  const timeUrgent = isLive && daysToEnd <= 3;
  const quotaFull = program.quota !== null && program.usedCount >= program.quota;
  const quotaPct =
    program.quota !== null
      ? Math.min(100, (program.usedCount / program.quota) * 100)
      : null;
  const showActions = canEdit || canDelete;

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden shadow-sm transition-all duration-200",
        "motion-reduce:transition-none",
        isLive &&
          "hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0",
        isDimmed && "opacity-70 saturate-50"
      )}
    >
      {/* Card shell — border */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl border pointer-events-none z-10",
          isLive && "border-[var(--brand-gold)]/40",
          !isLive && "border-border"
        )}
        aria-hidden
      />

      {/* Card background */}
      <div className="flex min-h-36 bg-card">

        {/* STUB (left ~58%) */}
        <div
          className="relative flex flex-col justify-between min-w-0 flex-[58] px-5 py-4 gap-2"
          style={
            isLive
              ? {
                  backgroundImage:
                    "linear-gradient(135deg, color-mix(in srgb, var(--brand-gold) 18%, transparent) 0%, transparent 55%)",
                }
              : undefined
          }
        >
          {/* Eyebrow */}
          <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground leading-none">
            {program.name}
          </p>

          {/* Denomination */}
          <div className="flex flex-col gap-0.5">
            <p className="font-heading text-4xl font-bold leading-none text-foreground">
              {fmtDiscount(program)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {program.discountType === "percentage" ? "potongan" : "cashback"}
            </p>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            {isLive ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border"
                style={{
                  color: "var(--brand-gold)",
                  borderColor: "color-mix(in srgb, var(--brand-gold) 50%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--brand-gold) 12%, transparent)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "var(--brand-gold)" }}
                  aria-hidden
                />
                LIVE
              </span>
            ) : status === "upcoming" ? (
              <Badge variant="secondary" className="text-xs">
                <Hourglass weight="BoldDuotone" className="h-3 w-3 mr-1 inline-block" />
                Akan Datang
              </Badge>
            ) : status === "quota-full" ? (
              <Badge variant="secondary" className="text-xs">
                Kuota Habis
              </Badge>
            ) : status === "ended" ? (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <Archive weight="BoldDuotone" className="h-3 w-3 mr-1 inline-block" />
                Berakhir
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Nonaktif
              </Badge>
            )}
          </div>

          {/* Void stamp */}
          {isDimmed && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              aria-hidden
            >
              <span
                className={cn(
                  "text-3xl font-black uppercase tracking-[0.2em] select-none",
                  "-rotate-12 opacity-[0.07] text-foreground"
                )}
              >
                {status === "ended" ? "BERAKHIR" : "NONAKTIF"}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {showActions && (
            <div className="flex items-center gap-0.5 mt-1">
              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors motion-reduce:transition-none"
                  aria-label={`Edit ${program.name}`}
                >
                  <PenNewSquare
                    weight="BoldDuotone"
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors motion-reduce:transition-none"
                  aria-label={`Hapus ${program.name}`}
                >
                  <TrashBinTrash
                    weight="BoldDuotone"
                    className="h-3.5 w-3.5 text-destructive"
                  />
                </button>
              )}
            </div>
          )}
        </div>

        {/* TEAR-LINE */}
        <div className="relative flex-none w-px self-stretch">
          <div className="absolute inset-0 border-l border-dashed border-border" />
          <div
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-background border border-border"
            aria-hidden
          />
          <div
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-background border border-border"
            aria-hidden
          />
        </div>

        {/* COUNTERFOIL (right ~42%) */}
        <div className="flex-[42] flex flex-col justify-between px-4 py-4 gap-3 min-w-0">
          <div className="flex flex-col gap-1">
            {program.discountType === "percentage" ? (
              <div className="flex items-start gap-1.5">
                <SaleSquare
                  weight="BoldDuotone"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground leading-tight">Min. transaksi</p>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {program.minTransaction !== null
                      ? `Rp ${fmtRp(program.minTransaction)}`
                      : "Tanpa batas"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                <MoneyBag
                  weight="BoldDuotone"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground leading-tight">Nilai penuh</p>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {fmtDiscountFull(program)}
                  </p>
                  {program.minTransaction !== null && (
                    <p className="text-xs text-muted-foreground leading-tight">
                      min. Rp {fmtRp(program.minTransaction)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {program.eventEligibleStart && (
              <div className="flex items-start gap-1.5 mt-0.5">
                <CalendarDate
                  weight="BoldDuotone"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground leading-tight">Event eligible</p>
                  <p className="text-xs font-medium text-foreground leading-tight">
                    {fmtDate(program.eventEligibleStart)} &ndash;{" "}
                    {fmtDate(program.eventEligibleEnd)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-1.5 mt-0.5">
              <CalendarDate
                weight="BoldDuotone"
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">Periode promo</p>
                <p className="text-xs font-medium text-foreground leading-tight">
                  {fmtDate(program.periodStart)} &ndash; {fmtDate(program.periodEnd)}
                </p>
              </div>
            </div>
          </div>

          {/* Scarcity strip */}
          <div className="flex flex-col gap-2 pt-2 border-t border-dashed border-border">
            <div className="flex items-center gap-1.5">
              {isLive && daysToEnd <= 3 ? (
                <Fire
                  weight="BoldDuotone"
                  className="h-3.5 w-3.5 shrink-0 text-destructive"
                />
              ) : (
                <ClockCircle
                  weight="BoldDuotone"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                />
              )}
              <span
                className={cn(
                  "text-xs font-semibold leading-tight",
                  timeUrgent ? "text-destructive" : "text-foreground"
                )}
              >
                {timeLabel}
              </span>
              {timeUrgent && (
                <span
                  className="ml-auto inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--brand-gold) 20%, transparent)",
                    color: "var(--brand-gold)",
                  }}
                >
                  SEGERA
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <UsersGroupRounded
                    weight="BoldDuotone"
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="text-xs text-muted-foreground">
                    {program.quota !== null
                      ? `${program.usedCount} / ${program.quota} terpakai`
                      : `${program.usedCount} terpakai · tanpa batas`}
                  </span>
                </div>
                {quotaFull && (
                  <CheckCircle
                    weight="BoldDuotone"
                    className="h-3.5 w-3.5 text-destructive shrink-0"
                  />
                )}
              </div>

              {quotaPct !== null && (
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all motion-reduce:transition-none",
                      quotaFull ? "bg-destructive" : "bg-primary"
                    )}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
