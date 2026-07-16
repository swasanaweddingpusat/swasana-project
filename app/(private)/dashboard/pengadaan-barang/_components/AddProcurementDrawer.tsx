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
import { CloseCircle, UploadMinimalistic, AddSquare } from "@solar-icons/react";
import { createProcurementSchema, type CreateProcurementInput } from "@/lib/validations/procurement";
import { useCreateProcurement } from "@/hooks/useProcurement";

interface AddProcurementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AddProcurementDrawer({
  open,
  onOpenChange,
  venues,
  onSuccess,
}: AddProcurementDrawerProps) {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: createMutation, isPending: isCreating } = useCreateProcurement();

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

  // Auto-calculate pettyCash = total * harga
  useEffect(() => {
    const t = Number(totalVal ?? 0);
    const h = Number(hargaVal ?? 0);
    const computed = t && h ? t * h : 0;
    setValue("pettyCash", computed);
  }, [totalVal, hargaVal, setValue]);

  useEffect(() => {
    if (!open) {
      reset();
      setUploadFile(null);
    }
  }, [open, reset]);

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

      await createMutation(finalData);
      toast.success("Pengajuan berhasil dibuat.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pengajuan");
    }
  }

  const isPending = isCreating || isUploading;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Tambah Pengajuan"
      maxWidth="sm:max-w-xl"
    >
      <form
        onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
        className="flex flex-col h-full"
      >
        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* Tanggal Permintaan */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-tanggal">Tanggal Permintaan *</Label>
            <Input
              id="ap-tanggal"
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
            <Label htmlFor="ap-venue">Venue *</Label>
            <Controller
              name="venueId"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="ap-venue" className="w-full rounded-xl">
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
            <Label htmlFor="ap-nama">Nama Barang *</Label>
            <Input
              id="ap-nama"
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
              <Label htmlFor="ap-jumlah">Jumlah Barang *</Label>
              <Input
                id="ap-jumlah"
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
              <Label htmlFor="ap-sisa">Sisa Barang *</Label>
              <Input
                id="ap-sisa"
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
            <Label htmlFor="ap-pic">PIC Penerima *</Label>
            <Input
              id="ap-pic"
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
            <Label htmlFor="ap-penggunaan">Penggunaan</Label>
            <Input
              id="ap-penggunaan"
              placeholder="Deskripsi penggunaan barang"
              className="rounded-xl"
              {...register("penggunaan")}
            />
          </div>

          {/* Keterangan Acara */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-keterangan-acara">Keterangan Acara *</Label>
            <Controller
              name="keteranganAcara"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ap-keterangan-acara" className="w-full rounded-xl">
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
            <Label htmlFor="ap-division">Divisi</Label>
            <Controller
              name="division"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                >
                  <SelectTrigger id="ap-division" className="w-full rounded-xl">
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
 
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="ap-harga">Harga per unit (Rp)</Label>
              <Controller
                name="harga"
                control={control}
                render={({ field }) => (
                  <Input
                    id="ap-harga"
                    type="number"
                    min={0}
                    step={1}
                    className="rounded-xl w-48"
                    value={Number(field.value) || 0}
                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                  />
                )}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ap-petty-cash">Petty Cash (Rp)</Label>
              <Controller
                name="pettyCash"
                control={control}
                render={({ field }) => (
                  <Input
                    id="ap-petty-cash"
                    type="number"
                    min={0}
                    step={1}
                    className="rounded-xl w-48"
                    value={Number(field.value) || 0}
                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                    disabled
                  />
                )}
              />
            </div>
          </div>
 
          {/* Wedding Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-wedding-note">Wedding Note</Label>
            <Input
              id="ap-wedding-note"
              placeholder="Catatan untuk wedding"
              className="rounded-xl"
              {...register("weddingNote")}
            />
          </div>

          {/* Non Wedding Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-non-wedding-note">Non Wedding Note</Label>
            <Input
              id="ap-non-wedding-note"
              placeholder="Catatan untuk non-wedding"
              className="rounded-xl"
              {...register("nonWeddingNote")}
            />
          </div>

          {/* Total Wedding & Non Wedding */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-total-wedding">Total Wedding</Label>
              <Input
                id="ap-total-wedding"
                type="number"
                min={0}
                placeholder="0"
                className="rounded-xl"
                {...register("totalWedding", { valueAsNumber: true, setValueAs: (v) => v === "" ? null : Number(v) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-total-non-wedding">Total Non Wedding</Label>
              <Input
                id="ap-total-non-wedding"
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
            <Label htmlFor="ap-total">Total</Label>
            <Input
              id="ap-total"
              type="number"
              min={0}
              placeholder="0"
              className="rounded-xl"
              {...register("total", { valueAsNumber: true, setValueAs: (v) => v === "" ? null : Number(v) })}
            />
          </div>

          {/* Link Barang */}
          <div className="space-y-1.5">
            <Label htmlFor="ap-link">Link Barang</Label>
            <Input
              id="ap-link"
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
            <Label htmlFor="ap-note">Catatan</Label>
            <Textarea
              id="ap-note"
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
                <span className="text-sm text-foreground truncate flex-1">
                  {uploadFile?.name ?? buktiBelUrl ?? ""}
                </span>
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
              <AddSquare weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
              {isPending ? "Menyimpan..." : "Tambah Pengajuan"}
            </Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
