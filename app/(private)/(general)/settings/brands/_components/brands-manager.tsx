"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddCircle, PenNewSquare, TrashBinTrash, Refresh } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { createBrand, updateBrand, deleteBrand } from "@/actions/brand";
import type { BrandsQueryResult, BrandQueryItem } from "@/lib/queries/venues";
import { cn } from "@/lib/utils";

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
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/brands");
      if (res.ok) {
        const data = await res.json() as BrandsQueryResult;
        setBrands(data);
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

  // Sort descending by createdAt so newest brand appears first
  const sortedBrands = useMemo(
    () => [...brands].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [brands]
  );

  const totalPages = Math.ceil(sortedBrands.length / ROWS_PER_PAGE);
  const paginated = sortedBrands.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

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
      setBrands((prev) => [{ ...result.brand!, venues: [] } as BrandQueryItem, ...prev]);
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
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'justify-between', 'items-start', 'sm:items-center', 'px-4', 'sm:px-6', 'pb-4', 'gap-3', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <span className={cn('text-base', 'font-bold', 'text-foreground')}>Brand Management</span>
              <span className={cn('text-sm', 'text-muted-foreground')}>({sortedBrands.length})</span>
            </div>
            <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2', 'w-full', 'sm:w-auto')}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className={cn('h-9', 'w-9', 'p-0', 'cursor-pointer', 'shrink-0')}
                aria-label="Refresh"
              >
                <Refresh weight="BoldDuotone" className={cn('w-4', 'h-4', refreshing && 'animate-spin')} />
              </Button>
              <Button onClick={handleOpenAdd} className={cn('cursor-pointer', 'shrink-0')}>
                <AddCircle weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-2')} /> Add Brand
              </Button>
            </div>
          </div>

          {/* Table */}
          {sortedBrands.length === 0 ? (
            <div className={cn('text-center', 'py-12', 'text-muted-foreground')}>Belum ada brand.</div>
          ) : (
            <>
            {/* Mobile: card list (<sm) */}
            <div className="block sm:hidden px-3 py-2 space-y-2">
              {paginated.map((brand, idx) => (
                <Card key={brand.id} className="rounded-lg border bg-card shadow-none">
                  <CardContent className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}. {brand.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {brand.venues.length} venue{brand.venues.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className={cn('shrink-0', 'px-2', 'py-1', 'rounded-full', 'text-xs', 'font-medium', 'bg-secondary', 'text-secondary-foreground')}>{brand.code}</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end pt-1 border-t border-border">
                      <button onClick={() => handleOpenEdit(brand)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Edit">
                        <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                      </button>
                      <button onClick={() => setDeleteTarget(brand)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Hapus">
                        <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop/tablet: table (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={cn('w-12', 'px-4', 'sm:px-6')}>#</TableHead>
                    <TableHead>Brand Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Code</TableHead>
                    <TableHead className="hidden md:table-cell">Venues</TableHead>
                    <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((brand, idx) => (
                    <TableRow key={brand.id}>
                      <TableCell className={cn('px-4', 'sm:px-6', 'text-muted-foreground')}>{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell className="font-medium">{brand.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={cn('px-2', 'py-1', 'rounded-full', 'text-xs', 'font-medium', 'bg-secondary', 'text-secondary-foreground')}>{brand.code}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{brand.venues.length} venue{brand.venues.length !== 1 ? "s" : ""}</TableCell>
                      <TableCell>
                        <div className={cn('flex', 'items-center', 'gap-1', 'justify-end', 'pr-2')}>
                          <button onClick={() => handleOpenEdit(brand)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Edit">
                            <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                          </button>
                          <button onClick={() => setDeleteTarget(brand)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Hapus">
                            <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              label="Navigasi halaman brand"
            />
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingBrand ? "Edit" : "Tambah"} Brand</DialogTitle>
          <div className={cn('space-y-4', 'pt-2')}>
            <div>
              <Label className={cn('text-sm', 'font-medium')}>Brand Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Swasana" className="mt-1" />
            </div>
            <div>
              <Label className={cn('text-sm', 'font-medium')}>Code *</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g. SWS"
                className={cn('mt-1', 'uppercase')}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>
            <div className={cn('flex', 'gap-3', 'pt-2')}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn('flex-1', 'cursor-pointer')}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim() || !formCode.trim()} className={cn('flex-1', 'cursor-pointer')}>
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
            <AlertDialogAction onClick={handleDelete} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
