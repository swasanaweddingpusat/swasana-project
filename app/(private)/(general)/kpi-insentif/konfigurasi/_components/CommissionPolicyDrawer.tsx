// FILE: app/(private)/(general)/kpi-insentif/konfigurasi/_components/CommissionPolicyDrawer.tsx
"use client";

import { useEffect } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { toast } from "sonner";
import { format } from "date-fns";
import { AddCircle, Pen, InfoCircle, Calendar as CalendarSolarIcon } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, parseDateOnly } from "@/lib/utils";
import { SectionLabel } from "../../_components/SectionLabel";
import { DrawerFooter } from "../../_components/DrawerFooter";
import {
  useCreateCommissionPolicy,
  useUpdateCommissionPolicy,
} from "@/hooks/useKpiInsentif";
import type { CommissionPolicyRow } from "@/lib/queries/kpiInsentif";

interface CommissionPolicyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editPolicy?: CommissionPolicyRow | null;
}

type PackageCategoryOption = "ALL" | "WEDDINGS" | "MICE";

type FormValues = {
  name: string;
  description: string;
  businessRole: "sales" | "manager";
  packageCategory: PackageCategoryOption;
  isDraft: boolean;
  nominalPerDeal: string;
  pctOfRevenue: string; // user-facing percentage, e.g. "0.89" = 0.89%
  overAchievementNominalPerExtraDeal: string;
  overAchievementPctOfExtraRevenue: string; // user-facing percentage
  effectiveFrom: string; // "yyyy-MM-dd" or ""
  effectiveTo: string; // "yyyy-MM-dd" or ""
};

const DEFAULT_VALUES: FormValues = {
  name: "",
  description: "",
  businessRole: "sales",
  packageCategory: "ALL",
  isDraft: true,
  nominalPerDeal: "",
  pctOfRevenue: "",
  overAchievementNominalPerExtraDeal: "",
  overAchievementPctOfExtraRevenue: "",
  effectiveFrom: "",
  effectiveTo: "",
};

function toDateOnlyString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CommissionPolicyDrawer({
  isOpen,
  onClose,
  editPolicy,
}: CommissionPolicyDrawerProps) {
  const isEditMode = editPolicy != null;
  const createMutation = useCreateCommissionPolicy();
  const updateMutation = useUpdateCommissionPolicy();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const isDraft = useWatch({ control, name: "isDraft" });
  const nominalPerDeal = useWatch({ control, name: "nominalPerDeal" });
  const pctOfRevenue = useWatch({ control, name: "pctOfRevenue" });
  const effectiveFrom = useWatch({ control, name: "effectiveFrom" });
  const effectiveTo = useWatch({ control, name: "effectiveTo" });

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && editPolicy) {
      reset({
        name: editPolicy.name,
        description: editPolicy.description ?? "",
        businessRole: editPolicy.businessRole as "sales" | "manager",
        packageCategory: (editPolicy.packageCategory as PackageCategoryOption | null) ?? "ALL",
        isDraft: editPolicy.isDraft,
        nominalPerDeal: editPolicy.nominalPerDeal != null ? String(editPolicy.nominalPerDeal) : "",
        pctOfRevenue:
          editPolicy.pctOfRevenue != null ? String(Number(editPolicy.pctOfRevenue) * 100) : "",
        overAchievementNominalPerExtraDeal:
          editPolicy.overAchievementNominalPerExtraDeal != null
            ? String(editPolicy.overAchievementNominalPerExtraDeal)
            : "",
        overAchievementPctOfExtraRevenue:
          editPolicy.overAchievementPctOfExtraRevenue != null
            ? String(Number(editPolicy.overAchievementPctOfExtraRevenue) * 100)
            : "",
        effectiveFrom: editPolicy.effectiveFrom ? toDateOnlyString(new Date(editPolicy.effectiveFrom)) : "",
        effectiveTo: editPolicy.effectiveTo ? toDateOnlyString(new Date(editPolicy.effectiveTo)) : "",
      });
    } else {
      reset(DEFAULT_VALUES);
    }
  }, [isOpen, isEditMode, editPolicy, reset]);

  // Clear the "at least one required" error as soon as either field is filled in.
  useEffect(() => {
    if (nominalPerDeal !== "" || pctOfRevenue !== "") {
      clearErrors("nominalPerDeal");
    }
  }, [nominalPerDeal, pctOfRevenue, clearErrors]);

  useEffect(() => {
    clearErrors("effectiveTo");
  }, [effectiveFrom, effectiveTo, clearErrors]);

  function handleClose() {
    reset(DEFAULT_VALUES);
    onClose();
  }

  async function onSubmit(values: FormValues) {
    if (values.nominalPerDeal === "" && values.pctOfRevenue === "") {
      setError("nominalPerDeal", {
        type: "manual",
        message: "Minimal Nominal/Deal atau %Omset harus diisi",
      });
      return;
    }

    if (values.effectiveFrom && values.effectiveTo && values.effectiveTo < values.effectiveFrom) {
      setError("effectiveTo", {
        type: "manual",
        message: "Tanggal akhir berlaku harus setelah tanggal mulai",
      });
      return;
    }

    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      businessRole: values.businessRole,
      isDraft: values.isDraft,
      nominalPerDeal: values.nominalPerDeal !== "" ? values.nominalPerDeal : null,
      pctOfRevenue: values.pctOfRevenue !== "" ? String(parseFloat(values.pctOfRevenue) / 100) : null,
      packageCategory: values.packageCategory === "ALL" ? null : values.packageCategory,
      effectiveFrom: values.effectiveFrom || null,
      effectiveTo: values.effectiveTo || null,
      overAchievementNominalPerExtraDeal:
        values.overAchievementNominalPerExtraDeal !== "" ? values.overAchievementNominalPerExtraDeal : null,
      overAchievementPctOfExtraRevenue:
        values.overAchievementPctOfExtraRevenue !== ""
          ? String(parseFloat(values.overAchievementPctOfExtraRevenue) / 100)
          : null,
    };

    if (isEditMode && editPolicy) {
      const result = await updateMutation.mutateAsync({ id: editPolicy.id, data: payload });
      if (result.success) {
        toast.success("Kebijakan komisi berhasil diperbarui");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui kebijakan komisi");
      }
    } else {
      const result = await createMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Kebijakan komisi berhasil ditambahkan");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal menambahkan kebijakan komisi");
      }
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit Kebijakan Komisi" : "Tambah Kebijakan Komisi"}
      maxWidth="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Dasar */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Dasar" />

            <div className="space-y-1.5">
              <Label htmlFor="cp-name" className="text-sm font-medium">
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cp-name"
                placeholder="Contoh: Komisi Sales Reguler"
                className="rounded-xl"
                {...register("name", { required: "Nama wajib diisi" })}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-description" className="text-sm font-medium">
                Deskripsi
              </Label>
              <Textarea
                id="cp-description"
                placeholder="Keterangan singkat tentang kebijakan ini..."
                className="rounded-xl min-h-16 resize-none"
                {...register("description")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Business Role <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="businessRole"
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["sales", "manager"] as const).map((role) => {
                        const active = field.value === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => field.onChange(role)}
                            className={cn(
                              "flex items-center justify-center py-2 text-xs font-semibold rounded-full transition-colors capitalize",
                              active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted text-muted-foreground hover:bg-accent"
                            )}
                          >
                            {role === "sales" ? "Sales" : "Manager"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Kategori Paket</Label>
                <Controller
                  control={control}
                  name="packageCategory"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Semua Kategori</SelectItem>
                        <SelectItem value="WEDDINGS">Weddings</SelectItem>
                        <SelectItem value="MICE">MICE</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border p-3">
              <Controller
                control={control}
                name="isDraft"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} id="cp-isDraft" />
                )}
              />
              <div>
                <Label htmlFor="cp-isDraft" className="text-sm font-medium cursor-pointer">
                  Simpan sebagai draft
                </Label>
                <p className="text-xs text-muted-foreground">
                  Draft tidak bisa dipakai untuk kalkulasi final
                </p>
              </div>
              {isDraft ? (
                <Badge variant="outline" className="ml-auto rounded-full text-xs bg-muted text-muted-foreground">
                  Draft
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="ml-auto rounded-full text-xs bg-primary/10 text-primary border-primary/30"
                >
                  Aktif
                </Badge>
              )}
            </div>
          </div>

          {/* Formula Komisi */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Formula Komisi" />
            <p className="text-xs text-muted-foreground -mt-1">
              Isi salah satu atau keduanya: nominal tetap per deal, atau persentase dari omset
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="cp-nominalPerDeal" className="text-sm font-medium">
                Nominal / Deal
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="cp-nominalPerDeal"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  className="rounded-xl pl-9"
                  {...register("nominalPerDeal")}
                />
              </div>
              {errors.nominalPerDeal && (
                <p className="text-xs text-destructive">{errors.nominalPerDeal.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-pctOfRevenue" className="text-sm font-medium">
                % Omset
              </Label>
              <div className="relative">
                <Input
                  id="cp-pctOfRevenue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Contoh: 0.89"
                  className="rounded-xl pr-8"
                  {...register("pctOfRevenue")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Persentase dari nilai omset yang dibukukan (mis. 0.89% = 0.89)
              </p>
            </div>
          </div>

          {/* Over-Achievement */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Over-Achievement (Opsional)" />
            <p className="text-xs text-muted-foreground -mt-1">
              Bonus tambahan untuk deal di atas target — kosongkan jika tidak digunakan
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="cp-oaNominal" className="text-sm font-medium">
                Nominal / Extra Deal
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="cp-oaNominal"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  className="rounded-xl pl-9"
                  {...register("overAchievementNominalPerExtraDeal")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-oaPct" className="text-sm font-medium">
                % Extra Omset
              </Label>
              <div className="relative">
                <Input
                  id="cp-oaPct"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Contoh: 1.5"
                  className="rounded-xl pr-8"
                  {...register("overAchievementPctOfExtraRevenue")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Periode Berlaku */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Periode Berlaku" />
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border px-3 py-2">
              <InfoCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Kosongkan kedua tanggal untuk kebijakan yang berlaku selamanya
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Mulai Berlaku</Label>
                <Controller
                  control={control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal rounded-xl",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarSolarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                            {field.value ? format(parseDateOnly(field.value), "dd MMM yyyy") : "Pilih tanggal"}
                          </Button>
                        }
                      />
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={field.value ? parseDateOnly(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? toDateOnlyString(date) : "")}
                          fromYear={new Date().getFullYear() - 2}
                          toYear={new Date().getFullYear() + 5}
                          defaultMonth={field.value ? parseDateOnly(field.value) : new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Sampai Berlaku</Label>
                <Controller
                  control={control}
                  name="effectiveTo"
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal rounded-xl",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarSolarIcon weight="BoldDuotone" className="mr-2 h-4 w-4" />
                            {field.value ? format(parseDateOnly(field.value), "dd MMM yyyy") : "Pilih tanggal"}
                          </Button>
                        }
                      />
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={field.value ? parseDateOnly(field.value) : undefined}
                          onSelect={(date) => field.onChange(date ? toDateOnlyString(date) : "")}
                          fromYear={new Date().getFullYear() - 2}
                          toYear={new Date().getFullYear() + 5}
                          defaultMonth={field.value ? parseDateOnly(field.value) : new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>
            </div>
            {errors.effectiveTo && (
              <p className="text-xs text-destructive">{errors.effectiveTo.message}</p>
            )}
          </div>
        </div>

        <DrawerFooter
          onCancel={handleClose}
          isSaving={isSaving}
          submitLabel={isEditMode ? "Simpan Perubahan" : "Simpan"}
          submitIcon={
            isEditMode ? (
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
