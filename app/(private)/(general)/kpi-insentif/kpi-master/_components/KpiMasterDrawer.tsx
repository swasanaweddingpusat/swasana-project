"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import {
  AddCircle,
  Pen,
  InfoCircle,
  Target,
  ChartSquare,
} from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTargetItems,
  useAchievementSchemas,
  useCreateKpiMaster,
  useUpdateKpiMaster,
} from "@/hooks/useKpiInsentif";
import { formatRupiah } from "@/lib/utils";
import type { KpiMasterRow, TargetItemRow, AchievementSchemaRow } from "@/lib/queries/kpiInsentif";

interface KpiMasterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editMaster?: KpiMasterRow | null;
}

type FormValues = {
  name: string;
  description: string;
  businessRole: "sales" | "manager";
  month: string;
  isDraft: boolean;
  targetItemId: string;
  achievementSchemaId: string;
};

const DEFAULT_VALUES: FormValues = {
  name: "",
  description: "",
  businessRole: "sales",
  month: "",
  isDraft: true,
  targetItemId: "",
  achievementSchemaId: "",
};

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
      {text}
    </p>
  );
}

function TargetItemSummaryCard({ item }: { item: TargetItemRow }) {
  function fmt(v: unknown): string {
    if (v == null) return "—";
    if (item.type === "qty") return `${v} qty`;
    return formatRupiah(Number(v));
  }

  const mainTarget = item.type === "qty"
    ? (item.qty != null ? `${item.qty} qty` : "—")
    : (item.price != null ? formatRupiah(Number(item.price)) : "—");

  const hasReguler = item.type === "qty" ? item.qtyReguler != null : item.priceReguler != null;
  const hasHadjatan = item.type === "qty" ? item.qtyHadjatan != null : item.priceHadjatan != null;

  return (
    <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Target weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Ringkasan Target
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Target Total</span>
          <span className="font-semibold font-mono">{mainTarget}</span>
        </div>
        {(hasReguler || hasHadjatan) && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Reguler</span>
              <span className="font-mono text-muted-foreground">
                {item.type === "qty" ? fmt(item.qtyReguler) : fmt(item.priceReguler)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Hadjatan</span>
              <span className="font-mono text-muted-foreground">
                {item.type === "qty" ? fmt(item.qtyHadjatan) : fmt(item.priceHadjatan)}
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5 pt-0.5">
          <Badge variant="outline" className="rounded-full text-xs capitalize">
            {item.indicatorType}
          </Badge>
          <Badge variant="outline" className="rounded-full text-xs">
            {item.type === "qty" ? "Qty" : "Harga"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function SchemaSummaryCard({ schema }: { schema: AchievementSchemaRow }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ChartSquare weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Ringkasan Skema
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          {schema.isDraft ? (
            <Badge variant="outline" className="rounded-full text-xs bg-muted text-muted-foreground">
              Draft
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full text-xs bg-primary/10 text-primary border-primary/30">
              Aktif
            </Badge>
          )}
        </div>
        {schema.businessRole === "manager" && schema.gatingMinIndicators != null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Gating</span>
            <span className="text-muted-foreground">Min. {schema.gatingMinIndicators} indikator</span>
          </div>
        )}
        {schema.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{schema.description}</p>
        )}
      </div>
    </div>
  );
}

export function KpiMasterDrawer({ isOpen, onClose, editMaster }: KpiMasterDrawerProps) {
  const isEditMode = editMaster != null;
  const createMutation = useCreateKpiMaster();
  const updateMutation = useUpdateKpiMaster();
  const isSaving = createMutation.isPending || updateMutation.isPending;

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

  const businessRole = watch("businessRole");
  const targetItemId = watch("targetItemId");
  const achievementSchemaId = watch("achievementSchemaId");
  const isDraft = watch("isDraft");

  // Fetch target items
  const { data: targetItems = [] } = useTargetItems();

  // Fetch schemas filtered by role
  const { data: schemas = [] } = useAchievementSchemas(businessRole);

  const selectedTargetItem = targetItems.find((t) => t.id === targetItemId) ?? null;
  const selectedSchema = schemas.find((s) => s.id === achievementSchemaId) ?? null;

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && editMaster) {
      const d = new Date(editMaster.month);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      reset({
        name: editMaster.name,
        description: editMaster.description ?? "",
        businessRole: editMaster.businessRole as "sales" | "manager",
        month: monthStr,
        isDraft: editMaster.isDraft,
        targetItemId: editMaster.targetItemId,
        achievementSchemaId: editMaster.achievementSchemaId,
      });
    } else {
      reset(DEFAULT_VALUES);
    }
  }, [isOpen, isEditMode, editMaster, reset]);

  function handleClose() {
    reset(DEFAULT_VALUES);
    onClose();
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      businessRole: values.businessRole,
      month: values.month ? new Date(`${values.month}-01`) : undefined,
      isDraft: values.isDraft,
      targetItemId: values.targetItemId,
      achievementSchemaId: values.achievementSchemaId,
    };

    if (isEditMode && editMaster) {
      const result = await updateMutation.mutateAsync({ id: editMaster.id, data: payload });
      if (result.success) {
        toast.success("KPI Master berhasil diperbarui");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui KPI Master");
      }
    } else {
      const result = await createMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("KPI Master berhasil ditambahkan");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal menambahkan KPI Master");
      }
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit KPI Master" : "Tambah KPI Master"}
      maxWidth="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Draft notice */}
          {isDraft && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border px-4 py-2.5">
              <InfoCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                KPI Master ini berstatus <strong>Draft</strong> — tidak digunakan untuk kalkulasi
              </p>
            </div>
          )}

          {/* Info Section */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Informasi KPI Master" />

            <div className="space-y-1.5">
              <Label htmlFor="km-name" className="text-sm font-medium">
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input
                id="km-name"
                placeholder="Contoh: KPI Sales Januari 2025"
                className="rounded-xl"
                {...register("name", { required: "Nama wajib diisi" })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="km-description" className="text-sm font-medium">
                Deskripsi
              </Label>
              <Textarea
                id="km-description"
                placeholder="Keterangan singkat..."
                className="rounded-xl min-h-14 resize-none"
                {...register("description")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="km-month" className="text-sm font-medium">
                  Bulan <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="km-month"
                  type="month"
                  className="rounded-xl"
                  {...register("month", { required: "Bulan wajib diisi" })}
                />
                {errors.month && (
                  <p className="text-xs text-destructive">{errors.month.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Controller
                control={control}
                name="isDraft"
                render={({ field }) => (
                  <Switch
                    id="km-isDraft"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="km-isDraft" className="text-sm cursor-pointer">
                Simpan sebagai draft{" "}
                <span className="text-muted-foreground">(tidak aktif untuk kalkulasi)</span>
              </Label>
            </div>
          </div>

          {/* Target Item */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Target Item" />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Target Item <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="targetItemId"
                rules={{ required: "Target item wajib dipilih" }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl w-full">
                      <SelectValue placeholder="Pilih target item" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetItems.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          Belum ada target item
                        </div>
                      ) : (
                        targetItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.indicatorType})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.targetItemId && (
                <p className="text-xs text-destructive">{errors.targetItemId.message}</p>
              )}
            </div>

            {selectedTargetItem && (
              <TargetItemSummaryCard item={selectedTargetItem} />
            )}
          </div>

          {/* Achievement Schema */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Skema Achievement" />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Skema Achievement <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="achievementSchemaId"
                rules={{ required: "Skema achievement wajib dipilih" }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl w-full">
                      <SelectValue
                        placeholder={
                          schemas.length === 0
                            ? `Belum ada skema untuk role ${businessRole}`
                            : "Pilih skema achievement"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {schemas.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          Belum ada skema untuk role {businessRole}
                        </div>
                      ) : (
                        schemas.map((schema) => (
                          <SelectItem key={schema.id} value={schema.id}>
                            <div className="flex items-center gap-2">
                              <span>{schema.name}</span>
                              {schema.isDraft && (
                                <span className="text-xs text-muted-foreground">(Draft)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.achievementSchemaId && (
                <p className="text-xs text-destructive">{errors.achievementSchemaId.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Hanya menampilkan skema untuk role <strong>{businessRole}</strong>
              </p>
            </div>

            {selectedSchema && (
              <SchemaSummaryCard schema={selectedSchema} />
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
                {isSaving ? "Menyimpan..." : "Buat KPI Master"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
