"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddSquare, Pen } from "@solar-icons/react";
import {
  createVenueBudgetSchema,
  type CreateVenueBudgetInput,
} from "@/lib/validations/procurement";
import type { VenueBudgetItem } from "@/lib/queries/procurement";
import {
  useCreateVenueBudget,
  useUpdateVenueBudget,
} from "@/hooks/useProcurement";
import { useVenues } from "@/hooks/use-venues";

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface BudgetFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: VenueBudgetItem | null;
  venues?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function BudgetFormDrawer({
  open,
  onOpenChange,
  item,
  venues: venuesProp,
  onSuccess,
}: BudgetFormDrawerProps): React.JSX.Element {
  const { data: venuesQuery = [] } = useVenues();
  const venues = venuesProp ?? venuesQuery;
  const isEdit = !!item;

  const { mutateAsync: createMutation, isPending: isCreating } =
    useCreateVenueBudget();
  const { mutateAsync: updateMutation, isPending: isUpdating } =
    useUpdateVenueBudget();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createVenueBudgetSchema),
    defaultValues: {
      venueId: "",
      budgetAmount: 0,
      period: getCurrentPeriod(),
      note: null as string | null | undefined,
    },
  });

  useEffect(() => {
    if (open && item) {
      reset({
        venueId: item.venueId,
        budgetAmount: Number(item.budgetAmount),
        period: item.period,
        note: item.note ?? null,
      });
    } else if (!open) {
      reset({
        venueId: "",
        budgetAmount: 0,
        period: getCurrentPeriod(),
        note: null,
      });
    }
  }, [open, item, reset]);

  async function onSubmit(data: CreateVenueBudgetInput): Promise<void> {
    try {
      if (isEdit && item) {
        await updateMutation({ id: item.id, data });
        toast.success("Anggaran berhasil diperbarui.");
      } else {
        await createMutation(data);
        toast.success("Anggaran berhasil ditambahkan.");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isEdit
            ? "Gagal memperbarui anggaran"
            : "Gagal menambahkan anggaran"
      );
    }
  }

  const isPending = isCreating || isUpdating;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Anggaran" : "Tambah Anggaran"}
      maxWidth="sm:max-w-lg"
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          <div className="space-y-1.5">
            <Label htmlFor="budget-venue">Venue *</Label>
            <Controller
              name="venueId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="budget-venue" className="w-full rounded-xl">
                    <SelectValue placeholder="Pilih venue..." />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.venueId && (
              <p className="text-xs text-destructive">{errors.venueId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Total Anggaran (Rp) *</Label>
            <Controller
              name="budgetAmount"
              control={control}
              render={({ field }) => (
                <Input
                  id="budget-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 5.000.000"
                  className="rounded-xl"
                  value={Number(field.value) ? new Intl.NumberFormat("id-ID").format(Number(field.value)) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    field.onChange(raw === "" ? 0 : Number(raw));
                  }}
                />
              )}
            />
            {errors.budgetAmount && (
              <p className="text-xs text-destructive">
                {errors.budgetAmount.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-period">Periode *</Label>
            <input
              id="budget-period"
              type="month"
              className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              {...register("period")}
            />
            {errors.period && (
              <p className="text-xs text-destructive">{errors.period.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-note">
              Catatan{" "}
              <span className="text-muted-foreground text-xs">(opsional)</span>
            </Label>
            <Textarea
              id="budget-note"
              rows={3}
              placeholder="Catatan tambahan mengenai anggaran ini..."
              className="rounded-xl resize-none"
              {...register("note")}
            />
            {errors.note && (
              <p className="text-xs text-destructive">{errors.note.message}</p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-background pt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-full"
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-full"
              disabled={isPending}
            >
              {isEdit ? (
                <Pen weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
              ) : (
                <AddSquare weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
              )}
              {isPending
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Tambah Anggaran"}
            </Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
