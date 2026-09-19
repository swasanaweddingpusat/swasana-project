"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { AddCircle, PenNewSquare, TrashBinTrash, Refresh, Magnifer } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { useBonuses, useCreateBonus, useUpdateBonus, useDeleteBonus } from "@/hooks/use-bonuses";
import { createBonusSchema, updateBonusSchema } from "@/lib/validations/bonus";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import type { BonusItem } from "@/lib/queries/bonus";

const ROWS_PER_PAGE = 10;

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function BonusManager() {
  const { can, isAdmin } = usePermissions();
  const { data: bonusesResult, isLoading, isFetching, refetch } = useBonuses({ activeOnly: false, pageSize: 500 });
  const createMutation = useCreateBonus();
  const updateMutation = useUpdateBonus();
  const deleteMutation = useDeleteBonus();

  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BonusItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BonusItem | null>(null);
  const [search, setSearch] = useState("");

  const items = bonusesResult?.data ?? [];
  const saving = createMutation.isPending || updateMutation.isPending;

  async function handleRefresh() {
    const result = await refetch();
    if (result.isSuccess) {
      toast.success("Data diperbarui.");
    } else {
      toast.error("Gagal memuat ulang data.");
    }
  }

  const filteredItems = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;
  const totalPages = Math.ceil(filteredItems.length / ROWS_PER_PAGE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormPrice(0);
    setFormDescription("");
    setFormIsActive(true);
    setFormOpen(true);
  }

  function handleOpenEdit(item: BonusItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.price);
    setFormDescription(item.description ?? "");
    setFormIsActive(item.isActive);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || formPrice < 1) return;
    const payload = {
      name: formName.trim(),
      price: formPrice,
      description: formDescription.trim() || null,
      isActive: formIsActive,
    };

    if (editingItem) {
      const parsed = updateBonusSchema.safeParse(payload);
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      const result = await updateMutation.mutateAsync({ id: editingItem.id, data: parsed.data });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Berhasil diperbarui.");
    } else {
      const parsed = createBonusSchema.safeParse(payload);
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      const result = await createMutation.mutateAsync(parsed.data);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Berhasil ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteMutation.mutateAsync(deleteTarget.id);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menghapus.");
      setDeleteTarget(null);
      return;
    }
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  if (isLoading) {
    return (
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-0">
            <div className={cn("flex", "items-center", "justify-between", "px-4", "sm:px-6", "py-4", "border-b")}>
              <div className={cn("flex", "items-center", "gap-2")}>
                <Skeleton className={cn("h-5", "w-32")} />
                <Skeleton className={cn("h-4", "w-8")} />
              </div>
              <Skeleton className={cn("h-9", "w-24", "rounded-xl")} />
            </div>
            <div className="px-4 sm:px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={cn("flex", "items-center", "gap-4", "py-3", "border-b", "last:border-0")}>
                  <Skeleton className={cn("h-4", "w-8")} />
                  <Skeleton className={cn("h-4", "w-48")} />
                  <Skeleton className={cn("h-4", "w-20")} />
                  <div className="flex-1" />
                  <div className={cn("flex", "gap-1")}>
                    <Skeleton className={cn("h-7", "w-7")} />
                    <Skeleton className={cn("h-7", "w-7")} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-0">
            {/* Header */}
            <div className={cn("flex", "flex-col", "sm:flex-row", "items-start", "sm:items-center", "justify-between", "px-4", "sm:px-6", "py-4", "gap-3", "border-b")}>
              <div className={cn("flex", "items-center", "gap-2")}>
                <h2 className={cn("text-base", "font-bold", "text-foreground")}>Bonus</h2>
                <span className={cn("text-sm", "text-muted-foreground")}>({filteredItems.length})</span>
              </div>
              <div className={cn("flex", "items-center", "gap-2")}>
                <div className="relative">
                  <Magnifer weight="BoldDuotone" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    placeholder="Cari nama..."
                    className="pl-8 h-9 w-48 rounded-xl"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className={cn("h-9", "w-9", "p-0", "cursor-pointer", "rounded-xl")}
                  aria-label="Refresh"
                >
                  <Refresh weight="BoldDuotone" className={cn("w-4", "h-4", isFetching && "animate-spin")} />
                </Button>
                {(can("bonus", "create") || isAdmin) && (
                  <Button onClick={handleOpenAdd} className={cn("cursor-pointer", "rounded-xl")}>
                    <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-2")} /> Tambah
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile: card list (<sm) */}
            <div className="block sm:hidden px-3 py-2 space-y-2">
              {paginatedItems.length === 0 ? (
                <div className={cn("text-center", "py-8", "text-muted-foreground", "text-sm")}>Belum ada data.</div>
              ) : (
                paginatedItems.map((item) => (
                  <Card key={item.id} className="rounded-xl border bg-card shadow-none">
                    <CardContent className="px-3 py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!item.isActive && <Badge variant="secondary" className="text-xs">Nonaktif</Badge>}
                          {(can("bonus", "edit") || isAdmin) && (
                            <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                              <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                            </button>
                          )}
                          {(can("bonus", "delete") || isAdmin) && (
                            <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                              <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground">Rp{fmtRp(item.price)}</p>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
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
                    <TableHead className={cn("w-12", "px-4", "sm:px-6")}>#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-32 text-right">Harga</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className={cn("text-center", "py-8", "text-muted-foreground")}>
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className={cn("px-4", "sm:px-6", "text-muted-foreground")}>
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          Rp{fmtRp(item.price)}
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="default" className="rounded-full text-xs bg-primary/10 text-primary border-0">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary" className="rounded-full text-xs">Nonaktif</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={cn("flex", "items-center", "gap-1", "justify-end", "pr-2")}>
                            {(can("bonus", "edit") || isAdmin) && (
                              <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                                <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                              </button>
                            )}
                            {(can("bonus", "delete") || isAdmin) && (
                              <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                                <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                              </button>
                            )}
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
                label="Navigasi halaman bonus"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Bonus</DialogTitle>
          <div className={cn("space-y-4", "pt-2")}>
            <div className="space-y-1.5">
              <Label htmlFor="form-name">Nama <span className="text-destructive">*</span></Label>
              <Input
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Free Room Upgrade, Bonus Dekorasi"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="form-price">Harga (Rp) <span className="text-destructive">*</span></Label>
              <Input
                id="form-price"
                type="number"
                min={1}
                required
                value={formPrice || ""}
                onChange={(e) => setFormPrice(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="form-description">Deskripsi</Label>
              <Textarea
                id="form-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Keterangan tambahan (opsional)"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Status Aktif</p>
                <p className="text-xs text-muted-foreground">Item nonaktif tidak muncul di dropdown booking</p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>

            <div className={cn("flex", "gap-3")}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn("flex-1", "cursor-pointer", "rounded-xl")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim() || formPrice < 1} className={cn("flex-1", "cursor-pointer", "rounded-xl")}>
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
            <AlertDialogTitle>Hapus Bonus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Item yang sudah di-snapshot di booking lama tidak terpengaruh, tapi item ini tidak bisa dipilih lagi di booking baru.
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
