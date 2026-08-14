"use client";

import { useState, useRef, useEffect } from "react";
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
import { CloseCircle, UploadMinimalistic, Pen } from "@solar-icons/react";
import { createProcurementSchema, type CreateProcurementInput } from "@/lib/validations/procurement";
import { useUpdateProcurement } from "@/hooks/useProcurement";
import type { ProcurementItem } from "@/lib/queries/procurement";

interface EditProcurementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProcurementItem | null;
  venues: { id: string; name: string }[];
  onSuccess?: () => void;
}

async function uploadProcurementFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/maintenance/upload?folder=procurement", { method: "POST", body: fd });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Gagal upload file");
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("URL tidak ditemukan dari response upload");
  return data.url;
}

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export function EditProcurementDrawer({
  open,
  onOpenChange,
  item,
  venues,
  onSuccess,
}: EditProcurementDrawerProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: updateMutation, isPending: isUpdating } = useUpdateProcurement();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createProcurementSchema),
    defaultValues: {
      keteranganAcara: "WEDDING",
      jumlahBarang: 1,
      sisaBarang: 0,
      harga: 0,
      pettyCash: 0,
    },
  });

  const buktiBelUrl = watch("buktiBelUrl");
  const totalVal = watch("total");
  const hargaVal = watch("harga");

  useEffect(() => {
    const t = Number(totalVal ?? 0);
    const h = Number(hargaVal ?? 0);
    const computed = t && h ? t * h : 0;
    setValue("pettyCash", computed);
  }, [totalVal, hargaVal, setValue]);

  useEffect(() => {
    if (open && item) {
      reset({
        tanggalPermintaan: toDateInputValue(item.tanggalPermintaan),
        venueId: item.venue?.id ?? "",
        namaBarang: item.namaBarang,
        jumlahBarang: item.jumlahBarang,
        sisaBarang: item.sisaBarang,
        penggunaan: item.penggunaan ?? "",
        picPenerima: item.picPenerima,
        linkBarang: item.linkBarang ?? "",
        note: item.note ?? "",
        keterangan: item.keterangan ?? "",
        keteranganAcara: (item.keteranganAcara as "WEDDING" | "NON_WEDDING") ?? "WEDDING",
        weddingNote: item.weddingNote ?? "",
        nonWeddingNote: item.nonWeddingNote ?? "",
        totalWedding: item.totalWedding != null ? Number(item.totalWedding) : undefined,
        totalNonWedding: item.totalNonWedding != null ? Number(item.totalNonWedding) : undefined,
        total: item.total != null ? Number(item.total) : undefined,
        division: (item.division as "HR" | "OPERATIONAL" | "IT" | "FINANCE" | "MICE" | null) ?? null,
        harga: item.harga != null ? Number(item.harga) : 0,
        pettyCash: item.pettyCash != null ? Number(item.pettyCash) : 0,
        buktiBelUrl: item.buktiBelUrl ?? "",
      });
      setUploadFile(null);
    }
    if (!open) {
      setUploadFile(null);
    }
  }, [open, item, reset]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile() {
    setUploadFile(null);
    setValue("buktiBelUrl", "");
  }

  async function onSubmit(data: CreateProcurementInput) {
    if (!item) return;
    try {
      let finalData = { ...data };

      if (uploadFile) {
        setIsUploading(true);
        try {
          const url = await uploadProcurementFile(uploadFile);
          finalData = { ...finalData, buktiBelUrl: url };
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Gagal upload bukti beli");
          return;
        } finally {
          setIsUploading(false);
        }
      }

      await updateMutation({ id: item.id, data: finalData });
      toast.success("Pengajuan berhasil diperbarui.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui pengajuan");
    }
  }

  const isPending = isUpdating || isUploading;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Edit Pengajuan"
      maxWidth="sm:max-w-xl"
    >
      <form
        onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Tanggal Permintaan */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-tanggal">Tanggal Permintaan *</Label>
            <Input
              id="ep-tanggal"
              type="date"
              className="rounded-xl"
              {...register("tanggalPermintaan")}
            />
            {errors.tanggalPermintaan && (
              <p className="text-xs text-destructive">{errors.tanggalPermintaan.message}</p>
            )}
          </div>

          {/* Venue */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-venue">Venue *</Label>
            <Controller
              name="venueId"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="ep-venue" className="w-full rounded-xl">
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

          {/* Nama Barang */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-nama">Nama Barang *</Label>
            <Input
              id="ep-nama"
              placeholder="Nama barang yang diajukan"
              className="rounded-xl"
              {...register("namaBarang")}
            />
            {errors.namaBarang && (
              <p className="text-xs text-destructive">{errors.namaBarang.message}</p>
            )}
          </div>

          {/* Jumlah & Sisa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-jumlah">Jumlah Barang *</Label>
              <Input
                id="ep-jumlah"
                type="number"
                min={1}
                className="rounded-xl"
                {...register("jumlahBarang", { valueAsNumber: true })}
              />
              {errors.jumlahBarang && (
                <p className="text-xs text-destructive">{errors.jumlahBarang.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-sisa">Sisa Barang *</Label>
              <Input
                id="ep-sisa"
                type="number"
                min={0}
                className="rounded-xl"
                {...register("sisaBarang", { valueAsNumber: true })}
              />
              {errors.sisaBarang && (
                <p className="text-xs text-destructive">{errors.sisaBarang.message}</p>
              )}
            </div>
          </div>

          {/* PIC Penerima */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-pic">PIC Penerima *</Label>
            <Input
              id="ep-pic"
              placeholder="Nama PIC penerima"
              className="rounded-xl"
              {...register("picPenerima")}
            />
            {errors.picPenerima && (
              <p className="text-xs text-destructive">{errors.picPenerima.message}</p>
            )}
          </div>

          {/* Penggunaan */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-penggunaan">Penggunaan</Label>
            <Input
              id="ep-penggunaan"
              placeholder="Deskripsi penggunaan barang"
              className="rounded-xl"
              {...register("penggunaan")}
            />
          </div>

          {/* Keterangan Acara */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-keterangan-acara">Keterangan Acara *</Label>
            <Controller
              name="keteranganAcara"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ep-keterangan-acara" className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEDDING">Wedding</SelectItem>
                    <SelectItem value="NON_WEDDING">Non Wedding</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Division */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-division">Divisi</Label>
            <Controller
              name="division"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                >
                  <SelectTrigger id="ep-division" className="w-full rounded-xl">
                    <SelectValue placeholder="Pilih divisi..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="OPERATIONAL">Operational</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="FINANCE">Finance</SelectItem>
                    <SelectItem value="MICE">MICE</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
 
          {/* Petty Cash (nominal) */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="ep-harga">Harga per unit (Rp)</Label>
              <Controller
                name="harga"
                control={control}
                render={({ field }) => (
                  <Input
                    id="ep-harga"
                    type="text"
                    inputMode="numeric"
                    className="rounded-xl w-48"
                    value={Number(field.value) ? new Intl.NumberFormat("id-ID").format(Number(field.value)) : ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      field.onChange(raw === "" ? 0 : Number(raw));
                    }}
                  />
                )}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-petty-cash">Petty Cash (Rp)</Label>
              <Controller
                name="pettyCash"
                control={control}
                render={({ field }) => (
                  <Input
                    id="ep-petty-cash"
                    type="text"
                    inputMode="numeric"
                    className="rounded-xl w-48"
                    value={Number(field.value) ? new Intl.NumberFormat("id-ID").format(Number(field.value)) : "0"}
                    disabled
                  />
                )}
              />
            </div>
          </div>
 
          {/* Wedding Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-wedding-note">Wedding Note</Label>
            <Input
              id="ep-wedding-note"
              placeholder="Catatan untuk wedding"
              className="rounded-xl"
              {...register("weddingNote")}
            />
          </div>

          {/* Non Wedding Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-non-wedding-note">Non Wedding Note</Label>
            <Input
              id="ep-non-wedding-note"
              placeholder="Catatan untuk non-wedding"
              className="rounded-xl"
              {...register("nonWeddingNote")}
            />
          </div>

          {/* Total Wedding & Non Wedding */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-total-wedding">Total Wedding</Label>
              <Input
                id="ep-total-wedding"
                type="number"
                min={0}
                placeholder="0"
                className="rounded-xl"
                {...register("totalWedding", { valueAsNumber: true, setValueAs: (v) => v === "" ? null : Number(v) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-total-non-wedding">Total Non Wedding</Label>
              <Input
                id="ep-total-non-wedding"
                type="number"
                min={0}
                placeholder="0"
                className="rounded-xl"
                {...register("totalNonWedding", { valueAsNumber: true, setValueAs: (v) => v === "" ? null : Number(v) })}
              />
            </div>
          </div>

          {/* Total */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-total">Total</Label>
            <Input
              id="ep-total"
              type="number"
              min={0}
              placeholder="0"
              className="rounded-xl"
              {...register("total", { valueAsNumber: true, setValueAs: (v) => v === "" ? null : Number(v) })}
            />
          </div>

          {/* Link Barang */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-link">Link Barang</Label>
            <Input
              id="ep-link"
              type="url"
              placeholder="https://..."
              className="rounded-xl"
              {...register("linkBarang")}
            />
            {errors.linkBarang && (
              <p className="text-xs text-destructive">{errors.linkBarang.message}</p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-note">Catatan</Label>
            <Textarea
              id="ep-note"
              rows={3}
              placeholder="Catatan tambahan..."
              {...register("note")}
            />
          </div>

          {/* Bukti Beli Upload */}
          <div className="space-y-1.5">
            <Label>Bukti Beli</Label>
            {(buktiBelUrl ?? uploadFile) ? (
              <div className="flex items-center gap-2 p-2 rounded-xl border bg-muted/30">
                {buktiBelUrl && !uploadFile ? (
                  <a
                    href={buktiBelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground underline truncate flex-1"
                  >
                    Lihat file saat ini
                  </a>
                ) : (
                  <span className="text-sm text-foreground truncate flex-1">
                    {uploadFile?.name ?? ""}
                  </span>
                )}
                <button
                  type="button"
                  onClick={removeFile}
                  className="shrink-0"
                  aria-label="Hapus file"
                >
                  <CloseCircle weight="BoldDuotone" className="h-5 w-5 text-destructive" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 p-4 transition-colors cursor-pointer"
              >
                <UploadMinimalistic weight="BoldDuotone" className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Klik untuk upload bukti beli
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
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
              <Pen weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
              {isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
