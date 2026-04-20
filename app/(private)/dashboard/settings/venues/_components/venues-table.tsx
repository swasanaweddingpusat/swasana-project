"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Plus, PenLine, Trash2, ArrowLeft, ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteVenue } from "@/actions/venue";
import { VenueDrawer } from "./venue-drawer";
import type { VenuesQueryResult, VenueQueryItem, BrandsQueryResult } from "@/lib/queries/venues";

interface VenuesTableProps {
  initialVenues: VenuesQueryResult;
  brands: BrandsQueryResult;
}

const ROWS_PER_PAGE = 10;

export function VenuesTable({ initialVenues, brands }: VenuesTableProps) {
  const [venues, setVenues] = useState(initialVenues);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueQueryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VenueQueryItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = venues.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q) || (v.brand?.name ?? "").toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const isAllSelected = paginated.length > 0 && paginated.every((v) => selected.has(v.id));
  const isIndeterminate = selected.size > 0 && !isAllSelected;

  function handleSelectAll(checked: boolean) {
    const next = new Set(selected);
    paginated.forEach((v) => checked ? next.add(v.id) : next.delete(v.id));
    setSelected(next);
  }

  function handleSelect(id: string, checked: boolean) {
    const next = new Set(selected);
    checked ? next.add(id) : next.delete(id);
    setSelected(next);
  }

  function handleAdd() { setEditingVenue(null); setDrawerOpen(true); }
  function handleEdit(v: VenueQueryItem) { setEditingVenue(v); setDrawerOpen(true); }

  function handleSaved(venue: VenueQueryItem, isEdit: boolean) {
    if (isEdit) {
      setVenues((prev) => prev.map((v) => v.id === venue.id ? venue : v));
    } else {
      setVenues((prev) => [...prev, venue]);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteVenue(deleteTarget.id);
    setDeleting(false);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setVenues((prev) => prev.filter((v) => v.id !== deleteTarget.id));
    toast.success("Venue dihapus.");
    setDeleteTarget(null);
  }

  async function handleBulkDelete() {
    setDeleting(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      await deleteVenue(id);
    }
    setVenues((prev) => prev.filter((v) => !ids.includes(v.id)));
    setSelected(new Set());
    setDeleting(false);
    setBulkDeleteOpen(false);
    toast.success(`${ids.length} venue dihapus.`);
  }

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">List Venues</span>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
                {filtered.length} venue
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari venue..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-9 w-[200px] h-9 text-sm"
                />
              </div>
              {selected.size > 1 && (
                <Button variant="outline" onClick={() => setBulkDeleteOpen(true)} className="h-9 text-red-500 border-red-500 hover:bg-red-50 cursor-pointer">
                  <Trash2 className="w-4 h-4 mr-1" /> Hapus ({selected.size})
                </Button>
              )}
              <Button onClick={handleAdd} className="h-9 cursor-pointer bg-gray-900 hover:bg-gray-800 text-white">
                <Plus className="w-4 h-4 mr-1" /> Add Venue
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada venue."}
              </div>
            ) : (
              <Table className="min-w-full text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b-2 border-gray-200">
                    <TableHead className="px-4 py-3 w-10">
                      <Checkbox
                        checked={isAllSelected}
                        data-indeterminate={isIndeterminate}
                        onCheckedChange={handleSelectAll}
                        className="cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700 w-10">No</TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700">Brand</TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700">Nama Venue</TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700">Kode</TableHead>
                    <TableHead className="px-2 py-3 font-semibold text-gray-700">Kapasitas (Pax)</TableHead>
                    <TableHead className="px-2 py-3 w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((venue, idx) => (
                    <TableRow key={venue.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <TableCell className="px-4 py-3">
                        <Checkbox
                          checked={selected.has(venue.id)}
                          onCheckedChange={(c) => handleSelect(venue.id, c as boolean)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="px-2 py-3">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell className="px-2 py-3">{venue.brand?.name ?? "—"}</TableCell>
                      <TableCell className="px-2 py-3 font-medium">{venue.name}</TableCell>
                      <TableCell className="px-2 py-3">{venue.code}</TableCell>
                      <TableCell className="px-2 py-3">{venue.capacity ?? "—"}</TableCell>
                      <TableCell className="px-2 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleEdit(venue)} className="p-1.5 hover:bg-gray-100 rounded cursor-pointer" title="Edit">
                            <PenLine className="w-4 h-4 text-gray-700" />
                          </button>
                          <button onClick={() => setDeleteTarget(venue)} className="p-1.5 hover:bg-red-50 rounded cursor-pointer" title="Hapus">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

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

      <VenueDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingVenue={editingVenue}
        brands={brands}
        onSaved={handleSaved}
      />

      {/* Single delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Venue</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus venue <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selected.size} Venue</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selected.size} venue yang dipilih? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : `Hapus ${selected.size} Venue`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
