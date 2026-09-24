"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Drawer } from "@/components/shared/drawer";
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
import { AddCircle, CalendarMark, PenNewSquare, Ticket, TrashBinTrash, Upload } from "@solar-icons/react";
import { createFestival, updateFestival, deleteFestival } from "@/actions/festival";
import { usePermissions } from "@/hooks/use-permissions";
import type { FestivalsResult, FestivalItem } from "@/lib/queries/festivals";
import { cn } from "@/lib/utils";

const S3_PUBLIC_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? "";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function toFullUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : key;
}

function formatRange(start: Date | string | null, end: Date | string | null): string {
  if (!start || !end) return "Belum diatur";
  const from = new Date(start);
  const to = new Date(end);
  return `${format(from, "d MMM yyyy", { locale: idLocale })} — ${format(to, "d MMM yyyy", { locale: idLocale })}`;
}

interface Props {
  initialData: FestivalsResult;
}

interface FormState {
  name: string;
  description: string;
  backgroundImageKey: string;
  range: DateRange | undefined;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  backgroundImageKey: "",
  range: undefined,
};

export function FestivalManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FestivalItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<FestivalItem | null>(null);

  const canCreate = can("settings-festival", "create") || isAdmin;
  const canEdit = can("settings-festival", "edit") || isAdmin;
  const canDelete = can("settings-festival", "delete") || isAdmin;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetFile() {
    setSelectedFile(null);
    setPreviewUrl(null);
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    resetFile();
    setDrawerOpen(true);
  }

  function handleOpenEdit(item: FestivalItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      backgroundImageKey: item.backgroundImageKey ?? "",
      range: item.startDate && item.endDate
        ? { from: new Date(item.startDate), to: new Date(item.endDate) }
        : undefined,
    });
    resetFile();
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    resetFile();
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
    if (!form.name.trim()) {
      toast.error("Nama festival wajib diisi.");
      return;
    }
    if (!form.range?.from || !form.range?.to) {
      toast.error("Tanggal festival wajib diisi.");
      return;
    }

    setSaving(true);

    let backgroundImageKey = form.backgroundImageKey || undefined;

    if (selectedFile) {
      try {
        const fd = new FormData();
        fd.set("file", selectedFile);
        const res = await fetch("/api/upload/festival", { method: "POST", body: fd });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "Upload gagal");
        }
        const data = (await res.json()) as { key: string };
        backgroundImageKey = data.key;
      } catch (err) {
        setSaving(false);
        toast.error(err instanceof Error ? err.message : "Gagal upload gambar.");
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      backgroundImageKey,
      startDate: form.range.from,
      endDate: form.range.to,
    };

    const result = editingItem
      ? await updateFestival(editingItem.id, payload)
      : await createFestival(payload);

    setSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "Gagal menyimpan festival.");
      return;
    }

    if (editingItem) {
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? result.item : i)));
      toast.success("Berhasil diperbarui.");
    } else {
      setItems((prev) => [result.item, ...prev]);
      toast.success("Festival ditambahkan.");
    }
    closeDrawer();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteFestival(deleteTarget.id);
    if (!result.success) {
      toast.error(result.error);
      setDeleteTarget(null);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  const previewSrc = previewUrl ?? toFullUrl(form.backgroundImageKey);

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <div className={cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3", "pb-4")}>
          <div>
            <h2 className={cn("text-sm", "font-medium", "text-foreground")}>Festival</h2>
            <p className={cn("text-xs", "text-muted-foreground", "mt-0.5")}>
              {items.length} festival — background & keterangan dipakai pada tiket QR guestbook
            </p>
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
              <Ticket weight="BoldDuotone" className={cn("h-10", "w-10", "text-muted-foreground")} />
              <p className={cn("text-sm", "text-muted-foreground")}>
                Belum ada festival. Klik <span className={cn("font-medium", "text-foreground")}>Tambah</span> untuk menambahkan.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className={cn("rounded-2xl", "overflow-hidden", "py-0", "shadow-sm")}>
            <Table>
              <TableHeader>
                <TableRow className={cn("bg-muted/50", "hover:bg-muted/50")}>
                  <TableHead className={cn("w-28", "pl-4")}>Background</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className={cn("pr-4", "text-right")}>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const url = toFullUrl(item.backgroundImageKey);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className={cn("pl-4")}>
                        <div className={cn("relative", "aspect-[3/4]", "w-16", "shrink-0", "overflow-hidden", "rounded-lg", "bg-muted")}>
                          {url ? (
                            <Image src={url} alt={item.name} fill sizes="64px" className="object-cover" />
                          ) : (
                            <div className={cn("flex", "h-full", "w-full", "items-center", "justify-center")}>
                              <Ticket weight="BoldDuotone" className={cn("h-5", "w-5", "text-muted-foreground")} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className={cn("text-sm", "font-medium", "text-foreground")}>{item.name}</p>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex", "items-center", "gap-1.5", "text-xs", "text-muted-foreground")}>
                          <CalendarMark weight="BoldDuotone" className={cn("h-3.5", "w-3.5")} />
                          {formatRange(item.startDate, item.endDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className={cn("line-clamp-1", "max-w-64", "text-xs", "text-muted-foreground")}>
                          {item.description || "—"}
                        </p>
                      </TableCell>
                      <TableCell className={cn("pr-4", "text-right")}>
                        <div className={cn("flex", "items-center", "justify-end", "gap-1")}>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className={cn("p-1.5", "rounded-full", "hover:bg-muted", "transition-colors", "cursor-pointer")}
                              aria-label="Edit"
                            >
                              <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className={cn("p-1.5", "rounded-full", "hover:bg-muted", "transition-colors", "cursor-pointer")}
                              aria-label="Hapus"
                            >
                              <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={editingItem ? "Edit Festival" : "Tambah Festival"}
        maxWidth="sm:max-w-2xl"
        paddingX="px-4"
      >
        <div className={cn("flex", "h-full", "flex-col", "justify-between")}>
          <div className={cn("flex-1", "overflow-y-auto", "overflow-x-hidden", "px-1", "space-y-4")}>
            <p className={cn("text-sm", "text-muted-foreground")}>
              Background akan ditampilkan sebagai latar tiket QR guestbook selama periode festival berlangsung.
            </p>

            <div
              className={cn(
                "relative", "flex", "aspect-[3/4]", "w-full", "max-w-56", "items-center", "justify-center",
                "overflow-hidden", "rounded-xl", "border", "border-dashed", "border-border", "bg-muted",
                "cursor-pointer", "mx-auto",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewSrc ? (
                <Image src={previewSrc} alt="Preview" fill unoptimized sizes="224px" className="object-cover" />
              ) : (
                <div className={cn("flex", "flex-col", "items-center", "gap-1", "text-muted-foreground")}>
                  <Upload weight="BoldDuotone" className={cn("h-6", "w-6")} />
                  <span className={cn("text-xs")}>Klik untuk upload background</span>
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

            <div className={cn("space-y-1.5")}>
              <Label htmlFor="festival-name" className={cn("text-sm", "font-medium", "text-foreground")}>Nama Festival</Label>
              <Input
                id="festival-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nama festival"
              />
            </div>

            <div className={cn("space-y-1.5")}>
              <Label htmlFor="festival-description" className={cn("text-sm", "font-medium", "text-foreground")}>
                Keterangan <span className={cn("text-muted-foreground", "font-normal")}>(opsional)</span>
              </Label>
              <Textarea
                id="festival-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi singkat festival, ditampilkan pada tiket"
                rows={3}
              />
            </div>

            <div className={cn("space-y-1.5")}>
              <Label className={cn("text-sm", "font-medium", "text-foreground")}>Periode Festival</Label>
              <div className={cn("flex", "justify-center", "rounded-xl", "border", "border-border")}>
                <Calendar
                  mode="range"
                  numberOfMonths={1}
                  selected={form.range}
                  onSelect={(range) => setForm((prev) => ({ ...prev, range }))}
                  locale={idLocale}
                />
              </div>
            </div>
          </div>

          <div className={cn("bg-background", "sticky", "bottom-0", "z-10")}>
            <div className={cn("flex", "gap-2", "py-4")}>
              <Button
                variant="outline"
                onClick={closeDrawer}
                disabled={saving}
                className={cn("flex-[40%]", "cursor-pointer")}
              >
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.range?.from || !form.range?.to}
                className={cn("flex-[60%]", "cursor-pointer")}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Festival</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus festival <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
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
