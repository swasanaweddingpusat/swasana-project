"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, PenLine, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useVendorCategories, useDeleteVendor } from "@/hooks/use-vendors";
import type { VendorCategoryItem } from "@/lib/queries/vendors";
import { toast } from "sonner";
import SearchBar from "@/components/shared/search-bar";
import { VendorDrawer } from "./vendor-drawer";
import { VendorCategoryDrawer } from "./vendor-category-drawer";

type FlatVendor = VendorCategoryItem["vendors"][number] & { categoryName: string };

export function VendorsTable() {
  const searchParams = useSearchParams();
  const { data: categories = [], isLoading } = useVendorCategories();
  const deleteMutation = useDeleteVendor();
  const { can, isAdmin } = usePermissions();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorDrawerOpen, setVendorDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<FlatVendor | null>(null);
  const [editingCategory, setEditingCategory] = useState<VendorCategoryItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<FlatVendor | null>(null);

  const searchQuery = searchParams.get("search") || "";
  const rowsPerPage = 10;

  const allVendors: FlatVendor[] = useMemo(() =>
    categories.flatMap((cat) =>
      cat.vendors.map((v) => ({ ...v, categoryName: cat.name }))
    ), [categories]);

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
      <div className={cn('flex', 'justify-end', 'items-center', 'mb-4', 'gap-2')}>
        {(can("vendor", "create") || isAdmin) && (
          <>
            <Button variant="outline" onClick={() => { setEditingVendor(null); setVendorDrawerOpen(true); }}>
              <Plus className={cn('w-4', 'h-4', 'mr-1')} /> Add Vendor
            </Button>
            <Button onClick={() => { setEditingCategory(null); setCategoryDrawerOpen(true); }}>
              <Plus className={cn('w-4', 'h-4', 'mr-1')} /> New Category
            </Button>
          </>
        )}
      </div>

      <Card className="shadow-none">
        <CardContent className="p-0">
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'justify-between', 'items-start', 'sm:items-center', 'px-6', 'pb-4', 'gap-3')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <span className={cn('text-base', 'font-bold', 'text-[#1D1D1D]')}>List Vendors</span>
              <span className={cn('text-xs', 'font-medium', 'bg-gray-100', 'text-gray-600', 'px-3', 'py-1', 'border', 'rounded-full')}>
                {filtered.length} vendor
              </span>
            </div>
            <div className={cn('flex', 'items-center', 'gap-3')}>
              <SearchableSelect
                options={[{ id: "all", name: "All Categories" }, ...categories.map((cat) => ({ id: cat.id, name: `${cat.name} (${cat.vendors.length})` }))]}
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}
                placeholder="All Categories"
                searchPlaceholder="Cari kategori..."
                className="w-50"
              />
              <SearchBar placeholder="Search vendors..." />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-14">No</TableHead>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Alamat</TableHead>
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
                    <TableCell className={cn('text-xs', 'text-muted-foreground')}>{vendor.description || "-"}</TableCell>
                    <TableCell className="text-xs">{vendor.phone || "-"}</TableCell>
                    <TableCell className={cn('text-xs', 'text-muted-foreground', 'max-w-45', 'truncate')}>{vendor.address || "-"}</TableCell>
                    <TableCell>
                      <span className={cn('px-2', 'py-1', 'rounded-full', 'text-xs', 'font-medium', 'bg-gray-100', 'text-gray-700')}>{vendor.categoryName}</span>
                    </TableCell>
                    <TableCell>
                      <div className={cn('flex', 'gap-1', 'justify-end')}>
                        {(can("vendor", "edit") || isAdmin) && (
                          <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => { setEditingVendor(vendor); setVendorDrawerOpen(true); }}>
                            <PenLine className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                          </button>
                        )}
                        {(can("vendor", "delete") || isAdmin) && (
                          <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => { setVendorToDelete(vendor); setDeleteOpen(true); }}>
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

          {filtered.length > 0 && (
            <div className={cn('flex', 'justify-between', 'items-center', 'px-6', 'py-3', 'border-t')}>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className={cn('text-xs', 'h-8')}>
                <ArrowLeft className={cn('w-3.5', 'h-3.5', 'mr-1.5')} /> Previous
              </Button>
              <div className={cn('flex', 'items-center', 'gap-1')}>
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                  else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("...");
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }
                  return pages.map((page, idx) =>
                    typeof page === "string" ? (
                      <span key={`e-${idx}`} className={cn('px-2', 'py-1', 'text-xs', 'text-gray-400')}>...</span>
                    ) : (
                      <button key={page} className={cn("px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer", currentPage === page ? "bg-[#eeeeee] text-gray-900" : "text-gray-700 hover:bg-[#eeeeee]")} onClick={() => setCurrentPage(page)}>
                        {page}
                      </button>
                    )
                  );
                })()}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className={cn('text-xs', 'h-8')}>
                Next <ArrowRight className={cn('w-3.5', 'h-3.5', 'ml-1.5')} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <VendorDrawer isOpen={vendorDrawerOpen} onClose={() => { setVendorDrawerOpen(false); setEditingVendor(null); }} vendor={editingVendor} categories={categories} />
      <VendorCategoryDrawer isOpen={categoryDrawerOpen} onClose={() => { setCategoryDrawerOpen(false); setEditingCategory(null); }} category={editingCategory} />

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
