"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import {
  AddCircle,
  Pen,
} from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTargetItem, useUpdateTargetItem } from "@/hooks/useKpiInsentif";
import type { TargetItemRow } from "@/lib/queries/kpiInsentif";
import { SectionLabel } from "../../_components/SectionLabel";

interface TargetItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: TargetItemRow | null;
}

type EventCategoryOption = "none" | "WEDDINGS" | "MICE";

type FormValues = {
  name: string;
  dealingQty: string;
  dealingQtyReguler: string;
  dealingQtyHadjatan: string;
  omsetPrice: string;
  omsetPriceReguler: string;
  omsetPriceHadjatan: string;
  homebaseQty: string;
  homebaseQtyReguler: string;
  homebaseQtyHadjatan: string;
  regulerCategory: EventCategoryOption;
  hadjatanCategory: EventCategoryOption;
};

const DEFAULT_VALUES: FormValues = {
  name: "",
  dealingQty: "",
  dealingQtyReguler: "",
  dealingQtyHadjatan: "",
  omsetPrice: "",
  omsetPriceReguler: "",
  omsetPriceHadjatan: "",
  homebaseQty: "",
  homebaseQtyReguler: "",
  homebaseQtyHadjatan: "",
  regulerCategory: "none",
  hadjatanCategory: "none",
};

function toIntOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toDecimalStringOrNull(value: string): string | null {
  if (value.trim() === "") return null;
  return value;
}

export function TargetItemDrawer({ isOpen, onClose, editItem }: TargetItemDrawerProps) {
  const isEditMode = editItem != null;
  const createMutation = useCreateTargetItem();
  const updateMutation = useUpdateTargetItem();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && editItem) {
      reset({
        name: editItem.name,
        dealingQty: editItem.dealingQty != null ? String(editItem.dealingQty) : "",
        dealingQtyReguler:
          editItem.dealingQtyReguler != null ? String(editItem.dealingQtyReguler) : "",
        dealingQtyHadjatan:
          editItem.dealingQtyHadjatan != null ? String(editItem.dealingQtyHadjatan) : "",
        omsetPrice: editItem.omsetPrice != null ? String(editItem.omsetPrice) : "",
        omsetPriceReguler:
          editItem.omsetPriceReguler != null ? String(editItem.omsetPriceReguler) : "",
        omsetPriceHadjatan:
          editItem.omsetPriceHadjatan != null ? String(editItem.omsetPriceHadjatan) : "",
        homebaseQty: editItem.homebaseQty != null ? String(editItem.homebaseQty) : "",
        homebaseQtyReguler:
          editItem.homebaseQtyReguler != null ? String(editItem.homebaseQtyReguler) : "",
        homebaseQtyHadjatan:
          editItem.homebaseQtyHadjatan != null ? String(editItem.homebaseQtyHadjatan) : "",
        regulerCategory: (editItem.regulerCategory as EventCategoryOption | null) ?? "none",
        hadjatanCategory: (editItem.hadjatanCategory as EventCategoryOption | null) ?? "none",
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
      dealingQty: toIntOrNull(values.dealingQty),
      dealingQtyReguler: toIntOrNull(values.dealingQtyReguler),
      dealingQtyHadjatan: toIntOrNull(values.dealingQtyHadjatan),
      omsetPrice: toDecimalStringOrNull(values.omsetPrice),
      omsetPriceReguler: toDecimalStringOrNull(values.omsetPriceReguler),
      omsetPriceHadjatan: toDecimalStringOrNull(values.omsetPriceHadjatan),
      homebaseQty: toIntOrNull(values.homebaseQty),
      homebaseQtyReguler: toIntOrNull(values.homebaseQtyReguler),
      homebaseQtyHadjatan: toIntOrNull(values.homebaseQtyHadjatan),
      regulerCategory: values.regulerCategory === "none" ? null : values.regulerCategory,
      hadjatanCategory: values.hadjatanCategory === "none" ? null : values.hadjatanCategory,
    };

    if (isEditMode && editItem) {
      const result = await updateMutation.mutateAsync({ id: editItem.id, data: payload });
      if (result.success) {
        toast.success("Target item berhasil diperbarui");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal memperbarui target item");
      }
    } else {
      const result = await createMutation.mutateAsync(payload);
      if (result.success) {
        toast.success("Target item berhasil ditambahkan");
        handleClose();
      } else {
        toast.error(result.error ?? "Gagal menambahkan target item");
      }
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? "Edit Target Item" : "Tambah Target Item"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full gap-4">
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Basic Info */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Informasi Dasar" />

            <div className="space-y-1.5">
              <Label htmlFor="ti-name" className="text-sm font-medium">
                Nama <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ti-name"
                placeholder="Contoh: Target Dealing Bulanan"
                className="rounded-xl"
                {...register("name", { required: "Nama wajib diisi" })}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Kategori Reguler</Label>
                <Controller
                  control={control}
                  name="regulerCategory"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tidak ditentukan</SelectItem>
                        <SelectItem value="WEDDINGS">Weddings</SelectItem>
                        <SelectItem value="MICE">MICE</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Kategori Hadjatan</Label>
                <Controller
                  control={control}
                  name="hadjatanCategory"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tidak ditentukan</SelectItem>
                        <SelectItem value="WEDDINGS">Weddings</SelectItem>
                        <SelectItem value="MICE">MICE</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Kategori ini dipakai bersama untuk rincian Reguler/Hadjatan di semua indikator
              di bawah.
            </p>
          </div>

          {/* Dealing */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Dealing (Qty)" />

            <div className="space-y-1.5">
              <Label htmlFor="ti-dealingQty" className="text-sm font-medium">
                Target Dealing (Total)
              </Label>
              <Input
                id="ti-dealingQty"
                type="number"
                min="0"
                placeholder="Contoh: 10"
                className="rounded-xl"
                {...register("dealingQty")}
              />
              <p className="text-xs text-muted-foreground">
                Isi target total atau isi Reguler + Hadjatan di bawah
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ti-dealingQtyReguler" className="text-sm font-medium">
                  Dealing Reguler
                </Label>
                <Input
                  id="ti-dealingQtyReguler"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="rounded-xl"
                  {...register("dealingQtyReguler")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-dealingQtyHadjatan" className="text-sm font-medium">
                  Dealing Hadjatan
                </Label>
                <Input
                  id="ti-dealingQtyHadjatan"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="rounded-xl"
                  {...register("dealingQtyHadjatan")}
                />
              </div>
            </div>
          </div>

          {/* Omset */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Omset (Harga)" />

            <div className="space-y-1.5">
              <Label htmlFor="ti-omsetPrice" className="text-sm font-medium">
                Target Omset (Total)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="ti-omsetPrice"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  className="rounded-xl pl-9"
                  {...register("omsetPrice")}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Isi target total atau isi Reguler + Hadjatan di bawah
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ti-omsetPriceReguler" className="text-sm font-medium">
                  Omset Reguler
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="ti-omsetPriceReguler"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    className="rounded-xl pl-9"
                    {...register("omsetPriceReguler")}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-omsetPriceHadjatan" className="text-sm font-medium">
                  Omset Hadjatan
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="ti-omsetPriceHadjatan"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    className="rounded-xl pl-9"
                    {...register("omsetPriceHadjatan")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Homebase */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel text="Homebase (Qty)" />

            <div className="space-y-1.5">
              <Label htmlFor="ti-homebaseQty" className="text-sm font-medium">
                Target Homebase (Total)
              </Label>
              <Input
                id="ti-homebaseQty"
                type="number"
                min="0"
                placeholder="Contoh: 10"
                className="rounded-xl"
                {...register("homebaseQty")}
              />
              <p className="text-xs text-muted-foreground">
                Isi target total atau isi Reguler + Hadjatan di bawah
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ti-homebaseQtyReguler" className="text-sm font-medium">
                  Homebase Reguler
                </Label>
                <Input
                  id="ti-homebaseQtyReguler"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="rounded-xl"
                  {...register("homebaseQtyReguler")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ti-homebaseQtyHadjatan" className="text-sm font-medium">
                  Homebase Hadjatan
                </Label>
                <Input
                  id="ti-homebaseQtyHadjatan"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="rounded-xl"
                  {...register("homebaseQtyHadjatan")}
                />
              </div>
            </div>
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
                {isSaving ? "Menyimpan..." : "Tambah Target Item"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
