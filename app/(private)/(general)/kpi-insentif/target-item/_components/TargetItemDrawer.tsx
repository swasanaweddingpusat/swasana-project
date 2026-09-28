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

interface TargetItemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: TargetItemRow | null;
}

type FormValues = {
  name: string;
  indicatorType: "dealing" | "omset" | "homebase";
  type: "qty" | "price";
  qty: string;
  qtyReguler: string;
  qtyHadjatan: string;
  price: string;
  priceReguler: string;
  priceHadjatan: string;
};

const DEFAULT_VALUES: FormValues = {
  name: "",
  indicatorType: "dealing",
  type: "qty",
  qty: "",
  qtyReguler: "",
  qtyHadjatan: "",
  price: "",
  priceReguler: "",
  priceHadjatan: "",
};

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
      {text}
    </p>
  );
}

export function TargetItemDrawer({ isOpen, onClose, editItem }: TargetItemDrawerProps) {
  const isEditMode = editItem != null;
  const createMutation = useCreateTargetItem();
  const updateMutation = useUpdateTargetItem();
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

  const targetType = watch("type");

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && editItem) {
      reset({
        name: editItem.name,
        indicatorType: editItem.indicatorType as "dealing" | "omset" | "homebase",
        type: editItem.type as "qty" | "price",
        qty: editItem.qty != null ? String(editItem.qty) : "",
        qtyReguler: editItem.qtyReguler != null ? String(editItem.qtyReguler) : "",
        qtyHadjatan: editItem.qtyHadjatan != null ? String(editItem.qtyHadjatan) : "",
        price: editItem.price != null ? String(editItem.price) : "",
        priceReguler: editItem.priceReguler != null ? String(editItem.priceReguler) : "",
        priceHadjatan: editItem.priceHadjatan != null ? String(editItem.priceHadjatan) : "",
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
      indicatorType: values.indicatorType,
      type: values.type,
    };

    if (values.type === "qty") {
      if (values.qty !== "") payload.qty = parseInt(values.qty, 10);
      else payload.qty = null;
      if (values.qtyReguler !== "") payload.qtyReguler = parseInt(values.qtyReguler, 10);
      else payload.qtyReguler = null;
      if (values.qtyHadjatan !== "") payload.qtyHadjatan = parseInt(values.qtyHadjatan, 10);
      else payload.qtyHadjatan = null;
    } else {
      if (values.price !== "") payload.price = values.price;
      else payload.price = null;
      if (values.priceReguler !== "") payload.priceReguler = values.priceReguler;
      else payload.priceReguler = null;
      if (values.priceHadjatan !== "") payload.priceHadjatan = values.priceHadjatan;
      else payload.priceHadjatan = null;
    }

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
                <Label className="text-sm font-medium">
                  Tipe Indikator <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="indicatorType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue placeholder="Pilih tipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dealing">Dealing</SelectItem>
                        <SelectItem value="omset">Omset</SelectItem>
                        <SelectItem value="homebase">Homebase</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Tipe Target <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["qty", "price"] as const).map((opt) => {
                        const active = field.value === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => field.onChange(opt)}
                            className={[
                              "flex items-center justify-center py-2 text-xs font-semibold rounded-full transition-colors",
                              active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted text-muted-foreground hover:bg-accent",
                            ].join(" ")}
                          >
                            {opt === "qty" ? "Qty" : "Harga"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Target Values */}
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <SectionLabel
              text={targetType === "qty" ? "Nilai Target (Qty)" : "Nilai Target (Harga)"}
            />

            {targetType === "qty" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ti-qty" className="text-sm font-medium">
                    Target Qty (Total)
                  </Label>
                  <Input
                    id="ti-qty"
                    type="number"
                    min="0"
                    placeholder="Contoh: 10"
                    className="rounded-xl"
                    {...register("qty")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Isi target total atau isi Reguler + Hadjatan di bawah
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ti-qtyReguler" className="text-sm font-medium">
                      Qty Reguler
                    </Label>
                    <Input
                      id="ti-qtyReguler"
                      type="number"
                      min="0"
                      placeholder="0"
                      className="rounded-xl"
                      {...register("qtyReguler")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ti-qtyHadjatan" className="text-sm font-medium">
                      Qty Hadjatan
                    </Label>
                    <Input
                      id="ti-qtyHadjatan"
                      type="number"
                      min="0"
                      placeholder="0"
                      className="rounded-xl"
                      {...register("qtyHadjatan")}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ti-price" className="text-sm font-medium">
                    Target Omset (Total)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="ti-price"
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      className="rounded-xl pl-9"
                      {...register("price")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Isi target total atau isi Reguler + Hadjatan di bawah
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ti-priceReguler" className="text-sm font-medium">
                      Omset Reguler
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        id="ti-priceReguler"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                        className="rounded-xl pl-9"
                        {...register("priceReguler")}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ti-priceHadjatan" className="text-sm font-medium">
                      Omset Hadjatan
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        id="ti-priceHadjatan"
                        type="number"
                        min="0"
                        step="1000"
                        placeholder="0"
                        className="rounded-xl pl-9"
                        {...register("priceHadjatan")}
                      />
                    </div>
                  </div>
                </div>
              </>
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
                {isSaving ? "Menyimpan..." : "Tambah Target Item"}
              </>
            )}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
