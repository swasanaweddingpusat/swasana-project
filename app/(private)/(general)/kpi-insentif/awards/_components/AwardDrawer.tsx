"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { AddCircle, Pen } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionLabel } from "../../_components/SectionLabel";
import { DrawerFooter } from "../../_components/DrawerFooter";
import { useCreateAward, useUpdateAward } from "@/hooks/useKpiInsentif";
import type { KpiAwardRow } from "@/lib/queries/kpiInsentif";
import type { KpiAwardRankingMetric } from "@/types/kpiInsentif";

interface AwardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: KpiAwardRow | null;
}

type RankableMetric = Exclude<KpiAwardRankingMetric, "manual">;

type FormValues = {
  name: string;
  description: string;
  businessRole: "all" | "sales" | "manager";
  isRanked: boolean;
  rankingMetric: RankableMetric;
  defaultPrizeDescription: string;
  isActive: boolean;
};

const DEFAULT_VALUES: FormValues = {
  name: "",
  description: "",
  businessRole: "all",
  isRanked: true,
  rankingMetric: "totalBonus",
  defaultPrizeDescription: "",
  isActive: true,
};

const RANKING_METRIC_OPTIONS: { value: RankableMetric; label: string }[] = [
  { value: "totalBonus", label: "Total Bonus" },
  { value: "netAmount", label: "Net Amount (Take Home)" },
  { value: "dealingAchievementPct", label: "% Capaian Dealing" },
  { value: "omsetAchievementPct", label: "% Capaian Omset" },
];

export function AwardDrawer({ isOpen, onClose, editItem }: AwardDrawerProps) {
  const isEditMode = editItem != null;
  const createMutation = useCreateAward();
  const updateMutation = useUpdateAward();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULT_VALUES });

  const isRanked = watch("isRanked");

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && editItem) {
      reset({
        name: editItem.name,
        description: editItem.description ?? "",
        businessRole: (editItem.businessRole as "sales" | "manager" | null) ?? "all",
        isRanked: editItem.isRanked,
        rankingMetric:
          editItem.isRanked && editItem.rankingMetric && editItem.rankingMetric !== "manual"
            ? (editItem.rankingMetric as RankableMetric)
            : "totalBonus",
        defaultPrizeDescription: editItem.defaultPrizeDescription ?? "",
        isActive: editItem.isActive,
      });
    } else {
      reset(DEFAULT_VALUES);
    }
  }, [isOpen, isEditMode, editItem, reset]);

  function handleClose() {
    reset(DEFAULT_VALUES);
    onClose();
  }

  async function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      businessRole: values.businessRole === "all" ? null : values.businessRole,
      isRanked: values.isRanked,
      rankingMetric: values.isRanked ? values.rankingMetric : null,
      defaultPrizeDescription: values.defaultPrizeDescription.trim() || null,
      isActive: values.isActive,
    };

    if (isEditMode && editItem) {
      const result = await updateMutation.mutateAsync({ id: editItem.id, data: payload });
      if (result.success) {
        toast.success("Award berhasil diperbarui");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui award");
      }
    } else {
      const result = await createMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Award berhasil ditambahkan");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal menambahkan award");
      }
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit Award" : "Tambah Award"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Informasi Dasar" />

            <div className="space-y-1.5">
              <Label htmlFor="aw-name" className="text-sm font-medium">
                Nama Award <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aw-name"
                placeholder="Contoh: Sales Terbaik"
                className="rounded-xl"
                {...register("name", { required: "Nama award wajib diisi" })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aw-description" className="text-sm font-medium">
                Deskripsi (opsional)
              </Label>
              <Textarea
                id="aw-description"
                placeholder="Jelaskan kriteria atau tujuan award ini..."
                className="rounded-xl min-h-20 resize-y"
                {...register("description")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Role Scope <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="businessRole"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl w-full">
                      <SelectValue placeholder="Pilih role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Role</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Mekanisme Penentuan Pemenang" />

            <Controller
              control={control}
              name="isRanked"
              render={({ field }) => (
                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <Switch
                    id="aw-isRanked"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <div>
                    <Label htmlFor="aw-isRanked" className="text-sm font-medium cursor-pointer">
                      Otomatis (ranking by metric)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Nonaktifkan untuk pemilihan manual (subjektif)
                    </p>
                  </div>
                </div>
              )}
            />

            {isRanked && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Metrik Ranking <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="rankingMetric"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih metrik" />
                      </SelectTrigger>
                      <SelectContent>
                        {RANKING_METRIC_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Kandidat akan diurutkan otomatis berdasarkan metrik ini per periode
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Hadiah & Status" />

            <div className="space-y-1.5">
              <Label htmlFor="aw-prize" className="text-sm font-medium">
                Deskripsi Hadiah Default (opsional)
              </Label>
              <Input
                id="aw-prize"
                placeholder="Contoh: Voucher belanja Rp 500.000"
                className="rounded-xl"
                {...register("defaultPrizeDescription")}
              />
            </div>

            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <Switch
                    id="aw-isActive"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <div>
                    <Label htmlFor="aw-isActive" className="text-sm font-medium cursor-pointer">
                      Aktif
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Award nonaktif tidak akan muncul untuk dipilih pemenangnya
                    </p>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        <DrawerFooter
          onCancel={handleClose}
          isSaving={isSaving}
          submitLabel={isEditMode ? "Simpan Perubahan" : "Tambah Award"}
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
