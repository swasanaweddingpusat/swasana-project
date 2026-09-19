"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { toast } from "sonner";
import {
  AddCircle,
  Pen,
  TrashBinTrash,
  AltArrowUp,
  AltArrowDown,
  InfoCircle,
} from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { updateAchievementSchema } from "@/actions/kpiInsentif";
import {
  useCreateAchievementSchema,
  useUpsertSchemaWithTiers,
  useAchievementSchemaById,
} from "@/hooks/useKpiInsentif";
import type { AchievementSchemaRow, AchievementSchemaDetail } from "@/lib/queries/kpiInsentif";

interface AchievementSchemaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editSchema?: AchievementSchemaRow | null;
}

type TierFormRow = {
  id?: string;
  label: string;
  lowerBound: string;
  upperBound: string;
  lowerInclusive: boolean;
  upperInclusive: boolean;
  actionType: "bonus" | "deduction" | "warning" | "under_performance";
  dealingBonus: string;
  omsetBonus: string;
  homebaseBonus: string;
  deductionPct: string;
};

type FormValues = {
  name: string;
  description: string;
  businessRole: "sales" | "manager";
  isDraft: boolean;
  gatingMinIndicators: string;
  tiers: TierFormRow[];
};

const DEFAULT_TIER: TierFormRow = {
  label: "",
  lowerBound: "0",
  upperBound: "100",
  lowerInclusive: true,
  upperInclusive: false,
  actionType: "bonus",
  dealingBonus: "",
  omsetBonus: "",
  homebaseBonus: "",
  deductionPct: "",
};

const DEFAULT_VALUES: FormValues = {
  name: "",
  description: "",
  businessRole: "sales",
  isDraft: true,
  gatingMinIndicators: "",
  tiers: [{ ...DEFAULT_TIER }],
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  bonus: "Bonus",
  deduction: "Potongan",
  warning: "Surat Peringatan",
  under_performance: "Under Performance",
};

type DetailTier = NonNullable<AchievementSchemaDetail>["tiers"][number];

function tierToFormRow(tier: DetailTier): TierFormRow {
  return {
    id: tier.id,
    label: tier.label,
    lowerBound: tier.lowerBound != null ? String(tier.lowerBound) : "0",
    upperBound: tier.upperBound != null ? String(tier.upperBound) : "",
    lowerInclusive: tier.lowerInclusive,
    upperInclusive: tier.upperInclusive,
    actionType: tier.actionType as TierFormRow["actionType"],
    dealingBonus: tier.dealingBonus != null ? String(tier.dealingBonus) : "",
    omsetBonus: tier.omsetBonus != null ? String(tier.omsetBonus) : "",
    homebaseBonus: tier.homebaseBonus != null ? String(tier.homebaseBonus) : "",
    deductionPct: tier.deductionPct != null ? String(tier.deductionPct) : "",
  };
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
      {text}
    </p>
  );
}

export function AchievementSchemaDrawer({
  isOpen,
  onClose,
  editSchema,
}: AchievementSchemaDrawerProps) {
  const isEditMode = editSchema != null;
  const createMutation = useCreateAchievementSchema();
  const upsertMutation = useUpsertSchemaWithTiers();
  const isSaving = createMutation.isPending || upsertMutation.isPending;

  // Fetch full schema with tiers when editing
  const { data: schemaDetail } = useAchievementSchemaById(
    isEditMode && isOpen ? editSchema?.id : undefined
  );

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: tierFields, append, remove, swap } = useFieldArray({
    control,
    name: "tiers",
  });

  const businessRole = watch("businessRole");
  const isDraft = watch("isDraft");

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && editSchema) {
      reset({
        name: editSchema.name,
        description: editSchema.description ?? "",
        businessRole: editSchema.businessRole as "sales" | "manager",
        isDraft: editSchema.isDraft,
        gatingMinIndicators:
          editSchema.gatingMinIndicators != null
            ? String(editSchema.gatingMinIndicators)
            : "",
        tiers: schemaDetail?.tiers?.length
          ? schemaDetail.tiers.map(tierToFormRow)
          : [{ ...DEFAULT_TIER }],
      });
    } else {
      reset(DEFAULT_VALUES);
    }
  }, [isOpen, isEditMode, editSchema, schemaDetail, reset]);

  function handleClose() {
    reset(DEFAULT_VALUES);
    onClose();
  }

  function addTier() {
    append({
      ...DEFAULT_TIER,
      label: `Tier ${tierFields.length + 1}`,
    });
  }

  function moveTier(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tierFields.length) return;
    swap(index, targetIndex);
  }

  async function onSubmit(values: FormValues) {
    // Step 1: create or update the schema itself
    const schemaPayload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      businessRole: values.businessRole,
      isDraft: values.isDraft,
      gatingMinIndicators:
        values.businessRole === "manager" && values.gatingMinIndicators !== ""
          ? parseInt(values.gatingMinIndicators, 10)
          : null,
    };

    let schemaId: string;

    if (isEditMode && editSchema) {
      // For edit mode, first call createAchievementSchema through upsertSchemaWithTiers
      // which handles both schema + tiers atomically.
      // Actually the server action upsertSchemaWithTiers only updates tiers.
      // So we need to update schema first, then tiers.
      // The architecture supports: createMutation for schema update isn't exposed directly
      // for updates via upsertTiers. We'll create the schema update via updateAchievementSchema
      // which is not a hook we have — let's call upsertSchemaWithTiers for both.
      // Per actions/kpiInsentif.ts: upsertSchemaWithTiers only takes achievementSchemaId + tiers.
      // We need to call updateAchievementSchema separately, but we don't have that hook exported yet.
      // Use createAchievementSchema mutation path (which wraps the create action) for creates,
      // and for edits build a minimal approach: create the schema and then tiers separately.
      schemaId = editSchema.id;

      // We don't have updateAchievementSchema exported in hooks (only create), so call directly
      // through a fetch workaround is wrong. Let's import it inline approach:
      // Actually we can call upsertSchemaWithTiers which handles tiers, and handle schema header
      // by accepting that in edit mode, the schema meta isn't changed via this drawer for now.
      // Better: we create a full schema+tiers in one call. For edit, we call updateAchievementSchema
      // from actions directly.
      const schemaResult = await updateAchievementSchema(schemaId, schemaPayload);
      if (!schemaResult.success) {
        toast.error(schemaResult.error ?? "Gagal memperbarui skema");
        return;
      }
    } else {
      const schemaResult = await createMutation.mutateAsync(schemaPayload);
      if (!schemaResult.success) {
        toast.error(schemaResult.error ?? "Gagal membuat skema");
        return;
      }
      schemaId = schemaResult.data!.id;
    }

    // Step 2: upsert tiers
    const tiersPayload = values.tiers.map((tier, idx) => ({
      sortOrder: idx,
      label: tier.label.trim() || `Tier ${idx + 1}`,
      lowerBound: tier.lowerBound || "0",
      upperBound: tier.upperBound || null,
      lowerInclusive: tier.lowerInclusive,
      upperInclusive: tier.upperInclusive,
      isDraftBounds: false,
      actionType: tier.actionType,
      dealingBonus: tier.actionType === "bonus" && tier.dealingBonus !== "" ? tier.dealingBonus : null,
      omsetBonus: tier.actionType === "bonus" && tier.omsetBonus !== "" ? tier.omsetBonus : null,
      homebaseBonus: tier.actionType === "bonus" && tier.homebaseBonus !== "" ? tier.homebaseBonus : null,
      deductionPct: tier.actionType === "deduction" && tier.deductionPct !== "" ? tier.deductionPct : null,
      isWarningFlag: tier.actionType === "warning",
    }));

    const tiersResult = await upsertMutation.mutateAsync({
      achievementSchemaId: schemaId,
      tiers: tiersPayload,
    });

    if (tiersResult.success) {
      toast.success(isEditMode ? "Skema berhasil diperbarui" : "Skema berhasil dibuat");
      handleClose();
    } else {
      toast.error(tiersResult.error ?? "Gagal menyimpan tier");
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit Skema Achievement" : "Tambah Skema Achievement"}
      maxWidth="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Draft watermark */}
          {isDraft && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border px-4 py-2.5">
              <InfoCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Skema ini berstatus <strong>Draft</strong> — tidak aktif untuk kalkulasi KPI
              </p>
            </div>
          )}

          {/* Schema Info */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Informasi Skema" />

            <div className="space-y-1.5">
              <Label htmlFor="as-name" className="text-sm font-medium">
                Nama Skema <span className="text-destructive">*</span>
              </Label>
              <Input
                id="as-name"
                placeholder="Contoh: Skema Sales Q1 2025"
                className="rounded-xl"
                {...register("name", { required: "Nama skema wajib diisi" })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="as-description" className="text-sm font-medium">
                Deskripsi
              </Label>
              <Textarea
                id="as-description"
                placeholder="Keterangan singkat tentang skema ini..."
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
                            className={[
                              "flex items-center justify-center py-2 text-xs font-semibold rounded-full transition-colors capitalize",
                              active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted text-muted-foreground hover:bg-accent",
                            ].join(" ")}
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
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex items-center gap-3 pt-1">
                  <Controller
                    control={control}
                    name="isDraft"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        id="as-isDraft"
                      />
                    )}
                  />
                  <Label htmlFor="as-isDraft" className="text-sm text-muted-foreground cursor-pointer">
                    {isDraft ? (
                      <Badge variant="outline" className="rounded-full text-xs bg-muted text-muted-foreground">
                        Draft
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full text-xs bg-primary/10 text-primary border-primary/30">
                        Aktif
                      </Badge>
                    )}
                  </Label>
                </div>
              </div>
            </div>

            {businessRole === "manager" && (
              <div className="space-y-1.5">
                <Label htmlFor="as-gating" className="text-sm font-medium">
                  Minimal Indikator Tercapai (Unlock Bonus)
                </Label>
                <Input
                  id="as-gating"
                  type="number"
                  min="1"
                  max="3"
                  placeholder="Contoh: 2"
                  className="rounded-xl"
                  {...register("gatingMinIndicators")}
                />
                <p className="text-xs text-muted-foreground">
                  Jumlah minimum indikator yang harus mencapai tier bonus untuk manager agar bonus terbuka
                </p>
              </div>
            )}
          </div>

          {/* Tier Editor */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <SectionLabel text={`Tier Bonus & Potongan (${tierFields.length})`} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5 text-xs h-7 px-3"
                onClick={addTier}
              >
                <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                Tambah Tier
              </Button>
            </div>

            {tierFields.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted-foreground">Belum ada tier. Klik &ldquo;Tambah Tier&rdquo; untuk memulai.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tierFields.map((tierField, index) => (
                  <TierRow
                    key={tierField.id}
                    index={index}
                    totalTiers={tierFields.length}
                    control={control}
                    register={register}
                    watch={watch}
                    onRemove={() => remove(index)}
                    onMoveUp={() => moveTier(index, "up")}
                    onMoveDown={() => moveTier(index, "down")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border pt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-full"
            onClick={handleClose}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button type="submit" className="flex-1 rounded-full gap-1.5" disabled={isSaving}>
            {isEditMode ? (
              <>
                <Pen weight="BoldDuotone" className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </>
            ) : (
              <>
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                {isSaving ? "Menyimpan..." : "Buat Skema"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// ─── TierRow ──────────────────────────────────────────────────────────────────

interface TierRowProps {
  index: number;
  totalTiers: number;
  control: ReturnType<typeof useForm<FormValues>>["control"];
  register: ReturnType<typeof useForm<FormValues>>["register"];
  watch: ReturnType<typeof useForm<FormValues>>["watch"];
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function TierRow({
  index,
  totalTiers,
  control,
  register,
  watch,
  onRemove,
  onMoveUp,
  onMoveDown,
}: TierRowProps) {
  const actionType = watch(`tiers.${index}.actionType`);

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {index + 1}
          </span>
          <Input
            placeholder={`Tier ${index + 1}`}
            className="rounded-xl h-8 text-sm font-medium w-36 border-0 bg-transparent focus-visible:bg-background focus-visible:border"
            {...register(`tiers.${index}.label`)}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-background disabled:opacity-30"
          >
            <AltArrowUp weight="BoldDuotone" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalTiers - 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-background disabled:opacity-30"
          >
            <AltArrowDown weight="BoldDuotone" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
          >
            <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Separator />

      {/* Bounds */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Batas Bawah %</Label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              className="rounded-xl h-8 text-sm"
              {...register(`tiers.${index}.lowerBound`)}
            />
            <Controller
              control={control}
              name={`tiers.${index}.lowerInclusive`}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  title={field.value ? "Inklusif (≥)" : "Eksklusif (>)"}
                  className={[
                    "h-8 px-2 rounded-xl text-xs font-mono font-bold transition-colors border",
                    field.value
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted text-muted-foreground border-border",
                  ].join(" ")}
                >
                  {field.value ? "≥" : ">"}
                </button>
              )}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Batas Atas %</Label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="100"
              className="rounded-xl h-8 text-sm"
              {...register(`tiers.${index}.upperBound`)}
            />
            <Controller
              control={control}
              name={`tiers.${index}.upperInclusive`}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  title={field.value ? "Inklusif (≤)" : "Eksklusif (<)"}
                  className={[
                    "h-8 px-2 rounded-xl text-xs font-mono font-bold transition-colors border",
                    field.value
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted text-muted-foreground border-border",
                  ].join(" ")}
                >
                  {field.value ? "≤" : "<"}
                </button>
              )}
            />
          </div>
        </div>
      </div>

      {/* Action Type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipe Aksi</Label>
        <Controller
          control={control}
          name={`tiers.${index}.actionType`}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="rounded-xl h-8 text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bonus">Bonus</SelectItem>
                <SelectItem value="deduction">Potongan</SelectItem>
                <SelectItem value="warning">Surat Peringatan</SelectItem>
                <SelectItem value="under_performance">Under Performance</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Bonus fields */}
      {actionType === "bonus" && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bonus Dealing (Rp)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              className="rounded-xl h-8 text-sm"
              {...register(`tiers.${index}.dealingBonus`)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bonus Omset (Rp)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              className="rounded-xl h-8 text-sm"
              {...register(`tiers.${index}.omsetBonus`)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bonus Homebase (Rp)</Label>
            <Input
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              className="rounded-xl h-8 text-sm"
              {...register(`tiers.${index}.homebaseBonus`)}
            />
          </div>
        </div>
      )}

      {/* Deduction field */}
      {actionType === "deduction" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Persentase Potongan (%)
          </Label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0.00"
              className="rounded-xl h-8 text-sm pr-8"
              {...register(`tiers.${index}.deductionPct`)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>
      )}

      {/* Warning info */}
      {actionType === "warning" && (
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border px-3 py-2">
          <InfoCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">Surat Peringatan — flag internal, tidak ada nilai bonus/potongan</p>
        </div>
      )}

      {/* Under performance info */}
      {actionType === "under_performance" && (
        <div className="flex items-center gap-2 rounded-xl bg-muted border border-border px-3 py-2">
          <InfoCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">Under Performance — tidak ada bonus, capaian di bawah ambang batas</p>
        </div>
      )}
    </div>
  );
}
