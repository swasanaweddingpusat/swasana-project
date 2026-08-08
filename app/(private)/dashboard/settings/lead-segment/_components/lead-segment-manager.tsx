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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  AddCircle,
  PenNewSquare,
  TrashBinTrash,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import {
  useLeadSegments,
  useCreateLeadSegment,
  useUpdateLeadSegment,
  useDeleteLeadSegment,
} from "@/hooks/use-lead-segments";
import type { LeadSegmentItem } from "@/lib/queries/daily-activity";

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadSegmentManager() {
  const { data: segments = [], isLoading } = useLeadSegments();
  const { mutateAsync: createSegment, isPending: isCreating } = useCreateLeadSegment();
  const { mutateAsync: updateSegment, isPending: isUpdating } = useUpdateLeadSegment();
  const { mutateAsync: deleteSegment, isPending: isDeleting } = useDeleteLeadSegment();

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeadSegmentItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<LeadSegmentItem | null>(null);

  const isSaving = isCreating || isUpdating;
  const sortedItems = [...segments].sort((a, b) => a.sortOrder - b.sortOrder);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormIsActive(true);
    setFormOpen(true);
  }

  function handleOpenEdit(item: LeadSegmentItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormIsActive(item.isActive);
    setFormOpen(true);
  }

  async function handleSave() {
    const name = formName.trim();
    if (!name) return;

    const nextOrder =
      sortedItems.length > 0
        ? Math.max(...sortedItems.map((i) => i.sortOrder)) + 1
        : 0;

    try {
      if (editingItem) {
        await updateSegment({ id: editingItem.id, name, isActive: formIsActive });
        toast.success("Segment berhasil diperbarui.");
      } else {
        await createSegment({ name, isActive: formIsActive, sortOrder: nextOrder });
        toast.success("Segment berhasil ditambahkan.");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan segment.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSegment(deleteTarget.id);
      toast.success("Segment berhasil dihapus.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus segment.");
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
                  <h2 className="text-base font-bold text-foreground">MICE Segment</h2>
                  <span className="text-sm text-muted-foreground">({segments.length})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Kelola master segment/kategori untuk lead MICE. Segment dipilih saat input lead dan disimpan sebagai snapshot.
                </p>
              </div>
              <Button onClick={handleOpenAdd} className="cursor-pointer shrink-0">
                <AddCircle weight="BoldDuotone" className="w-4 h-4 mr-2" />
                Tambah Segment
              </Button>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 px-6">Urutan</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-28 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedItems.map((item) => (
                      <TableRow key={item.id} className={cn(!item.isActive && "opacity-60")}>
                        <TableCell className="px-6 text-muted-foreground font-mono text-sm">
                          {item.sortOrder}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-foreground">{item.name}</span>
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">Aktif</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">Nonaktif</Badge>
                          )}
                        </TableCell>
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
          <DialogTitle>{editingItem ? "Edit Segment" : "Tambah Segment"}</DialogTitle>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="segment-name">Nama Segment</Label>
              <Input
                id="segment-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Government, Banking, Healthcare"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { void handleSave(); }
                }}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="form-is-active" className="text-sm font-medium cursor-pointer">
                  Aktif
                </Label>
                <p className="text-xs text-muted-foreground">Tampilkan segment ini sebagai pilihan di form lead</p>
              </div>
              <Switch id="form-is-active" checked={formIsActive} onCheckedChange={setFormIsActive} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1 cursor-pointer" disabled={isSaving}>
                Batal
              </Button>
              <Button onClick={() => { void handleSave(); }} disabled={!formName.trim() || isSaving} className="flex-1 cursor-pointer">
                {isSaving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus segment <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan. Lead yang sudah menyimpan nama segment ini tidak akan terpengaruh.
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
