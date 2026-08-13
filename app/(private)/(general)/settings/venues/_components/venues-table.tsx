"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { AddCircle, PenNewSquare, TrashBinTrash, Magnifer, Refresh } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { deleteVenue } from "@/actions/venue";
import { VenueDrawer } from "./venue-drawer";
import type { VenuesQueryResult, VenueQueryItem, BrandsQueryResult } from "@/lib/queries/venues";
import { cn } from "@/lib/utils";

interface VenuesTableProps {
  initialVenues: VenuesQueryResult;
  brands: BrandsQueryResult;
}

const ROWS_PER_PAGE = 10;

export function VenuesTable({ initialVenues, brands }: VenuesTableProps) {
  const [venues, setVenues] = useState(initialVenues);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueQueryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VenueQueryItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/venues/settings");
      if (res.ok) {
        const data = await res.json() as VenuesQueryResult;
        setVenues(data);
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

  const filtered = venues.filter((v) => {
    const matchSearch = (() => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q) || (v.brand?.name ?? "").toLowerCase().includes(q);
    })();
    const matchBrand = brandFilter === "all" || v.brand?.id === brandFilter;
    return matchSearch && matchBrand;
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
    if (checked) { next.add(id); } else { next.delete(id); }
    setSelected(next);
  }

  function handleAdd() { setEditingVenue(null); setDrawerOpen(true); }
  function handleEdit(v: VenueQueryItem) { setEditingVenue(v); setDrawerOpen(true); }

  function handleSaved(venue: VenueQueryItem, isEdit: boolean) {
    if (isEdit) {
      setVenues((prev) => prev.map((v) => v.id === venue.id ? venue : v));
    } else {
      setVenues((prev) => [venue, ...prev]);
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

  const brandOptions = [
    { id: "all", name: "Semua Brand" },
    ...brands.map((b) => ({ id: b.id, name: b.name })),
  ];

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'justify-between', 'items-start', 'sm:items-center', 'px-4', 'sm:px-6', 'pb-4', 'gap-3', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <span className={cn('text-base', 'font-bold', 'text-foreground')}>List Venues</span>
              <span className={cn('text-sm', 'text-muted-foreground')}>({filtered.length})</span>
            </div>
            <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2', 'w-full', 'sm:w-auto')}>
              <SearchableSelect
                options={brandOptions}
                value={brandFilter}
                onChange={(v) => { setBrandFilter(v); setCurrentPage(1); }}
                placeholder="Semua Brand"
                searchPlaceholder="Cari brand..."
                className="w-full sm:w-44"
              />
              <div className="relative flex-1 sm:flex-none">
                <Magnifer weight="BoldDuotone" className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'h-4', 'w-4', 'text-muted-foreground')} />
                <Input
                  placeholder="Cari venue..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className={cn('pl-9', 'w-full', 'sm:w-48', 'h-9', 'text-sm')}
                />
              </div>
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
              {selected.size > 1 && (
                <Button variant="outline" onClick={() => setBulkDeleteOpen(true)} className={cn('h-9', 'text-destructive', 'border-destructive', 'hover:bg-destructive/10', 'cursor-pointer')}>
                  <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-1')} /> Hapus ({selected.size})
                </Button>
              )}
              <Button onClick={handleAdd} className={cn('h-9', 'cursor-pointer', 'shrink-0')}>
                <AddCircle weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-1')} /> Add Venue
              </Button>
            </div>
          </div>

          {/* Mobile: card list (<sm) */}
          <div className="block sm:hidden px-3 py-2 space-y-2">
            {filtered.length === 0 ? (
              <div className={cn('text-center', 'py-8', 'text-muted-foreground', 'text-sm')}>
                {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada venue."}
              </div>
            ) : (
              paginated.map((venue, idx) => (
                <Card key={venue.id} className="rounded-lg border bg-card shadow-none">
                  <CardContent className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Checkbox checked={selected.has(venue.id)} onCheckedChange={(c) => handleSelect(venue.id, c as boolean)} className="cursor-pointer mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}. {venue.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{venue.brand?.name ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Kode: <span className="text-foreground">{venue.code}</span></span>
                      <span>Pax: <span className="text-foreground">{venue.capacity ?? "—"}</span></span>
                    </div>
                    <div className="flex items-center gap-1 justify-end pt-1 border-t border-border">
                      <button onClick={() => handleEdit(venue)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Edit">
                        <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                      </button>
                      <button onClick={() => setDeleteTarget(venue)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Hapus">
                        <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                      </button>
                    </div>
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
                  <TableHead className={cn('w-10', 'px-4')}>
                    <Checkbox checked={isAllSelected} data-indeterminate={isIndeterminate} onCheckedChange={handleSelectAll} className="cursor-pointer" />
                  </TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Nama Venue</TableHead>
                  <TableHead className="hidden sm:table-cell">Kode</TableHead>
                  <TableHead className="hidden md:table-cell">Kapasitas (Pax)</TableHead>
                  <TableHead className="w-20 text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className={cn('text-center', 'py-8', 'text-muted-foreground')}>
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
                      <TableCell className="hidden sm:table-cell">{venue.code}</TableCell>
                      <TableCell className="hidden md:table-cell">{venue.capacity ?? "—"}</TableCell>
                      <TableCell>
                        <div className={cn('flex', 'items-center', 'gap-1', 'justify-end', 'pr-2')}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                onClick={() => handleEdit(venue)}
                                className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}
                                aria-label="Edit"
                              >
                                <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                              </TooltipTrigger>
                              <TooltipContent>Edit Venue</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                onClick={() => setDeleteTarget(venue)}
                                className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}
                                aria-label="Hapus"
                              >
                                <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                              </TooltipTrigger>
                              <TooltipContent>Hapus Venue</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              label="Navigasi halaman venue"
            />
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
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>
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
            <AlertDialogAction onClick={handleBulkDelete} disabled={deleting} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>
              {deleting ? "Menghapus..." : `Hapus ${selected.size} Venue`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
