"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AddCircle, PenNewSquare, TrashBinTrash, ArrowLeft, ArrowRight, Refresh } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useVendorCategories, useDeleteVendor } from "@/hooks/use-vendors";
import type { VendorCategoryItem } from "@/lib/queries/vendors";
import { toast } from "sonner";
import SearchBar from "@/components/shared/search-bar";
import { VendorDrawer } from "./vendor-drawer";

type FlatVendor = VendorCategoryItem["vendors"][number] & { categoryName: string };

export function VendorsTable() {
  const searchParams = useSearchParams();
  const { data: categories = [], isLoading, refetch } = useVendorCategories();
  const deleteMutation = useDeleteVendor();
  const { can, isAdmin } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorDrawerOpen, setVendorDrawerOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<FlatVendor | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<FlatVendor | null>(null);

  const searchQuery = searchParams.get("search") || "";
  const rowsPerPage = 10;

  const allVendors: FlatVendor[] = useMemo(() =>
    categories
      .flatMap((cat) => cat.vendors.map((v) => ({ ...v, categoryName: cat.name })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [categories]
  );

  const filtered = useMemo(() => {
    let result = categoryFilter === "all"
      ? allVendors
      : allVendors.filter((v) => v.categoryId === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) => v.name.toLowerCase().includes(q) || v.categoryName.toLowerCase().includes(q));
    }
    return result;
  }, [allVendors, categoryFilter, searchQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleDelete = async () => {
    if (!vendorToDelete) return;
    const res = await deleteMutation.mutateAsync(vendorToDelete.id);
    if (res.success) toast.success("Vendor deleted");
    else toast.error(res.error ?? "Failed");
    setDeleteOpen(false);
    setVendorToDelete(null);
  };

  if (isLoading) {
    return (
      <Card><CardContent className={cn('p-6', 'space-y-3')}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={cn('flex', 'items-center', 'space-x-4', 'py-3')}>
            <Skeleton className={cn('h-4', 'w-8')} /><Skeleton className={cn('h-4', 'w-40')} /><Skeleton className={cn('h-4', 'w-32')} /><Skeleton className={cn('h-4', 'w-20')} />
          </div>
        ))}
      </CardContent></Card>
    );
  }

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="p-0">
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'justify-between', 'items-start', 'sm:items-center', 'px-4', 'sm:px-6', 'pb-4', 'gap-3', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <span className={cn('text-base', 'font-bold', 'text-foreground')}>List Vendors</span>
              <span className={cn('text-xs', 'font-medium', 'bg-secondary', 'text-secondary-foreground', 'px-3', 'py-1', 'rounded-full')}>
                {filtered.length} vendor
              </span>
            </div>
            <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2', 'w-full', 'sm:w-auto')}>
              <SearchableSelect
                options={[{ id: "all", name: "All Categories" }, ...categories.map((cat) => ({ id: cat.id, name: `${cat.name} (${cat.vendors.length})` }))]}
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}
                placeholder="All Categories"
                searchPlaceholder="Cari kategori..."
                className="w-full sm:w-48"
              />
              <div className="flex-1 sm:flex-none">
                <SearchBar placeholder="Search vendors..." />
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
              {(can("vendor", "create") || isAdmin) && (
                <Button onClick={() => { setEditingVendor(null); setVendorDrawerOpen(true); }} className="shrink-0">
                  <AddCircle weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-1')} /> Add Vendor
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-14">No</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Nama Bank</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Alamat</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className={cn('text-center', 'py-8', 'text-muted-foreground')}>No vendors found</TableCell>
                  </TableRow>
                ) : (
                  paginated.map((vendor, idx) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="text-muted-foreground">{(currentPage - 1) * rowsPerPage + idx + 1}</TableCell>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{vendor.bankName || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{vendor.phone || "-"}</TableCell>
                      <TableCell className={cn('hidden', 'lg:table-cell', 'text-sm', 'text-muted-foreground', 'max-w-40', 'truncate')}>{vendor.address || "-"}</TableCell>
                      <TableCell>
                        <span className={cn('px-2', 'py-1', 'rounded-full', 'text-xs', 'font-medium', 'bg-secondary', 'text-secondary-foreground')}>{vendor.categoryName}</span>
                      </TableCell>
                      <TableCell>
                        <div className={cn('flex', 'gap-1', 'justify-end')}>
                          {(can("vendor", "edit") || isAdmin) && (
                            <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => { setEditingVendor(vendor); setVendorDrawerOpen(true); }}>
                              <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                            </button>
                          )}
                          {(can("vendor", "delete") || isAdmin) && (
                            <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => { setVendorToDelete(vendor); setDeleteOpen(true); }}>
                              <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filtered.length > 0 && (
            <div className={cn('flex', 'justify-between', 'items-center', 'px-4', 'sm:px-6', 'py-3', 'border-t')}>
              <span className={cn('text-sm', 'text-muted-foreground')}>
                Showing {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filtered.length)} of {filtered.length}
              </span>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                  <ArrowLeft weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-1')} /> Previous
                </Button>
                <span className={cn('text-sm', 'text-muted-foreground')}>Page {currentPage} of {totalPages || 1}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                  Next <ArrowRight weight="BoldDuotone" className={cn('w-4', 'h-4', 'ml-1')} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <VendorDrawer isOpen={vendorDrawerOpen} onClose={() => { setVendorDrawerOpen(false); setEditingVendor(null); }} vendor={editingVendor} categories={categories} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete Vendor</DialogTitle>
          <p className={cn('text-sm', 'text-muted-foreground')}>Are you sure you want to delete &quot;{vendorToDelete?.name}&quot;? This action cannot be undone.</p>
          <div className={cn('flex', 'gap-3', 'mt-4')}>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
