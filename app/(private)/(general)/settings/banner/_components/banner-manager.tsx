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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AddCircle, AltArrowRight, GalleryWide, Link as LinkIcon, PenNewSquare, TrashBinTrash, Upload } from "@solar-icons/react";
import {
  createBanners,
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

type BannerLocationValue = BannerItem["location"];

const LOCATION_OPTIONS: { value: BannerLocationValue; label: string }[] = [
  { value: "dashboard", label: "Overview" },
  { value: "login", label: "Login" },
];

const DEFAULT_LOCATION: BannerLocationValue = "dashboard";

function labelFor(location: BannerLocationValue): string {
  return LOCATION_OPTIONS.find((o) => o.value === location)?.label ?? location;
}

function toFullUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : key;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function isValidUrl(value: string): boolean {
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
}

interface Props {
  initialData: BannersResult;
}

interface EditFormState {
  title: string;
  caption: string;
  imageKey: string;
  linkUrl: string;
  sortOrder: string;
  isActive: boolean;
  location: BannerLocationValue;
}

interface PendingUpload {
  file: File;
  previewUrl: string;
  title: string;
  caption: string;
  linkUrl: string;
  location: BannerLocationValue;
}

export function BannerManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);

  // Manage (per-module) sheet state — opened by clicking a table row.
  const [manageLocation, setManageLocation] = useState<BannerLocationValue | null>(null);
  // When Edit/Add is opened from inside Manage, remember which module to reopen
  // afterwards so only one drawer is ever mounted at a time (no stacking).
  const [reopenManage, setReopenManage] = useState<BannerLocationValue | null>(null);

  // Add (multi) sheet state
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  // When set, the Add drawer is scoped to one module: new images inherit it and
  // the per-card Modul selector is hidden.
  const [addScopedLocation, setAddScopedLocation] = useState<BannerLocationValue | null>(null);

  // Edit (single) sheet state
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BannerItem | null>(null);
  const [form, setForm] = useState<EditFormState>({
    title: "",
    caption: "",
    imageKey: "",
    linkUrl: "",
    sortOrder: "0",
    isActive: true,
    location: DEFAULT_LOCATION,
  });
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<BannerItem | null>(null);

  const canCreate = can("settings-banner", "create") || isAdmin;
  const canEdit = can("settings-banner", "edit") || isAdmin;
  const canDelete = can("settings-banner", "delete") || isAdmin;

  // Grouped by module (in LOCATION_OPTIONS order), each module's images sorted by
  // carousel order. Empty modules are dropped so only sections with content show.
  const groupedItems = LOCATION_OPTIONS.map((opt) => ({
    location: opt.value,
    label: opt.label,
    rows: items
      .filter((i) => i.location === opt.value)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.rows.length > 0);

  // Images in the module whose Manage drawer is open (recomputed from live items
  // so toggles/edits/deletes reflect immediately). Empty until a row is clicked.
  const manageRows = manageLocation
    ? items
        .filter((i) => i.location === manageLocation)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  // Revoke the edit blob preview URL when replaced/cleared or on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Revoke every pending add-preview URL on unmount.
  useEffect(() => {
    return () => {
      setPending((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return prev;
      });
    };
  }, []);

  function countFor(location: BannerLocationValue): number {
    return items.filter((i) => i.location === location).length;
  }

  // ─── Add (multi) ──────────────────────────────────────────────────────────

  function resetPending() {
    setPending((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }

  function handleOpenAdd(scoped?: BannerLocationValue) {
    resetPending();
    setAddScopedLocation(scoped ?? null);
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
    resetPending();
    setAddScopedLocation(null);
    // Reopen the Manage drawer if Add was launched from inside it.
    if (reopenManage) {
      setManageLocation(reopenManage);
      setReopenManage(null);
    }
  }

  const handleAddFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const accepted: PendingUpload[] = [];
    for (const file of files) {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`"${file.name}" dilewati — tipe tidak didukung.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`"${file.name}" dilewati — melebihi 5MB.`);
        continue;
      }
      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
        title: stripExtension(file.name),
        caption: "",
        linkUrl: "",
        location: addScopedLocation ?? DEFAULT_LOCATION,
      });
    }
    if (accepted.length > 0) setPending((prev) => [...prev, ...accepted]);
  }, [addScopedLocation]);

  function updatePending(
    index: number,
    patch: Partial<Pick<PendingUpload, "title" | "caption" | "linkUrl" | "location">>,
  ) {
    setPending((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePending(index: number) {
    setPending((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSaveAdd() {
    if (pending.length === 0) return;

    // Validate every card before spending any uploads — one bad field shouldn't
    // leave orphaned images in storage.
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (!p.title.trim()) {
        toast.error(`Banner #${i + 1}: judul wajib diisi.`);
        return;
      }
      if (p.linkUrl.trim() && !isValidUrl(p.linkUrl.trim())) {
        toast.error(`Banner #${i + 1}: link tidak valid (contoh: https://…).`);
        return;
      }
    }

    setAdding(true);

    // Carousel order is per-module — pick up where each module's sequence left off.
    const nextSort: Record<string, number> = {};
    for (const opt of LOCATION_OPTIONS) {
      const locItems = items.filter((i) => i.location === opt.value);
      nextSort[opt.value] = locItems.length ? Math.max(...locItems.map((i) => i.sortOrder)) + 1 : 0;
    }

    const uploaded: {
      title: string;
      caption?: string;
      linkUrl?: string;
      imageKey: string;
      originalName?: string;
      fileName?: string;
      mimeType?: string;
      sortOrder: number;
      location: BannerLocationValue;
    }[] = [];

    try {
      for (const item of pending) {
        const fd = new FormData();
        fd.set("file", item.file);
        const res = await fetch("/api/upload/banner", { method: "POST", body: fd });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Upload "${item.file.name}" gagal`);
        }
        const data = (await res.json()) as {
          key: string;
          fileName?: string;
          originalName?: string;
          mimeType?: string;
        };
        uploaded.push({
          title: item.title.trim(),
          caption: item.caption.trim() || undefined,
          linkUrl: item.linkUrl.trim() || undefined,
          imageKey: data.key,
          originalName: data.originalName,
          fileName: data.fileName,
          mimeType: data.mimeType,
          sortOrder: nextSort[item.location]++,
          location: item.location,
        });
      }
    } catch (err) {
      setAdding(false);
      toast.error(err instanceof Error ? err.message : "Gagal upload gambar.");
      return;
    }

    const result = await createBanners({ items: uploaded });
    setAdding(false);

    if (!result.success) {
      toast.error(result.error ?? "Gagal menyimpan banner.");
      return;
    }

    setItems((prev) => [...prev, ...result.banners]);
    toast.success(`${result.banners.length} banner ditambahkan.`);
    closeAdd();
  }

  // ─── Edit (single) ────────────────────────────────────────────────────────

  function resetEditFile() {
    setSelectedFile(null);
    setPreviewUrl(null);
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
      location: item.location,
    });
    resetEditFile();
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    resetEditFile();
    // Reopen the Manage drawer if Edit was launched from inside it.
    if (reopenManage) {
      setManageLocation(reopenManage);
      setReopenManage(null);
    }
  }

  // ─── Manage (per-module) ──────────────────────────────────────────────────

  function openManage(location: BannerLocationValue) {
    setManageLocation(location);
  }

  function closeManage() {
    setManageLocation(null);
  }

  // Launch Edit from inside Manage: close Manage first, remember to reopen it.
  function handleEditFromManage(item: BannerItem) {
    setReopenManage(item.location);
    setManageLocation(null);
    handleOpenEdit(item);
  }

  // Launch Add scoped to this module from inside Manage.
  function handleAddFromManage(location: BannerLocationValue) {
    setReopenManage(location);
    setManageLocation(null);
    handleOpenAdd(location);
  }

  const handleEditFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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

  async function handleSaveEdit() {
    if (!editingItem) return;
    if (!form.title.trim() || (!selectedFile && !form.imageKey)) return;
    if (form.linkUrl.trim() && !isValidUrl(form.linkUrl.trim())) {
      toast.error("Link tidak valid (contoh: https://…).");
      return;
    }

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
      location: form.location,
    };

    const result = await updateBanner(editingItem.id, payload);

    if (!result.success) {
      setSaving(false);
      toast.error(result.error ?? "Gagal menyimpan banner.");
      return;
    }

    const updatedBanner = result.banner;

    setSaving(false);
    setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updatedBanner : i)));
    toast.success("Berhasil diperbarui.");
    closeEdit();
  }

  // ─── Row actions ──────────────────────────────────────────────────────────

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

  const previewSrc = previewUrl ?? toFullUrl(form.imageKey);

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <div className={cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3", "pb-4")}>
          <div>
            <h2 className={cn("text-sm", "font-medium", "text-foreground")}>Banner</h2>
            <p className={cn("text-xs", "text-muted-foreground", "mt-0.5")}>
              {items.length} banner — Overview {countFor("dashboard")} · Login {countFor("login")}
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => handleOpenAdd()} className={cn("rounded-full", "cursor-pointer")}>
              <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-2")} /> Tambah
            </Button>
          )}
        </div>

        {groupedItems.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className={cn("flex", "flex-col", "items-center", "justify-center", "gap-2", "py-12", "text-center")}>
              <GalleryWide weight="BoldDuotone" className={cn("h-10", "w-10", "text-muted-foreground")} />
              <p className={cn("text-sm", "text-muted-foreground")}>
                Belum ada banner. Klik <span className={cn("font-medium", "text-foreground")}>Tambah</span> untuk menambahkan.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className={cn("rounded-2xl", "overflow-hidden", "py-0", "shadow-sm")}>
            <Table>
              <TableHeader>
                <TableRow className={cn("bg-muted/50", "hover:bg-muted/50")}>
                  <TableHead className={cn("w-52", "pl-4")}>Preview</TableHead>
                  <TableHead>Modul</TableHead>
                  <TableHead className={cn("text-center")}>Gambar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className={cn("pr-4", "text-right")}>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedItems.map((group) => {
                  const isCarousel = group.rows.length > 1;
                  const activeCount = group.rows.filter((r) => r.isActive).length;
                  // Show up to 2 real thumbnails; the rest collapse into one "+N" tile.
                  const previews = group.rows.slice(0, 2);
                  const remaining = group.rows.length - previews.length;
                  return (
                    <TableRow
                      key={group.location}
                      onClick={() => openManage(group.location)}
                      className={cn("cursor-pointer")}
                    >
                      <TableCell className={cn("pl-4")}>
                        <div className={cn("flex", "items-center", "gap-1.5")}>
                          {previews.map((item) => {
                            const url = toFullUrl(item.imageKey);
                            return (
                              <div key={item.id} className={cn("relative", "aspect-[3/1]", "w-20", "shrink-0", "overflow-hidden", "rounded-md", "bg-muted")}>
                                {url && (
                                  <Image
                                    src={url}
                                    alt={item.title}
                                    fill
                                    sizes="80px"
                                    className={cn("object-cover", !item.isActive && "opacity-40")}
                                  />
                                )}
                              </div>
                            );
                          })}
                          {remaining > 0 && (
                            <div className={cn("flex", "aspect-[3/1]", "w-20", "shrink-0", "flex-col", "items-center", "justify-center", "rounded-md", "border", "border-dashed", "border-border", "bg-muted/50", "leading-none")}>
                              <span className={cn("font-heading", "text-sm", "font-semibold", "text-foreground", "tabular-nums")}>+{remaining}</span>
                              <span className={cn("text-[10px]", "text-muted-foreground")}>lainnya</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className={cn("text-sm", "font-medium", "text-foreground")}>{group.label}</p>
                        <p className={cn("text-xs", "text-muted-foreground", "mt-0.5")}>
                          {isCarousel ? "Tampil sebagai carousel" : "Tampil tunggal"}
                        </p>
                      </TableCell>
                      <TableCell className={cn("text-center")}>
                        <span className={cn("inline-flex", "min-w-8", "items-center", "justify-center", "rounded-full", "bg-muted", "px-2.5", "py-0.5", "text-xs", "font-medium", "text-foreground", "tabular-nums")}>
                          {group.rows.length}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs", activeCount > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {activeCount} aktif
                          {activeCount < group.rows.length && (
                            <span className={cn("text-muted-foreground")}> · {group.rows.length - activeCount} nonaktif</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className={cn("pr-4", "text-right")}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openManage(group.location); }}
                          className={cn("inline-flex", "items-center", "gap-1", "rounded-full", "bg-muted", "px-3", "py-1.5", "text-xs", "font-medium", "text-foreground", "transition-colors", "hover:bg-accent", "cursor-pointer")}
                        >
                          Kelola
                          <AltArrowRight weight="BoldDuotone" className={cn("h-3.5", "w-3.5")} />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Add Drawer (multi upload) — same shell as booking wedding create drawer */}
      <Drawer
        isOpen={addOpen}
        onClose={closeAdd}
        title={addScopedLocation ? `Tambah Gambar — ${labelFor(addScopedLocation)}` : "Tambah Banner"}
        maxWidth="sm:max-w-2xl"
        paddingX="px-4"
      >
        <div className={cn("flex", "h-full", "flex-col", "justify-between")}>
          <div className={cn("flex-1", "overflow-y-auto", "overflow-x-hidden", "px-1", "space-y-4")}>
            <p className={cn("text-sm", "text-muted-foreground")}>
              {addScopedLocation
                ? `Gambar baru masuk ke modul ${labelFor(addScopedLocation)}. Pilih beberapa sekaligus — tinggal isi judul, link, dan keterangannya.`
                : "Pilih beberapa gambar sekaligus. Tiap gambar jadi satu banner — atur modul, judul, link, dan keterangannya. Satu gambar tampil tunggal, banyak gambar jadi carousel."}
            </p>

            <button
              type="button"
              onClick={() => addInputRef.current?.click()}
              className={cn(
                "flex", "w-full", "items-center", "justify-center", "gap-2",
                "rounded-xl", "border", "border-dashed", "border-border", "bg-muted/50",
                "py-4", "text-sm", "text-muted-foreground",
                "transition-colors", "hover:bg-muted", "hover:text-foreground", "cursor-pointer",
              )}
            >
              <Upload weight="BoldDuotone" className={cn("h-5", "w-5")} />
              {pending.length > 0 ? "Tambah gambar lagi" : "Pilih gambar (bisa banyak)"}
            </button>
            <input
              ref={addInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddFilesChange}
            />

            {pending.length === 0 ? (
              <div className={cn("flex", "flex-col", "items-center", "justify-center", "gap-2", "rounded-2xl", "border", "border-border", "bg-card", "py-12", "text-center")}>
                <GalleryWide weight="BoldDuotone" className={cn("h-9", "w-9", "text-muted-foreground")} />
                <p className={cn("text-sm", "text-muted-foreground")}>Belum ada gambar dipilih.</p>
              </div>
            ) : (
              <div className={cn("space-y-3")}>
                {pending.map((p, idx) => (
                  <div
                    key={p.previewUrl}
                    className={cn("rounded-2xl", "border", "border-border", "bg-card", "p-4", "space-y-3", "shadow-sm")}
                  >
                    <div className={cn("relative", "aspect-[3/1]", "w-full", "overflow-hidden", "rounded-xl", "bg-muted")}>
                      <Image src={p.previewUrl} alt={p.file.name} fill unoptimized sizes="(max-width: 640px) 100vw, 640px" className="object-cover" />
                      <span className={cn("absolute", "top-2", "left-2", "rounded-full", "bg-card/90", "px-2", "py-0.5", "text-xs", "font-medium", "text-foreground", "shadow-sm")}>
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePending(idx)}
                        aria-label="Hapus dari seleksi"
                        className={cn(
                          "absolute", "top-2", "right-2", "flex", "h-7", "w-7", "items-center", "justify-center",
                          "rounded-full", "bg-card/90", "text-destructive", "shadow-sm", "transition-colors", "hover:bg-card", "cursor-pointer",
                        )}
                      >
                        <TrashBinTrash weight="BoldDuotone" className={cn("h-4", "w-4")} />
                      </button>
                    </div>

                    {!addScopedLocation && (
                      <div className={cn("space-y-1.5")}>
                        <Label className={cn("text-sm", "font-medium", "text-foreground")}>Modul</Label>
                        <Select value={p.location} onValueChange={(v) => updatePending(idx, { location: v as BannerLocationValue })}>
                          <SelectTrigger className={cn("w-full")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LOCATION_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className={cn("space-y-1.5")}>
                      <Label htmlFor={`pending-title-${idx}`} className={cn("text-sm", "font-medium", "text-foreground")}>Judul</Label>
                      <Input
                        id={`pending-title-${idx}`}
                        value={p.title}
                        onChange={(e) => updatePending(idx, { title: e.target.value })}
                        placeholder="Judul banner"
                      />
                    </div>

                    <div className={cn("space-y-1.5")}>
                      <Label htmlFor={`pending-link-${idx}`} className={cn("flex", "items-center", "gap-1.5", "text-sm", "font-medium", "text-foreground")}>
                        <LinkIcon weight="BoldDuotone" className={cn("h-3.5", "w-3.5", "text-muted-foreground")} />
                        Link tujuan <span className={cn("text-muted-foreground", "font-normal")}>(opsional)</span>
                      </Label>
                      <Input
                        id={`pending-link-${idx}`}
                        value={p.linkUrl}
                        onChange={(e) => updatePending(idx, { linkUrl: e.target.value })}
                        placeholder="https://…"
                        inputMode="url"
                      />
                    </div>

                    <div className={cn("space-y-1.5")}>
                      <Label htmlFor={`pending-caption-${idx}`} className={cn("text-sm", "font-medium", "text-foreground")}>
                        Keterangan <span className={cn("text-muted-foreground", "font-normal")}>(opsional)</span>
                      </Label>
                      <Textarea
                        id={`pending-caption-${idx}`}
                        value={p.caption}
                        onChange={(e) => updatePending(idx, { caption: e.target.value })}
                        placeholder="Deskripsi singkat banner"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cn("bg-background", "sticky", "bottom-0", "z-10")}>
            <div className={cn("flex", "gap-2", "py-4")}>
              <Button
                variant="outline"
                onClick={closeAdd}
                disabled={adding}
                className={cn("flex-[40%]", "cursor-pointer")}
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveAdd}
                disabled={adding || pending.length === 0}
                className={cn("flex-[60%]", "cursor-pointer")}
              >
                {adding ? "Mengunggah..." : `Tambah${pending.length > 0 ? ` (${pending.length})` : ""}`}
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Edit Drawer (single) — same shell as Add & booking wedding create */}
      <Drawer isOpen={editOpen} onClose={closeEdit} title="Edit Banner" maxWidth="sm:max-w-2xl" paddingX="px-4">
        <div className={cn("flex", "h-full", "flex-col", "justify-between")}>
          <div className={cn("flex-1", "overflow-y-auto", "overflow-x-hidden", "px-1", "space-y-4")}>
            <p className={cn("text-sm", "text-muted-foreground")}>Ubah gambar, modul, dan detail banner ini.</p>
            <div className={cn("rounded-2xl", "border", "border-border", "bg-card", "p-4", "space-y-3", "shadow-sm")}>
              <div
                className={cn(
                  "relative", "flex", "aspect-[3/1]", "w-full", "items-center", "justify-center",
                  "overflow-hidden", "rounded-xl", "border", "border-dashed", "border-border", "bg-muted",
                  "cursor-pointer",
                )}
                onClick={() => editInputRef.current?.click()}
              >
                {previewSrc ? (
                  <Image
                    src={previewSrc}
                    alt="Preview"
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 100vw, 640px"
                    className="object-cover"
                  />
                ) : (
                  <div className={cn("flex", "flex-col", "items-center", "gap-1", "text-muted-foreground")}>
                    <Upload weight="BoldDuotone" className={cn("h-6", "w-6")} />
                    <span className={cn("text-xs")}>Klik untuk upload gambar</span>
                  </div>
                )}
              </div>
              <input
                ref={editInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEditFileChange}
              />

              <div className={cn("space-y-1.5")}>
                <Label className={cn("text-sm", "font-medium", "text-foreground")}>Modul</Label>
                <Select value={form.location} onValueChange={(v) => setForm((prev) => ({ ...prev, location: v as BannerLocationValue }))}>
                  <SelectTrigger className={cn("w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={cn("space-y-1.5")}>
                <Label htmlFor="edit-title" className={cn("text-sm", "font-medium", "text-foreground")}>Judul</Label>
                <Input
                  id="edit-title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Judul banner"
                />
              </div>

              <div className={cn("space-y-1.5")}>
                <Label htmlFor="edit-link" className={cn("flex", "items-center", "gap-1.5", "text-sm", "font-medium", "text-foreground")}>
                  <LinkIcon weight="BoldDuotone" className={cn("h-3.5", "w-3.5", "text-muted-foreground")} />
                  Link tujuan <span className={cn("text-muted-foreground", "font-normal")}>(opsional)</span>
                </Label>
                <Input
                  id="edit-link"
                  value={form.linkUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                  placeholder="https://…"
                  inputMode="url"
                />
              </div>

              <div className={cn("space-y-1.5")}>
                <Label htmlFor="edit-caption" className={cn("text-sm", "font-medium", "text-foreground")}>
                  Keterangan <span className={cn("text-muted-foreground", "font-normal")}>(opsional)</span>
                </Label>
                <Textarea
                  id="edit-caption"
                  value={form.caption}
                  onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
                  placeholder="Deskripsi singkat banner"
                  rows={2}
                />
              </div>

              <div className={cn("grid", "grid-cols-2", "gap-3")}>
                <div className={cn("space-y-1.5")}>
                  <Label htmlFor="edit-sort" className={cn("text-sm", "font-medium", "text-foreground")}>Urutan</Label>
                  <Input
                    id="edit-sort"
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                </div>
                <div className={cn("flex", "items-end", "justify-between", "pb-2")}>
                  <Label htmlFor="edit-active" className={cn("text-sm", "font-medium", "text-foreground")}>Aktif</Label>
                  <Switch
                    id="edit-active"
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={cn("bg-background", "sticky", "bottom-0", "z-10")}>
            <div className={cn("flex", "gap-2", "py-4")}>
              <Button
                variant="outline"
                onClick={closeEdit}
                disabled={saving}
                className={cn("flex-[40%]", "cursor-pointer")}
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={saving || !form.title.trim() || (!selectedFile && !form.imageKey)}
                className={cn("flex-[60%]", "cursor-pointer")}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Manage Drawer (per-module) — list every image in one module, manage each */}
      <Drawer
        isOpen={manageLocation !== null}
        onClose={closeManage}
        title={manageLocation ? `Kelola — ${labelFor(manageLocation)}` : "Kelola"}
        maxWidth="sm:max-w-2xl"
        paddingX="px-4"
      >
        <div className={cn("flex", "h-full", "flex-col", "justify-between")}>
          <div className={cn("flex-1", "overflow-y-auto", "overflow-x-hidden", "px-1", "space-y-4")}>
            <div className={cn("flex", "items-center", "justify-between", "gap-3")}>
              <p className={cn("text-sm", "text-muted-foreground")}>
                {manageRows.length > 1
                  ? `${manageRows.length} gambar — tampil sebagai carousel, urut dari atas.`
                  : manageRows.length === 1
                    ? "1 gambar — tampil tunggal."
                    : "Belum ada gambar di modul ini."}
              </p>
              {canCreate && manageLocation && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddFromManage(manageLocation)}
                  className={cn("shrink-0", "rounded-full", "cursor-pointer")}
                >
                  <AddCircle weight="BoldDuotone" className={cn("h-4", "w-4")} />
                  Tambah
                </Button>
              )}
            </div>

            {manageRows.length === 0 ? (
              <div className={cn("flex", "flex-col", "items-center", "justify-center", "gap-2", "rounded-2xl", "border", "border-dashed", "border-border", "bg-card", "py-12", "text-center")}>
                <GalleryWide weight="BoldDuotone" className={cn("h-9", "w-9", "text-muted-foreground")} />
                <p className={cn("text-sm", "text-muted-foreground")}>
                  Belum ada gambar. Klik <span className={cn("font-medium", "text-foreground")}>Tambah</span> untuk mengisi.
                </p>
              </div>
            ) : (
              <div className={cn("space-y-3")}>
                {manageRows.map((item, idx) => {
                  const url = toFullUrl(item.imageKey);
                  return (
                    <div
                      key={item.id}
                      className={cn("flex", "flex-col", "gap-3", "rounded-2xl", "border", "border-border", "bg-card", "p-3", "shadow-sm", "sm:flex-row", "sm:items-center", "sm:gap-4")}
                    >
                      <div className={cn("flex", "items-center", "gap-3")}>
                        {manageRows.length > 1 && (
                          <span className={cn("flex", "h-6", "w-6", "shrink-0", "items-center", "justify-center", "rounded-full", "bg-primary/10", "font-heading", "text-xs", "font-semibold", "text-primary", "tabular-nums")}>
                            {idx + 1}
                          </span>
                        )}
                        <div className={cn("relative", "aspect-[3/1]", "w-32", "shrink-0", "overflow-hidden", "rounded-lg", "bg-muted", "sm:w-36")}>
                          {url && (
                            <Image
                              src={url}
                              alt={item.title}
                              fill
                              unoptimized
                              sizes="144px"
                              className={cn("object-cover", !item.isActive && "opacity-40")}
                            />
                          )}
                        </div>
                      </div>

                      <div className={cn("min-w-0", "flex-1")}>
                        <p className={cn("truncate", "text-sm", "font-medium", "text-foreground")}>{item.title}</p>
                        {item.caption && (
                          <p className={cn("mt-0.5", "line-clamp-1", "text-xs", "text-muted-foreground")}>{item.caption}</p>
                        )}
                        {item.linkUrl && (
                          <a
                            href={item.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn("mt-1.5", "inline-flex", "max-w-full", "items-center", "gap-1.5", "rounded-full", "bg-muted", "px-2.5", "py-1", "text-xs", "text-muted-foreground", "transition-colors", "hover:text-primary")}
                          >
                            <LinkIcon weight="BoldDuotone" className={cn("h-3", "w-3", "shrink-0")} />
                            <span className={cn("truncate")}>{item.linkUrl}</span>
                          </a>
                        )}
                      </div>

                      <div className={cn("flex", "items-center", "justify-between", "gap-3", "sm:justify-end")}>
                        <div className={cn("flex", "items-center", "gap-2")}>
                          <Switch
                            checked={item.isActive}
                            onCheckedChange={() => handleToggleActive(item)}
                            disabled={!canEdit}
                          />
                          <span className={cn("text-xs", item.isActive ? "text-foreground" : "text-muted-foreground")}>
                            {item.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                        <div className={cn("flex", "items-center", "gap-1")}>
                          {canEdit && (
                            <button
                              onClick={() => handleEditFromManage(item)}
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cn("bg-background", "sticky", "bottom-0", "z-10")}>
            <div className={cn("py-4")}>
              <Button
                variant="outline"
                onClick={closeManage}
                className={cn("w-full", "cursor-pointer")}
              >
                Selesai
              </Button>
            </div>
          </div>
        </div>
      </Drawer>

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
