"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { AddCircle, PenNewSquare, TrashBinTrash, Magnifer, Refresh } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import {
  createPackageTypeCategory,
  updatePackageTypeCategory,
  deletePackageTypeCategory,
} from "@/actions/package-type-category";
import { usePermissions } from "@/hooks/use-permissions";
import type { PackageTypeCategoriesResult, PackageTypeCategoryItem } from "@/lib/queries/package-type-categories";
import { cn } from "@/lib/utils";

interface Props {
  initialData: PackageTypeCategoriesResult;
}

const ROWS_PER_PAGE = 10;

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <Badge variant="default" className="rounded-full bg-primary text-primary-foreground border-0">
        Aktif
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="rounded-full">
      Nonaktif
    </Badge>
  );
}

export function PackageTypeCategoryManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackageTypeCategoryItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PackageTypeCategoryItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canCreate = can("settings-package-category", "create") || isAdmin;
  const canEdit = can("settings-package-category", "edit") || isAdmin;
  const canDelete = can("settings-package-category", "delete") || isAdmin;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/package-type-categories/settings");
      if (res.ok) {
        const data = (await res.json()) as PackageTypeCategoriesResult;
        setItems(data);
        toast.success("Data diperbarui.");
      } else {
        toast.error("Gagal memuat ulang data.");
      }
    } catch {
      toast.error("Gagal memuat ulang data.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filtered = items.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const isAllSelected = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
  const isIndeterminate = selected.size > 0 && !isAllSelected;

  function handleSelectAll(checked: boolean) {
    const next = new Set(selected);
    paginated.forEach((c) => (checked ? next.add(c.id) : next.delete(c.id)));
    setSelected(next);
  }

  function handleSelect(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelected(next);
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormCode("");
    setFormIsActive(true);
    setFormOpen(true);
  }

  function handleOpenEdit(item: PackageTypeCategoryItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code);
    setFormIsActive(item.isActive);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCode.trim()) return;
    setSaving(true);
    const payload = { name: formName.trim(), code: formCode.trim(), isActive: formIsActive };
    const result = editingItem
      ? await updatePackageTypeCategory(editingItem.id, payload)
      : await createPackageTypeCategory(payload);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (editingItem) {
      setItems((prev) => prev.map((c) => (c.id === editingItem.id ? { ...c, ...result.item } : c)));
      toast.success("Berhasil diperbarui.");
    } else {
      setItems((prev) => [...prev, { ...result.item, createdAt: new Date() }]);
      toast.success("Berhasil ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deletePackageTypeCategory(deleteTarget.id);
    setDeleting(false);
    if (!result.success) {
      toast.error(result.error);
      setDeleteTarget(null);
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    toast.success("Kategori paket dihapus.");
    setDeleteTarget(null);
  }

  async function handleBulkDelete() {
    setDeleting(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      await deletePackageTypeCategory(id);
    }
    setItems((prev) => prev.filter((c) => !ids.includes(c.id)));
    setSelected(new Set());
    setDeleting(false);
    setBulkDeleteOpen(false);
    toast.success(`${ids.length} kategori paket dihapus.`);
  }

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <Card className="shadow-none">
          <CardContent className="p-0">
            {/* Header */}
            <div className={cn("flex", "flex-col", "sm:flex-row", "justify-between", "items-start", "sm:items-center", "px-4", "sm:px-6", "pb-4", "gap-3", "border-b")}>
              <div className={cn("flex", "items-center", "gap-2")}>
                <span className={cn("text-base", "font-bold", "text-foreground")}>Paket Category</span>
                <span className={cn("text-sm", "text-muted-foreground")}>({filtered.length})</span>
              </div>
              <div className={cn("flex", "flex-wrap", "items-center", "gap-2", "w-full", "sm:w-auto")}>
                <div className="relative flex-1 sm:flex-none">
                  <Magnifer weight="BoldDuotone" className={cn("absolute", "left-3", "top-1/2", "-translate-y-1/2", "h-4", "w-4", "text-muted-foreground")} />
                  <Input
                    placeholder="Search paket..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={cn("pl-9", "w-full", "sm:w-56", "h-9", "text-sm")}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={cn("h-9", "w-9", "p-0", "cursor-pointer", "shrink-0")}
                  aria-label="Refresh"
                >
                  <Refresh weight="BoldDuotone" className={cn("w-4", "h-4", refreshing && "animate-spin")} />
                </Button>
                {canDelete && selected.size > 1 && (
                  <Button variant="outline" onClick={() => setBulkDeleteOpen(true)} className={cn("h-9", "text-destructive", "border-destructive", "hover:bg-destructive/10", "cursor-pointer")}>
                    <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "mr-1")} /> Hapus ({selected.size})
                  </Button>
                )}
                {canCreate && (
                  <Button onClick={handleOpenAdd} className={cn("h-9", "cursor-pointer", "shrink-0")}>
                    <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-1")} /> Add New Paket
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile: card list (<sm) */}
            <div className="block sm:hidden px-3 py-2 space-y-2">
              {paginated.length === 0 ? (
                <div className={cn("text-center", "py-8", "text-muted-foreground", "text-sm")}>
                  {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada kategori paket."}
                </div>
              ) : (
                paginated.map((item, idx) => (
                  <Card key={item.id} className="rounded-lg border bg-card shadow-none">
                    <CardContent className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={selected.has(item.id)} onCheckedChange={(c) => handleSelect(item.id, c as boolean)} className="cursor-pointer mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}. {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("inline-flex", "items-center", "rounded-md", "bg-secondary", "px-2", "py-0.5", "text-xs", "font-mono", "font-medium")}>
                              {item.code}
                            </span>
                            <StatusBadge isActive={item.isActive} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 justify-end pt-1 border-t border-border">
                        {canEdit && (
                          <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                            <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                            <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop/tablet: table (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={cn("w-10", "px-4")}>
                      <Checkbox checked={isAllSelected} data-indeterminate={isIndeterminate} onCheckedChange={handleSelectAll} className="cursor-pointer" />
                    </TableHead>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="w-32">Kode</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-20 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className={cn("text-center", "py-8", "text-muted-foreground")}>
                        {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada kategori paket."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="px-4">
                          <Checkbox checked={selected.has(item.id)} onCheckedChange={(c) => handleSelect(item.id, c as boolean)} className="cursor-pointer" />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                        <TableCell>
                          <span className={cn("inline-flex", "items-center", "rounded-md", "bg-secondary", "px-2", "py-0.5", "text-xs", "font-mono", "font-medium")}>
                            {item.code}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <StatusBadge isActive={item.isActive} />
                        </TableCell>
                        <TableCell>
                          <div className={cn("flex", "items-center", "gap-1", "justify-end", "pr-2")}>
                            <TooltipProvider>
                              {canEdit && (
                                <Tooltip>
                                  <TooltipTrigger
                                    onClick={() => handleOpenEdit(item)}
                                    className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")}
                                    aria-label="Edit"
                                  >
                                    <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Kategori</TooltipContent>
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Tooltip>
                                  <TooltipTrigger
                                    onClick={() => setDeleteTarget(item)}
                                    className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")}
                                    aria-label="Hapus"
                                  >
                                    <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                                  </TooltipTrigger>
                                  <TooltipContent>Hapus Kategori</TooltipContent>
                                </Tooltip>
                              )}
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                label="Navigasi halaman kategori paket"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Kategori Paket</DialogTitle>
          <div className={cn("space-y-4", "pt-2")}>
            <div className="space-y-1.5">
              <Label>Nama</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Contoh: Paket Hadjatan" />
            </div>
            <div className="space-y-1.5">
              <Label>Kode</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="Contoh: HADJATAN"
                maxLength={10}
                className="font-mono uppercase"
              />
            </div>
            <div className={cn("flex", "items-center", "justify-between")}>
              <Label htmlFor="package-type-category-active">Aktif</Label>
              <Switch id="package-type-category-active" checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>
            <div className={cn("flex", "gap-3")}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn("flex-1", "cursor-pointer")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim() || !formCode.trim()} className={cn("flex-1", "cursor-pointer")}>
                {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori Paket</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}>
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selected.size} Kategori</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selected.size} kategori yang dipilih? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={deleting} className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}>
              {deleting ? "Menghapus..." : `Hapus ${selected.size} Kategori`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
