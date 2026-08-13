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
  useMaintenanceStatuses,
  useCreateMaintenanceStatus,
  useUpdateMaintenanceStatus,
  useDeleteMaintenanceStatus,
} from "@/hooks/useMaintenanceStatuses";
import type { MaintenanceStatusItem } from "@/lib/queries/maintenance";

export function MaintenanceStatusManager() {
  const { data: statuses = [], isLoading } = useMaintenanceStatuses();
  const { mutateAsync: createStatus, isPending: isCreating } = useCreateMaintenanceStatus();
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateMaintenanceStatus();
  const { mutateAsync: deleteStatus, isPending: isDeleting } = useDeleteMaintenanceStatus();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaintenanceStatusItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formOrder, setFormOrder] = useState<number>(1);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceStatusItem | null>(null);

  const isSaving = isCreating || isUpdating;
  const sortedItems = [...statuses].sort((a, b) => a.order - b.order);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    const nextOrder =
      sortedItems.length > 0
        ? Math.max(...sortedItems.map((i) => i.order)) + 1
        : 1;
    setFormOrder(nextOrder);
    setFormOpen(true);
  }

  function handleOpenEdit(item: MaintenanceStatusItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormOrder(item.order);
    setFormOpen(true);
  }

  async function handleSave() {
    const name = formName.trim();
    if (!name) return;

    if (editingItem) {
      await updateStatus({ id: editingItem.id, name, order: formOrder });
      toast.success("Status berhasil diperbarui.");
    } else {
      await createStatus({ name, order: formOrder });
      toast.success("Status berhasil ditambahkan.");
    }

    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteStatus(deleteTarget.id);
      toast.success("Status berhasil dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus status.");
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
                  <h2 className="text-base font-bold text-foreground">Maintenance Status</h2>
                  <span className="text-sm text-muted-foreground">({statuses.length})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Kelola status untuk ticket maintenance.
                </p>
              </div>
              <Button onClick={handleOpenAdd} className="cursor-pointer shrink-0">
                <AddCircle weight="BoldDuotone" className="w-4 h-4 mr-2" />
                Tambah Status
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
                    <TableHead className="w-24 px-6">Urutan</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-28 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="px-6 font-mono text-sm text-muted-foreground">
                          {item.order}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
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
          <DialogTitle>{editingItem ? "Edit Status" : "Tambah Status"}</DialogTitle>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="status-name">Nama Status</Label>
              <Input
                id="status-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Open, In Progress, Done, Closed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status-order">Urutan</Label>
              <Input
                id="status-order"
                type="number"
                min={1}
                value={formOrder}
                onChange={(e) => setFormOrder(Math.max(1, Number(e.target.value)))}
                placeholder="Contoh: 1, 2, 3"
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
            <AlertDialogTitle>Hapus Status</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus status <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan dan akan gagal jika masih ada ticket dengan status ini.
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
