"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, PenLine, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { createEducationLevel, updateEducationLevel, deleteEducationLevel } from "@/actions/education-level";
import { usePermissions } from "@/hooks/use-permissions";
import type { EducationLevelsResult, EducationLevelItem } from "@/lib/queries/education-level";
import { cn } from "../../../../../../lib/utils";

interface Props {
  initialData: EducationLevelsResult;
}

const ROWS_PER_PAGE = 10;

export function EducationLevelManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formOrder, setFormOrder] = useState("");
  const [editingItem, setEditingItem] = useState<EducationLevelItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EducationLevelItem | null>(null);

  const totalPages = Math.ceil(items.length / ROWS_PER_PAGE);
  const paginatedItems = items.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormOrder(String(items.length + 1));
    setFormOpen(true);
  }

  function handleOpenEdit(item: EducationLevelItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormOrder(String(item.order));
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    const order = parseInt(formOrder) || 0;
    const result = editingItem
      ? await updateEducationLevel(editingItem.id, formName, order)
      : await createEducationLevel(formName, order);

    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }

    if (editingItem) {
      setItems((prev) => prev.map((i) => i.id === editingItem.id ? { ...i, name: formName.trim(), order } : i));
      toast.success("Berhasil diperbarui.");
    } else {
      setItems((prev) => [...prev, result.item as EducationLevelItem].sort((a, b) => a.order - b.order));
      toast.success("Berhasil ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteEducationLevel(deleteTarget.id);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  return (
    <>
      <div className={cn('px-6', 'pb-6')}>
        <Card>
          <CardContent className="p-0">
            {/* Header */}
            <div className={cn('flex', 'items-center', 'justify-between', 'px-6', 'pb-4', 'border-b')}>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <h2 className={cn('text-base', 'font-bold', 'text-[#1D1D1D]')}>Tingkat Pendidikan</h2>
                <span className={cn('text-sm', 'text-muted-foreground')}>({items.length})</span>
              </div>
              {(can("settings", "create") || isAdmin) && (
                <Button onClick={handleOpenAdd} className={cn('bg-gray-900', 'hover:bg-gray-800', 'text-white', 'cursor-pointer')}>
                  <Plus className={cn('w-4', 'h-4', 'mr-2')} /> Tambah
                </Button>
              )}
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn('w-12', 'px-6')}>#</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className={cn('w-24', 'text-center')}>Urutan</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className={cn('text-center', 'py-8', 'text-muted-foreground')}>
                      Belum ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className={cn('px-6', 'text-muted-foreground')}>
                        {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className={cn('text-center', 'text-muted-foreground')}>{item.order}</TableCell>
                      <TableCell>
                        <div className={cn('flex', 'items-center', 'gap-1', 'justify-end', 'pr-2')}>
                          {(can("settings", "edit") || isAdmin) && (
                            <button onClick={() => handleOpenEdit(item)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Edit">
                              <PenLine className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                            </button>
                          )}
                          {(can("settings", "delete") || isAdmin) && (
                            <button onClick={() => setDeleteTarget(item)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Hapus">
                              <Trash2 className={cn('w-4', 'h-4', 'text-red-500')} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={cn('flex', 'items-center', 'justify-between', 'px-6', 'py-3', 'border-t')}>
                <span className={cn('text-sm', 'text-muted-foreground')}>
                  Page {currentPage} of {totalPages}
                </span>
                <div className={cn('flex', 'gap-1')}>
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    <ArrowLeft className={cn('h-4', 'w-4')} />
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    <ArrowRight className={cn('h-4', 'w-4')} />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Tingkat Pendidikan</DialogTitle>
          <div className={cn('space-y-4', 'pt-2')}>
            <div>
              <Label className="text-sm">Nama</Label>
              <Input
                className="mt-1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: S1, SMA, D3"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>
            <div>
              <Label className="text-sm">Urutan</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={formOrder}
                onChange={(e) => setFormOrder(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className={cn('flex', 'gap-3')}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn('flex-1', 'cursor-pointer')}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim()} className={cn('flex-1', 'bg-gray-900', 'hover:bg-gray-800', 'text-white', 'cursor-pointer')}>
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
            <AlertDialogTitle>Hapus Tingkat Pendidikan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
