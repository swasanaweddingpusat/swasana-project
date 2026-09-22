"use client";

import { useEffect, useRef } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function SectionLabel({ text, icon: Icon }: { text: string; icon: typeof Target }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon weight="BoldDuotone" className="h-4 w-4" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{text}</p>
    </div>
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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const businessRole = watch("businessRole");
  const previousBusinessRoleRef = useRef<FormValues["businessRole"] | null>(null);
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
      previousBusinessRoleRef.current = editMaster.businessRole as "sales" | "manager";
    } else {
      reset(DEFAULT_VALUES);
      previousBusinessRoleRef.current = DEFAULT_VALUES.businessRole;
    }
  }, [isOpen, isEditMode, editMaster, reset]);

  // Achievement schemas are scoped to businessRole (useAchievementSchemas(businessRole)).
  // If the user switches business role after picking a schema, the previously selected
  // achievementSchemaId may belong to a schema from the old role and is no longer valid —
  // clear it so a mismatched schema can't be silently submitted.
  useEffect(() => {
    if (!isOpen) return;
    if (previousBusinessRoleRef.current !== null && previousBusinessRoleRef.current !== businessRole) {
      setValue("achievementSchemaId", "", { shouldValidate: false });
    }
    previousBusinessRoleRef.current = businessRole;
  }, [businessRole, isOpen, setValue]);

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
      maxWidth="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col gap-5">
        <div className="flex-1 space-y-5 overflow-y-auto pb-2 pr-1">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isEditMode ? "Perbarui konfigurasi KPI" : "Bangun konfigurasi KPI baru"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Hubungkan role, periode, target, dan skema achievement dalam satu konfigurasi.
                </p>
              </div>
              <Badge variant={isDraft ? "outline" : "default"} className="shrink-0 rounded-full">
                {isDraft ? "Draft" : "Aktif"}
              </Badge>
            </div>
          </div>

          {/* Draft notice */}
          {isDraft && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
              <InfoCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                KPI Master ini berstatus <strong>Draft</strong> — tidak digunakan untuk kalkulasi
              </p>
            </div>
          )}

          {/* Info Section */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
            <SectionLabel text="Informasi KPI Master" icon={InfoCircle} />

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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Business Role <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="businessRole"
                  render={({ field }) => (
                    <Tabs value={field.value} onValueChange={field.onChange}>
                      <TabsList
                        variant="line"
                        className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0"
                      >
                        <TabsTrigger
                          value="sales"
                          className="h-auto flex-1 rounded-none border-0 border-b border-b-transparent -mb-px bg-transparent px-3 py-2 text-xs font-semibold text-muted-foreground shadow-none transition-colors after:hidden hover:border-b-border hover:text-foreground data-active:border-b-primary data-active:bg-transparent data-active:text-foreground data-active:shadow-none"
                        >
                          Sales
                        </TabsTrigger>
                        <TabsTrigger
                          value="manager"
                          className="h-auto flex-1 rounded-none border-0 border-b border-b-transparent -mb-px bg-transparent px-3 py-2 text-xs font-semibold text-muted-foreground shadow-none transition-colors after:hidden hover:border-b-border hover:text-foreground data-active:border-b-primary data-active:bg-transparent data-active:text-foreground data-active:shadow-none"
                        >
                          Manager
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
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
          </div>

          {/* Target Item */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
            <SectionLabel text="Target Item" icon={Target} />

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
          </div>

          {/* Achievement Schema */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="space-y-5">
            <SectionLabel text="Skema Achievement" icon={ChartSquare} />

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
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-background pt-4">
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
