"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, PenLine, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSourceOfInformation, updateSourceOfInformation, deleteSourceOfInformation,
} from "@/actions/source-of-information";
import { usePermissions } from "@/hooks/use-permissions";
import type { SourceOfInformationsResult, SourceOfInformationItem } from "@/lib/queries/source-of-information";

interface Props {
  initialData: SourceOfInformationsResult;
}

const ROWS_PER_PAGE = 10;

export function SourceOfInformationManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [editingItem, setEditingItem] = useState<SourceOfInformationItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SourceOfInformationItem | null>(null);

  const totalPages = Math.ceil(items.length / ROWS_PER_PAGE);
  const paginatedItems = items.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormOpen(true);
  }

  function handleOpenEdit(item: SourceOfInformationItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    const result = editingItem
      ? await updateSourceOfInformation(editingItem.id, formName)
      : await createSourceOfInformation(formName);

    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }

    if (editingItem) {
      setItems((prev) => prev.map((i) => i.id === editingItem.id ? { ...i, name: formName.trim() } : i));
      toast.success("Berhasil diperbarui.");
    } else {
      setItems((prev) => [result.item as SourceOfInformationItem, ...prev]);
      toast.success("Berhasil ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteSourceOfInformation(deleteTarget.id);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  return (
    <div className="px-6 pb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-900">Source of Information</h1>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
            {items.length} items
          </span>
        </div>
        {(can("source_of_information", "create") || isAdmin) && (
          <Button onClick={handleOpenAdd} className="bg-gray-900 hover:bg-gray-800 text-white cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> Tambah
          </Button>
        )}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Belum ada data.</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[60px] px-4">No</TableHead>
                <TableHead className="px-4">Nama</TableHead>
                <TableHead className="w-[100px] px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item, idx) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="px-4">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                  <TableCell className="px-4">{item.name}</TableCell>
                  <TableCell className="px-4">
                    <div className="flex gap-1 justify-end">
                      {(can("source_of_information", "edit") || isAdmin) && (
                        <button onClick={() => handleOpenEdit(item)} className="p-1.5 hover:bg-gray-100 rounded cursor-pointer" title="Edit">
                          <PenLine className="w-4 h-4 text-gray-700" />
                        </button>
                      )}
                      {(can("source_of_information", "delete") || isAdmin) && (
                        <button onClick={() => setDeleteTarget(item)} className="p-1.5 hover:bg-red-50 rounded cursor-pointer" title="Hapus">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <Button variant="outline" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === page ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100")}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
            Next <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Source of Information</DialogTitle>
          <div className="space-y-4 pt-2">
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Contoh: Instagram, Walk in, Referral"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className="flex-1 cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim()} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white cursor-pointer">
                {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Source of Information</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
