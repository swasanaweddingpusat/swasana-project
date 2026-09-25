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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateAchievementSchema,
  useUpdateAchievementSchema,
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
  stagedPaymentEnabled: boolean;
  stage1PayoutPct: string;
  stage2PayoutPct: string;
  stage1MinClientPayment: string;
  stage2PayoutMonthOffset: string;
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
  stagedPaymentEnabled: false,
  stage1PayoutPct: "",
  stage2PayoutPct: "",
  stage1MinClientPayment: "30000000",
  stage2PayoutMonthOffset: "1",
  tiers: [{ ...DEFAULT_TIER }],
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
  const updateMutation = useUpdateAchievementSchema();
  const upsertMutation = useUpsertSchemaWithTiers();
  const isSaving = createMutation.isPending || updateMutation.isPending || upsertMutation.isPending;

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
  const stagedPaymentEnabled = watch("stagedPaymentEnabled");
  const stage1PayoutPct = watch("stage1PayoutPct");
  const stage2PayoutPct = watch("stage2PayoutPct");
  const stagePctSum = (parseFloat(stage1PayoutPct || "0") || 0) + (parseFloat(stage2PayoutPct || "0") || 0);
  const isStagePctSumValid = Math.abs(stagePctSum - 100) < 0.01;

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
        stagedPaymentEnabled: editSchema.stagedPaymentEnabled ?? false,
        stage1PayoutPct:
          editSchema.stage1PayoutPct != null ? String(editSchema.stage1PayoutPct) : "",
        stage2PayoutPct:
          editSchema.stage2PayoutPct != null ? String(editSchema.stage2PayoutPct) : "",
        stage1MinClientPayment:
          editSchema.stage1MinClientPayment != null
            ? String(editSchema.stage1MinClientPayment)
            : "30000000",
        stage2PayoutMonthOffset:
          editSchema.stage2PayoutMonthOffset != null
            ? String(editSchema.stage2PayoutMonthOffset)
            : "1",
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
      stagedPaymentEnabled: values.stagedPaymentEnabled,
      stage1PayoutPct:
        values.stagedPaymentEnabled && values.stage1PayoutPct !== ""
          ? values.stage1PayoutPct
          : null,
      stage2PayoutPct:
        values.stagedPaymentEnabled && values.stage2PayoutPct !== ""
          ? values.stage2PayoutPct
          : null,
      stage1MinClientPayment:
        values.stagedPaymentEnabled && values.stage1MinClientPayment !== ""
          ? parseInt(values.stage1MinClientPayment, 10)
          : null,
      stage2PayoutMonthOffset:
        values.stagedPaymentEnabled && values.stage2PayoutMonthOffset !== ""
          ? parseInt(values.stage2PayoutMonthOffset, 10)
          : null,
    };

    let schemaId: string;

    if (isEditMode && editSchema) {
      schemaId = editSchema.id;
      const schemaResult = await updateMutation.mutateAsync({ id: schemaId, data: schemaPayload });
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
      maxWidth="sm:max-w-4xl"
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

          {/* Staged Payment */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Skema Pembayaran" />

            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="stagedPaymentEnabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="as-staged-enabled"
                  />
                )}
              />
              <Label htmlFor="as-staged-enabled" className="text-sm text-muted-foreground cursor-pointer">
                Aktifkan pembayaran bertahap (Tahap 1 / Tahap 2)
              </Label>
            </div>

            {stagedPaymentEnabled && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="as-stage1-pct" className="text-sm font-medium">
                      Tahap 1 (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id="as-stage1-pct"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0.00"
                        className="rounded-xl pr-8"
                        {...register("stage1PayoutPct")}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="as-stage2-pct" className="text-sm font-medium">
                      Tahap 2 (%)
                    </Label>
                    <div className="relative">
                      <Input
                        id="as-stage2-pct"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0.00"
                        className="rounded-xl pr-8"
                        {...register("stage2PayoutPct")}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                </div>
                <p className={isStagePctSumValid ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                  Total: {stagePctSum.toFixed(2)}%
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="as-stage1-min" className="text-sm font-medium">
                    Minimal Pembayaran Client (Tahap 1)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="as-stage1-min"
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="30000000"
                      className="rounded-xl pl-9"
                      {...register("stage1MinClientPayment")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="as-stage2-offset" className="text-sm font-medium">
                    Jarak Bulan Tahap 2
                  </Label>
                  <Input
                    id="as-stage2-offset"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    className="rounded-xl"
                    {...register("stage2PayoutMonthOffset")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Jumlah bulan setelah Tahap 1 sebelum Tahap 2 dibayarkan
                  </p>
                </div>
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
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Label</TableHead>
                      <TableHead>Batas</TableHead>
                      <TableHead>Tipe Aksi</TableHead>
                      <TableHead>Bonus Dealing</TableHead>
                      <TableHead>Bonus Omset</TableHead>
                      <TableHead>Bonus Homebase</TableHead>
                      <TableHead>Potongan (%)</TableHead>
                      <TableHead className="pr-4 text-right">Kontrol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tierFields.map((tierField, index) => (
                      <TierTableRow
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
                  </TableBody>
                </Table>
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

// ─── TierTableRow ───────────────────────────────────────────────────────────────

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

function TierTableRow({
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
    <TableRow>
      {/* Label */}
      <TableCell className="pl-4 align-top">
        <div className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {index + 1}
          </span>
          <Input
            placeholder={`Tier ${index + 1}`}
            className="rounded-xl h-8 text-sm font-medium w-28"
            {...register(`tiers.${index}.label`)}
          />
        </div>
      </TableCell>

      {/* Batas (lower - upper bound) */}
      <TableCell className="align-top whitespace-normal">
        <div className="flex flex-wrap items-center gap-1">
          <Controller
            control={control}
            name={`tiers.${index}.lowerInclusive`}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                title={field.value ? "Inklusif (≥)" : "Eksklusif (>)"}
                className={[
                  "h-8 shrink-0 px-1.5 rounded-lg text-xs font-mono font-bold transition-colors border",
                  field.value
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border",
                ].join(" ")}
              >
                {field.value ? "≥" : ">"}
              </button>
            )}
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            className="rounded-xl h-8 text-sm w-16"
            {...register(`tiers.${index}.lowerBound`)}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="100"
            className="rounded-xl h-8 text-sm w-16"
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
                  "h-8 shrink-0 px-1.5 rounded-lg text-xs font-mono font-bold transition-colors border",
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
      </TableCell>

      {/* Action Type */}
      <TableCell className="align-top">
        <Controller
          control={control}
          name={`tiers.${index}.actionType`}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="rounded-xl h-8 text-xs w-36">
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
      </TableCell>

      {/* Bonus Dealing */}
      <TableCell className="align-top">
        {actionType === "bonus" ? (
          <Input
            type="number"
            min="0"
            step="1000"
            placeholder="0"
            className="rounded-xl h-8 text-sm w-24"
            {...register(`tiers.${index}.dealingBonus`)}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Bonus Omset */}
      <TableCell className="align-top">
        {actionType === "bonus" ? (
          <Input
            type="number"
            min="0"
            step="1000"
            placeholder="0"
            className="rounded-xl h-8 text-sm w-24"
            {...register(`tiers.${index}.omsetBonus`)}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Bonus Homebase */}
      <TableCell className="align-top">
        {actionType === "bonus" ? (
          <Input
            type="number"
            min="0"
            step="1000"
            placeholder="0"
            className="rounded-xl h-8 text-sm w-24"
            {...register(`tiers.${index}.homebaseBonus`)}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Potongan (%) */}
      <TableCell className="align-top">
        {actionType === "deduction" ? (
          <div className="relative w-20">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0.00"
              className="rounded-xl h-8 text-sm pr-6"
              {...register(`tiers.${index}.deductionPct`)}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              %
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Kontrol (reorder / delete) */}
      <TableCell className="pr-4 align-top">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-30"
          >
            <AltArrowUp weight="BoldDuotone" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalTiers - 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-30"
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
      </TableCell>
    </TableRow>
  );
}
