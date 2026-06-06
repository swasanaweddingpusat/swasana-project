"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { AddCircle, PenNewSquare, TrashBinTrash } from "@solar-icons/react";
import {
  useMaintenanceCategories,
  useCreateMaintenanceCategory,
  useUpdateMaintenanceCategory,
  useDeleteMaintenanceCategory,
} from "@/hooks/useMaintenanceCategories";
import type { MaintenanceCategoryItem } from "@/lib/queries/maintenance";

export function MaintenanceCategoryManager() {
  const { data: categories = [], isLoading } = useMaintenanceCategories();
  const { mutateAsync: createCategory, isPending: isCreating } = useCreateMaintenanceCategory();
  const { mutateAsync: updateCategory, isPending: isUpdating } = useUpdateMaintenanceCategory();
  const { mutateAsync: deleteCategory, isPending: isDeleting } = useDeleteMaintenanceCategory();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaintenanceCategoryItem | null>(null);
  const [formName, setFormName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceCategoryItem | null>(null);

  const isSaving = isCreating || isUpdating;

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormOpen(true);
  }

  function handleOpenEdit(item: MaintenanceCategoryItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormOpen(true);
  }

  async function handleSave() {
    const name = formName.trim();
    if (!name) return;

    if (editingItem) {
      await updateCategory({ id: editingItem.id, name });
      toast.success("Kategori berhasil diperbarui.");
    } else {
      await createCategory({ name });
      toast.success("Kategori berhasil ditambahkan.");
    }

    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget.id);
      toast.success("Kategori berhasil dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus kategori.");
    }
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="pb-6">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-start justify-between px-6 py-4 border-b">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Maintenance Category</h2>
                  <span className="text-sm text-muted-foreground">({categories.length})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Kelola kategori untuk ticket maintenance.
                </p>
              </div>
              <Button onClick={handleOpenAdd} className="cursor-pointer shrink-0">
                <AddCircle weight="BoldDuotone" className="w-4 h-4 mr-2" />
                Tambah Kategori
              </Button>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Nama</TableHead>
                    <TableHead className="w-28 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="px-6 font-medium">{item.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end pr-2">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-md hover:bg-muted cursor-pointer"
                              aria-label="Edit"
                            >
                              <PenNewSquare weight="BoldDuotone" className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 rounded-md hover:bg-muted cursor-pointer"
                              aria-label="Hapus"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Nama Kategori</Label>
              <Input
                id="category-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Electrical, Plumbing, AC"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { void handleSave(); }
                }}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                className="flex-1 cursor-pointer"
                disabled={isSaving}
              >
                Batal
              </Button>
              <Button
                onClick={() => { void handleSave(); }}
                disabled={!formName.trim() || isSaving}
                className="flex-1 cursor-pointer"
              >
                {isSaving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kategori <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan dan akan gagal jika masih ada ticket dengan kategori ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { void handleDelete(); }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
