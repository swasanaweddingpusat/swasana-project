"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddCircle, GalleryWide, PenNewSquare, TrashBinTrash, Upload } from "@solar-icons/react";
import {
  createBanner,
  deleteBanner,
  toggleBannerActive,
  updateBanner,
} from "@/actions/banner";
import { usePermissions } from "@/hooks/use-permissions";
import type { BannersResult, BannerItem } from "@/lib/queries/banners";
import { cn } from "@/lib/utils";

const S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function toFullUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : key;
}

interface Props {
  initialData: BannersResult;
}

interface FormState {
  title: string;
  caption: string;
  imageKey: string;
  linkUrl: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  caption: "",
  imageKey: "",
  linkUrl: "",
  sortOrder: "0",
  isActive: true,
};

export function BannerManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingItem, setEditingItem] = useState<BannerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BannerItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canCreate = can("settings-banner", "create") || isAdmin;
  const canEdit = can("settings-banner", "edit") || isAdmin;
  const canDelete = can("settings-banner", "delete") || isAdmin;

  // Revoke the current blob preview URL whenever it changes (replaced file,
  // cleared on close/reset) or on unmount — avoids object-URL leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetFileSelection() {
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    resetFileSelection();
    setFormOpen(true);
  }

  function handleOpenEdit(item: BannerItem) {
    setEditingItem(item);
    setForm({
      title: item.title,
      caption: item.caption ?? "",
      imageKey: item.imageKey,
      linkUrl: item.linkUrl ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
    resetFileSelection();
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetFileSelection();
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Tipe file tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Ukuran file maksimal 5MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  async function handleSave() {
    if (!form.title.trim() || (!selectedFile && !form.imageKey)) return;
    setSaving(true);

    let imageKey = form.imageKey;
    let metadata: { originalName?: string; fileName?: string; mimeType?: string } = {};

    if (selectedFile) {
      try {
        const fd = new FormData();
        fd.set("file", selectedFile);
        const res = await fetch("/api/upload/banner", { method: "POST", body: fd });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "Upload gagal");
        }
        const data = (await res.json()) as {
          key: string;
          fileName?: string;
          originalName?: string;
          mimeType?: string;
        };
        imageKey = data.key;
        metadata = {
          originalName: data.originalName,
          fileName: data.fileName,
          mimeType: data.mimeType,
        };
      } catch (err) {
        setSaving(false);
        toast.error(err instanceof Error ? err.message : "Gagal upload gambar.");
        return;
      }
    }

    const payload = {
      title: form.title.trim(),
      caption: form.caption.trim() || undefined,
      imageKey,
      ...metadata,
      linkUrl: form.linkUrl.trim() || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    const result = editingItem
      ? await updateBanner(editingItem.id, payload)
      : await createBanner(payload);

    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menyimpan banner.");
      return;
    }

    if (editingItem) {
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? result.banner : i)));
      toast.success("Berhasil diperbarui.");
    } else {
      setItems((prev) =>
        [...prev, result.banner].sort((a, b) => a.sortOrder - b.sortOrder),
      );
      toast.success("Berhasil ditambahkan.");
    }
    resetFileSelection();
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteBanner(deleteTarget.id);
    if (!result.success) {
      toast.error(result.error);
      setDeleteTarget(null);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  async function handleToggleActive(item: BannerItem) {
    const result = await toggleBannerActive(item.id);
    if (!result.success) {
      toast.error(result.error ?? "Gagal mengubah status.");
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? result.banner : i)));
  }

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <div className={cn("flex", "items-center", "justify-between", "gap-3", "pb-4")}>
          <div className={cn("flex", "items-center", "gap-2")}>
            <h2 className={cn("text-base", "font-bold", "text-foreground")}>Banner Dashboard</h2>
            <span className={cn("text-sm", "text-muted-foreground")}>({items.length})</span>
          </div>
          {canCreate && (
            <Button onClick={handleOpenAdd} className={cn("rounded-full", "cursor-pointer")}>
              <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-2")} /> Tambah
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className={cn("flex", "flex-col", "items-center", "justify-center", "gap-2", "py-12", "text-center")}>
              <GalleryWide weight="BoldDuotone" className={cn("h-10", "w-10", "text-muted-foreground")} />
              <p className={cn("text-sm", "text-muted-foreground")}>Belum ada banner.</p>
            </CardContent>
          </Card>
        ) : (
          <div className={cn("grid", "grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3", "gap-4")}>
            {items.map((item) => {
              const url = toFullUrl(item.imageKey);
              return (
                <Card key={item.id} className={cn("rounded-2xl", "overflow-hidden", "shadow-sm", "hover:shadow-md", "transition-shadow", "py-0")}>
                  <div className={cn("relative", "aspect-[3/1]", "w-full", "bg-muted")}>
                    {url && (
                      <Image
                        src={url}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    )}
                    <Badge
                      variant={item.isActive ? "default" : "secondary"}
                      className={cn("absolute", "top-2", "left-2")}
                    >
                      {item.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <CardContent className={cn("p-4", "space-y-3")}>
                    <div>
                      <h3 className={cn("text-sm", "font-semibold", "text-foreground", "truncate")}>
                        {item.title}
                      </h3>
                      {item.caption && (
                        <p className={cn("text-xs", "text-muted-foreground", "mt-0.5", "line-clamp-2")}>
                          {item.caption}
                        </p>
                      )}
                      <p className={cn("text-xs", "text-muted-foreground", "mt-1")}>
                        Urutan: {item.sortOrder}
                      </p>
                    </div>
                    <div className={cn("flex", "items-center", "justify-between", "pt-1", "border-t", "border-border")}>
                      <div className={cn("flex", "items-center", "gap-2")}>
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={() => handleToggleActive(item)}
                          disabled={!canEdit}
                        />
                        <span className={cn("text-xs", "text-muted-foreground")}>Tampilkan</span>
                      </div>
                      <div className={cn("flex", "items-center", "gap-1")}>
                        {canEdit && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className={cn("p-1.5", "rounded-full", "hover:bg-muted", "cursor-pointer")}
                            aria-label="Edit"
                          >
                            <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className={cn("p-1.5", "rounded-full", "hover:bg-muted", "cursor-pointer")}
                            aria-label="Hapus"
                          >
                            <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetFileSelection();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Banner</DialogTitle>
          <div className={cn("space-y-4", "pt-2")}>
            <div className="space-y-2">
              <Label>Gambar</Label>
              <div
                className={cn(
                  "relative", "flex", "aspect-[3/1]", "w-full", "items-center", "justify-center",
                  "overflow-hidden", "rounded-xl", "border", "border-dashed", "border-border", "bg-muted",
                  "cursor-pointer",
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ?? toFullUrl(form.imageKey) ? (
                  <Image
                    src={previewUrl ?? toFullUrl(form.imageKey) ?? ""}
                    alt="Preview"
                    fill
                    unoptimized
                    sizes="(max-width: 512px) 100vw, 512px"
                    className="object-cover"
                  />
                ) : (
                  <div className={cn("flex", "flex-col", "items-center", "gap-1", "text-muted-foreground")}>
                    <Upload weight="BoldDuotone" className="h-6 w-6" />
                    <span className="text-xs">Klik untuk upload gambar</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-title">Judul</Label>
              <Input
                id="banner-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Contoh: Sales Champion — Top 3 Pemenang"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-caption">Keterangan (opsional)</Label>
              <Textarea
                id="banner-caption"
                value={form.caption}
                onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
                placeholder="Deskripsi singkat banner"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner-link">Link tujuan (opsional)</Label>
              <Input
                id="banner-link"
                value={form.linkUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banner-sort">Urutan</Label>
                <Input
                  id="banner-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                />
              </div>
              <div className="flex items-end justify-between pb-2">
                <Label htmlFor="banner-active">Aktif</Label>
                <Switch
                  id="banner-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                />
              </div>
            </div>

            <div className={cn("flex", "gap-3", "pt-2")}>
              <Button
                variant="outline"
                onClick={closeForm}
                disabled={saving}
                className={cn("flex-1", "rounded-full", "cursor-pointer")}
              >
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || (!selectedFile && !form.imageKey)}
                className={cn("flex-1", "rounded-full", "cursor-pointer")}
              >
                {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Banner</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus banner <strong>{deleteTarget?.title}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
