"use client";

import { useEffect } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BitrixIdField } from "@/components/shared/BitrixIdField";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  createDailyActivitySchema,
  PROGRESS_STATUS_VALUES,
  type CreateDailyActivityInput,
} from "@/lib/validations/daily-activity";
import {
  useCreateDailyActivity,
  useUpdateDailyActivity,
} from "@/hooks/use-daily-activities";
import { PROGRESS_STATUS_LABELS } from "./progress-status";
import type { DailyActivityItem } from "@/lib/queries/daily-activity";
import type { SalesMiceProfile } from "@/lib/queries/bookings";
import type { DailyActivitySegmentOption } from "@/lib/queries/daily-activity";
import type { SourceOfInformationItem } from "@/lib/queries/source-of-information";

/** Normalize a Date/ISO value to a `YYYY-MM-DD` string for <input type="date">. */
function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function buildDefaults(item: DailyActivityItem | null): CreateDailyActivityInput {
  return {
    salesId: item?.salesId ?? "",
    activityDate: toDateInput(item?.activityDate) || toDateInput(new Date()),
    companyName: item?.companyName ?? "",
    segmentId: item?.segmentId ?? "",
    sourceOfInformationId: item?.sourceOfInformationId ?? "",
    sourceOfInformationDetail: item?.sourceOfInformationDetail ?? "",
    milestone: item?.milestone ?? "",
    progressStatus: item?.progressStatus ?? "COLD",
    bitrixId: item?.bitrixId ?? "",
    contactName: item?.contactName ?? "",
    phoneNumber: item?.phoneNumber ?? "",
    email: item?.email ?? "",
    location: item?.location ?? "",
    siteVisitAt: toDateInput(item?.siteVisitAt),
    notes: item?.notes ?? "",
  };
}

interface DailyActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: DailyActivityItem | null;
  salesProfiles: SalesMiceProfile[];
  segments: DailyActivitySegmentOption[];
  sources: SourceOfInformationItem[];
}

export function DailyActivityDrawer({
  isOpen,
  onClose,
  editingItem,
  salesProfiles,
  segments,
  sources,
}: DailyActivityDrawerProps) {
  const createMutation = useCreateDailyActivity();
  const updateMutation = useUpdateDailyActivity();
  const saving = createMutation.isPending || updateMutation.isPending;
  const { user } = useCurrentUser();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CreateDailyActivityInput>({
    resolver: zodResolver(createDailyActivitySchema),
    defaultValues: buildDefaults(editingItem),
  });

  // Re-seed the form whenever the drawer opens or the edit target changes.
  useEffect(() => {
    if (isOpen) reset(buildDefaults(editingItem));
  }, [isOpen, editingItem, reset]);

  const salesOptions = salesProfiles.map((s) => ({ id: s.id, name: s.fullName ?? "Tanpa nama" }));
  const segmentOptions = segments.map((s) => ({ id: s.id, name: s.name }));
  const sourceOptions = sources.map((s) => ({ id: s.id, name: s.name }));

  // Sales auto-detect: salesProfiles is sourced from getSalesMiceProfiles()
  // (role "sales-mice" only — Daily Activity is a sales-mice-scoped feature).
  // If the logged-in user is in that list, lock the sales field to themselves;
  // manager-mice/direktur-sales pick freely.
  const currentUserIsSalesMice = !!user && salesProfiles.some((s) => s.id === user.profileId);

  // useWatch (subscription hook) instead of form.watch() — the React Compiler
  // flags watch() as an incompatible-library call it can't safely memoize.
  const watchedSalesId = useWatch({ control, name: "salesId" });
  const watchedSourceId = useWatch({ control, name: "sourceOfInformationId" });
  const watchedBitrixId = useWatch({ control, name: "bitrixId" });
  const isBitrixSource =
    sourceOptions.find((o) => o.id === watchedSourceId)?.name.toLowerCase().includes("bitrix") ?? false;
  // Name shown in the locked sales field — resolves from the current salesId so
  // edit mode displays the record's actual sales (not just the logged-in user).
  const lockedSalesName =
    salesProfiles.find((s) => s.id === watchedSalesId)?.fullName ??
    (currentUserIsSalesMice ? (user?.name ?? "—") : "—");

  // Force-assign the sales field to the logged-in sales-mice user on CREATE only.
  // Guarded to !editingItem so opening an existing record for edit never silently
  // reassigns its original sales attribution.
  useEffect(() => {
    if (isOpen && !editingItem && currentUserIsSalesMice && user?.profileId) {
      setValue("salesId", user.profileId);
    }
  }, [isOpen, editingItem, currentUserIsSalesMice, user?.profileId, setValue]);

  async function onSubmit(values: CreateDailyActivityInput): Promise<void> {
    if (isBitrixSource && !values.bitrixId?.trim()) {
      setError("bitrixId", { message: "Bitrix ID wajib diisi jika sumber informasi adalah Bitrix." });
      toast.error("Bitrix ID wajib diisi jika sumber informasi adalah Bitrix.");
      return;
    }
    if (editingItem) {
      const result = await updateMutation.mutateAsync({
        id: editingItem.id,
        data: { ...values, id: editingItem.id },
      });
      if (!result.success) {
        toast.error(result.error ?? "Gagal memperbarui daily activity.");
        return;
      }
      toast.success("Daily activity berhasil diperbarui.");
    } else {
      const result = await createMutation.mutateAsync(values);
      if (!result.success) {
        toast.error(result.error ?? "Gagal menyimpan daily activity.");
        return;
      }
      toast.success("Daily activity berhasil ditambahkan.");
    }
    onClose();
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? "Edit Daily Activity" : "Tambah Daily Activity"}
      maxWidth="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-2 pb-4">
        {/* Nama perusahaan */}
        <div className="space-y-1.5">
          <Label htmlFor="da-company">Nama Perusahaan / Instansi</Label>
          <Input
            id="da-company"
            placeholder="Contoh: PT Sumber Makmur"
            {...register("companyName")}
          />
          {errors.companyName && (
            <p className="text-xs text-destructive">{errors.companyName.message}</p>
          )}
        </div>

        {/* Nama kontak */}
        <div className="space-y-1.5">
          <Label htmlFor="da-contact">Nama Kontak</Label>
          <Input id="da-contact" placeholder="Nama PIC" {...register("contactName")} />
          {errors.contactName && (
            <p className="text-xs text-destructive">{errors.contactName.message}</p>
          )}
        </div>

        {/* No. Telepon */}
        <div className="space-y-1.5">
          <Label htmlFor="da-phone">No. Telepon</Label>
          <Controller
            control={control}
            name="phoneNumber"
            render={({ field }) => (
              <PhoneInput id="da-phone" value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
          {errors.phoneNumber && (
            <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="da-email">Email</Label>
          <Input id="da-email" type="email" placeholder="nama@perusahaan.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {/* Lokasi / Link */}
        <div className="space-y-1.5">
          <Label htmlFor="da-location">Lokasi / Link</Label>
          <Input
            id="da-location"
            placeholder="Kota / alamat, atau link Google Maps / Zoom"
            {...register("location")}
          />
          {errors.location && (
            <p className="text-xs text-destructive">{errors.location.message}</p>
          )}
        </div>

        {/* Tanggal site visit */}
        <div className="space-y-1.5">
          <Label htmlFor="da-site-visit">Tanggal Site Visit</Label>
          <Input id="da-site-visit" type="date" {...register("siteVisitAt")} />
          {errors.siteVisitAt && (
            <p className="text-xs text-destructive">{errors.siteVisitAt.message}</p>
          )}
        </div>

        {/* Segment */}
        <div className="space-y-1.5">
          <Label>
            Segment <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name="segmentId"
            render={({ field }) => (
              <SearchableSelect
                options={segmentOptions}
                value={field.value}
                onChange={field.onChange}
                placeholder="Pilih segment..."
                searchPlaceholder="Cari segment..."
              />
            )}
          />
          {errors.segmentId && (
            <p className="text-xs text-destructive">{errors.segmentId.message}</p>
          )}
        </div>

        {/* Sumber informasi */}
        <div className="space-y-1.5">
          <Label>
            Sumber Informasi <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name="sourceOfInformationId"
            render={({ field }) => (
              <SearchableSelect
                options={sourceOptions}
                value={field.value}
                onChange={(id) => {
                  field.onChange(id);
                  const stillBitrix =
                    sourceOptions.find((o) => o.id === id)?.name.toLowerCase().includes("bitrix") ?? false;
                  if (!stillBitrix) setValue("bitrixId", "");
                }}
                placeholder="Pilih sumber informasi..."
                searchPlaceholder="Cari sumber..."
              />
            )}
          />
          {errors.sourceOfInformationId && (
            <p className="text-xs text-destructive">{errors.sourceOfInformationId.message}</p>
          )}
        </div>

        {/* Bitrix ID — muncul & wajib kalau sumber informasi = Bitrix */}
        {isBitrixSource && (
          <div className="space-y-1.5">
            <Label>
              Bitrix ID <span className="text-destructive">*</span>
            </Label>
            <BitrixIdField
              value={watchedBitrixId ?? ""}
              onChange={(id) => {
                setValue("bitrixId", id);
                clearErrors("bitrixId");
              }}
            />
            {errors.bitrixId && <p className="text-xs text-destructive">{errors.bitrixId.message}</p>}
          </div>
        )}

        {/* Detail sumber */}
        <div className="space-y-1.5">
          <Label htmlFor="da-source-detail">Detail Sumber</Label>
          <Textarea
            id="da-source-detail"
            rows={2}
            placeholder="Contoh: nama yang mereferensikan, catatan tambahan"
            {...register("sourceOfInformationDetail")}
          />
          {errors.sourceOfInformationDetail && (
            <p className="text-xs text-destructive">{errors.sourceOfInformationDetail.message}</p>
          )}
        </div>

        {/* Progress status */}
        <div className="space-y-1.5">
          <Label>
            Progress <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name="progressStatus"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih progress..." />
                </SelectTrigger>
                <SelectContent>
                  {PROGRESS_STATUS_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PROGRESS_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.progressStatus && (
            <p className="text-xs text-destructive">{errors.progressStatus.message}</p>
          )}
        </div>

        {/* Tanggal aktivitas */}
        <div className="space-y-1.5">
          <Label htmlFor="da-activity-date">
            Tanggal Aktivitas <span className="text-destructive">*</span>
          </Label>
          <Input id="da-activity-date" type="date" {...register("activityDate")} />
          {errors.activityDate && (
            <p className="text-xs text-destructive">{errors.activityDate.message}</p>
          )}
        </div>

        {/* Milestone */}
        <div className="space-y-1.5">
          <Label htmlFor="da-milestone">
            Milestone <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="da-milestone"
            rows={2}
            placeholder="Progres / hasil aktivitas terakhir"
            {...register("milestone")}
          />
          {errors.milestone && (
            <p className="text-xs text-destructive">{errors.milestone.message}</p>
          )}
        </div>

        {/* Sales */}
        <div className="space-y-1.5">
          <Label>
            Sales <span className="text-destructive">*</span>
          </Label>
          {currentUserIsSalesMice ? (
            <>
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground cursor-not-allowed select-none">
                {lockedSalesName}
              </div>
              <p className="text-xs text-muted-foreground">
                Aktivitas ini akan tercatat atas nama Anda.
              </p>
            </>
          ) : (
            <Controller
              control={control}
              name="salesId"
              render={({ field }) => (
                <SearchableSelect
                  options={salesOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Pilih sales..."
                  searchPlaceholder="Cari sales..."
                />
              )}
            />
          )}
          {errors.salesId && <p className="text-xs text-destructive">{errors.salesId.message}</p>}
        </div>

        {/* Catatan */}
        <div className="space-y-1.5">
          <Label htmlFor="da-notes">Catatan</Label>
          <Textarea
            id="da-notes"
            rows={3}
            placeholder="Catatan tambahan (opsional)"
            {...register("notes")}
          />
          {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl cursor-pointer"
          >
            Batal
          </Button>
          <Button type="submit" disabled={saving} className="flex-1 rounded-xl cursor-pointer">
            {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
