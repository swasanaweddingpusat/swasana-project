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
          <div className="flex justify-between items-center px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[#1D1D1D]">List Venues</span>
              <span className="text-sm text-muted-foreground">({filtered.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari venue..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-9 w-50 h-9 text-sm"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-4">
                  <Checkbox checked={isAllSelected} data-indeterminate={isIndeterminate} onCheckedChange={handleSelectAll} className="cursor-pointer" />
                </TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Nama Venue</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Kapasitas (Pax)</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada venue."}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((venue, idx) => (
                  <TableRow key={venue.id}>
                    <TableCell className="px-4">
                      <Checkbox checked={selected.has(venue.id)} onCheckedChange={(c) => handleSelect(venue.id, c as boolean)} className="cursor-pointer" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                    <TableCell>{venue.brand?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{venue.name}</TableCell>
                    <TableCell>{venue.code}</TableCell>
                    <TableCell>{venue.capacity ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end pr-2">
                        <button onClick={() => handleEdit(venue)} className="p-1.5 rounded-md hover:bg-muted cursor-pointer" aria-label="Edit">
                          <PenLine className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeleteTarget(venue)} className="p-1.5 rounded-md hover:bg-muted cursor-pointer" aria-label="Hapus">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t">
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
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
