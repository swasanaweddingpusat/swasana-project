"use client";

import { useEffect } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
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
import { AddSquare, Pen } from "@solar-icons/react";
import {
  createAnnouncementSchema,
  type CreateAnnouncementInput,
} from "@/lib/validations/procurement";
import type { AnnouncementItem } from "@/lib/queries/procurement";
import {
  useCreateAnnouncement,
  useUpdateAnnouncement,
} from "@/hooks/useProcurement";
import { useVenues } from "@/hooks/use-venues";

interface AnnouncementFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: AnnouncementItem | null;
  venues?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function AnnouncementFormDrawer({
  open,
  onOpenChange,
  item,
  venues: venuesProp,
  onSuccess,
}: AnnouncementFormDrawerProps): React.JSX.Element {
  const { data: venuesQuery = [] } = useVenues();
  const venues = venuesProp ?? venuesQuery;
  const isEdit = !!item;

  const { mutateAsync: createMutation, isPending: isCreating } =
    useCreateAnnouncement();
  const { mutateAsync: updateMutation, isPending: isUpdating } =
    useUpdateAnnouncement();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createAnnouncementSchema),
    defaultValues: {
      title: "",
      content: "",
      isActive: true,
      targetAudience: "ALL" as const,
      targetList: [] as string[],
    },
  });

  // useWatch (subscription hook) instead of watch() — the React Compiler flags
  // watch() as an incompatible-library call it can't safely memoize.
  const targetAudience = useWatch({ control, name: "targetAudience" });

  useEffect(() => {
    if (open && item) {
      reset({
        title: item.title,
        content: item.content,
        isActive: item.isActive,
        targetAudience: item.targetAudience,
        targetList: item.targetList,
      });
    } else if (!open) {
      reset({
        title: "",
        content: "",
        isActive: true,
        targetAudience: "ALL" as const,
        targetList: [] as string[],
      });
    }
  }, [open, item, reset]);

  async function onSubmit(data: CreateAnnouncementInput): Promise<void> {
    try {
      if (isEdit && item) {
        await updateMutation({ id: item.id, data });
        toast.success("Pengumuman berhasil diperbarui.");
      } else {
        await createMutation(data);
        toast.success("Pengumuman berhasil dibuat.");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isEdit
            ? "Gagal memperbarui pengumuman"
            : "Gagal membuat pengumuman"
      );
    }
  }

  const isPending = isCreating || isUpdating;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? "Edit Pengumuman" : "Tambah Pengumuman"}
      maxWidth="sm:max-w-lg"
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(onSubmit)(e);
        }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Judul */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Judul *</Label>
            <Input
              id="ann-title"
              placeholder="Judul pengumuman"
              className="rounded-xl"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Isi Pengumuman */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-content">Isi Pengumuman *</Label>
            <Textarea
              id="ann-content"
              rows={5}
              placeholder="Tulis isi pengumuman di sini..."
              className="rounded-xl resize-none"
              {...register("content")}
            />
            {errors.content && (
              <p className="text-xs text-destructive">
                {errors.content.message}
              </p>
            )}
          </div>

          {/* Target Audiens */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-target-audience">Target Audiens</Label>
            <Controller
              name="targetAudience"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ann-target-audience" className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua</SelectItem>
                    <SelectItem value="VENUE">Per Venue</SelectItem>
                    <SelectItem value="DIVISION">Per Divisi</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.targetAudience && (
              <p className="text-xs text-destructive">
                {errors.targetAudience.message}
              </p>
            )}
          </div>

          {/* Target List — only shown for VENUE or DIVISION */}
          {targetAudience === "VENUE" && (
            <div className="space-y-1.5">
              <Label htmlFor="ann-target-list">
                Venue yang Dituju
                <span className="text-muted-foreground text-xs ml-1">
                  (pisahkan dengan koma)
                </span>
              </Label>
              <Controller
                name="targetList"
                control={control}
                render={({ field }) => (
                  <Input
                    id="ann-target-list"
                    placeholder={
                      venues.length > 0
                        ? venues
                            .map((v) => v.name)
                            .slice(0, 2)
                            .join(", ") + (venues.length > 2 ? ", ..." : "")
                        : "Nama venue, dipisah koma"
                    }
                    className="rounded-xl"
                    value={(field.value ?? []).join(", ")}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const list = raw
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      field.onChange(list);
                    }}
                  />
                )}
              />
              {errors.targetList && (
                <p className="text-xs text-destructive">
                  {errors.targetList.message}
                </p>
              )}
            </div>
          )}

          {targetAudience === "DIVISION" && (
            <div className="space-y-1.5">
              <Label htmlFor="ann-target-division">
                Divisi yang Dituju
                <span className="text-muted-foreground text-xs ml-1">
                  (pisahkan dengan koma)
                </span>
              </Label>
              <Controller
                name="targetList"
                control={control}
                render={({ field }) => (
                  <Input
                    id="ann-target-division"
                    placeholder="HR, OPERATIONAL, IT, FINANCE, MICE"
                    className="rounded-xl"
                    value={(field.value ?? []).join(", ")}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const list = raw
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      field.onChange(list);
                    }}
                  />
                )}
              />
              {errors.targetList && (
                <p className="text-xs text-destructive">
                  {errors.targetList.message}
                </p>
              )}
            </div>
          )}

          {/* Aktif toggle */}
          <div className="flex items-center justify-between rounded-xl border p-4 bg-card">
            <div className="space-y-0.5">
              <Label
                htmlFor="ann-is-active"
                className="text-sm font-medium cursor-pointer"
              >
                Aktif
              </Label>
              <p className="text-xs text-muted-foreground">
                Pengumuman akan ditampilkan kepada audiens yang dituju
              </p>
            </div>
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Switch
                  id="ann-is-active"
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </div>

        {/* Footer actions */}
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
                  : "Tambah Pengumuman"}
            </Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
