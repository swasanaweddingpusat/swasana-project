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
import { cn } from "@/lib/utils";
import { createBrand, updateBrand, deleteBrand } from "@/actions/brand";
import type { BrandsQueryResult, BrandQueryItem } from "@/lib/queries/venues";

const ROWS_PER_PAGE = 10;

export function BrandsManager({ initialData }: { initialData: BrandsQueryResult }) {
  const [brands, setBrands] = useState(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [editingBrand, setEditingBrand] = useState<BrandQueryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrandQueryItem | null>(null);

  const totalPages = Math.ceil(brands.length / ROWS_PER_PAGE);
  const paginated = brands.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleOpenAdd() {
    setEditingBrand(null);
    setFormName("");
    setFormCode("");
    setFormOpen(true);
  }

  function handleOpenEdit(brand: BrandQueryItem) {
    setEditingBrand(brand);
    setFormName(brand.name);
    setFormCode(brand.code);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCode.trim()) return;
    setSaving(true);
    const data = { name: formName.trim(), code: formCode.trim() };
    const result = editingBrand
      ? await updateBrand({ id: editingBrand.id, ...data })
      : await createBrand(data);
    setSaving(false);

    if (!result.success) { toast.error(result.error); return; }

    if (editingBrand) {
      setBrands((prev) => prev.map((b) => b.id === editingBrand.id ? { ...b, name: formName.trim(), code: formCode.trim().toUpperCase() } : b));
      toast.success("Brand diperbarui.");
    } else {
      setBrands((prev) => [...prev, { ...result.brand!, venues: [] } as BrandQueryItem]);
      toast.success("Brand ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteBrand(deleteTarget.id);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setBrands((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    toast.success("Brand dihapus.");
    setDeleteTarget(null);
  }

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex justify-between items-center px-6 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-900">Brand Management</span>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
                {brands.length} brands
              </span>
            </div>
            <Button onClick={handleOpenAdd} className="cursor-pointer bg-gray-900 hover:bg-gray-800 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add Brand
            </Button>
          </div>

          {/* Table */}
          {brands.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Belum ada brand.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-full text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b-2 border-gray-200">
                    <TableHead className="px-4 py-3 font-semibold text-gray-700 w-[60px]">No</TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700">Brand Name</TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700">Code</TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700">Venues</TableHead>
                    <TableHead className="px-2 py-3 w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((brand, idx) => (
                    <TableRow key={brand.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <TableCell className="px-4 py-3">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell className="px-2 py-3 font-medium">{brand.name}</TableCell>
                      <TableCell className="px-2 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{brand.code}</span>
                      </TableCell>
                      <TableCell className="px-2 py-3 text-gray-500">
                        {brand.venues.length} venue{brand.venues.length !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="px-2 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleOpenEdit(brand)} className="p-1.5 hover:bg-gray-100 rounded cursor-pointer" title="Edit">
                            <PenLine className="w-4 h-4 text-gray-700" />
                          </button>
                          <button onClick={() => setDeleteTarget(brand)} className="p-1.5 hover:bg-red-50 rounded cursor-pointer" title="Hapus">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
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
            <div className="flex justify-between items-center px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === page ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100")}>
                    {page}
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingBrand ? "Edit" : "Tambah"} Brand</DialogTitle>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium text-gray-700">Brand Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Swasana" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Code *</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g. SWS"
                className="mt-1 uppercase"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className="flex-1 cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim() || !formCode.trim()} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white cursor-pointer">
                {saving ? "Menyimpan..." : editingBrand ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus brand <strong>{deleteTarget?.name}</strong>? Brand yang masih digunakan oleh venue tidak dapat dihapus.
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
    </>
  );
}
