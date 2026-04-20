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
      <Card><CardContent className="p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 py-3">
            <Skeleton className="h-4 w-8" /><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent></Card>
    );
  }

  return (
    <>
      <div className="flex justify-end items-center mb-4 gap-2">
        {(can("vendor", "create") || isAdmin) && (
          <>
            <Button variant="outline" onClick={() => { setEditingVendor(null); setVendorDrawerOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Vendor
            </Button>
            <Button onClick={() => { setEditingCategory(null); setCategoryDrawerOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> New Category
            </Button>
          </>
        )}
      </div>

      <Card className="shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-4 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">List Vendors</span>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-3 py-1 border rounded-full">
                {filtered.length} vendor
              </span>
            </div>
            <div className="flex items-center gap-3">
              <SearchableSelect
                options={[{ id: "all", name: "All Categories" }, ...categories.map((cat) => ({ id: cat.id, name: `${cat.name} (${cat.vendors.length})` }))]}
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}
                placeholder="All Categories"
                searchPlaceholder="Cari kategori..."
                className="w-[200px]"
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No vendors found</TableCell>
                </TableRow>
              ) : (
                paginated.map((vendor, idx) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="text-muted-foreground">{(currentPage - 1) * rowsPerPage + idx + 1}</TableCell>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{vendor.description || "-"}</TableCell>
                    <TableCell className="text-xs">{vendor.phone || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{vendor.address || "-"}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{vendor.categoryName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {(can("vendor", "edit") || isAdmin) && (
                          <button className="p-1.5 hover:bg-muted rounded cursor-pointer" onClick={() => { setEditingVendor(vendor); setVendorDrawerOpen(true); }}>
                            <PenLine className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                        {(can("vendor", "delete") || isAdmin) && (
                          <button className="p-1.5 hover:bg-muted rounded cursor-pointer" onClick={() => { setVendorToDelete(vendor); setDeleteOpen(true); }}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-3 border-t">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
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
          <p className="text-sm text-muted-foreground">Are you sure you want to delete &quot;{vendorToDelete?.name}&quot;? This action cannot be undone.</p>
          <div className="flex gap-3 mt-4">
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
