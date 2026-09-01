"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AddCircle, PenNewSquare, TrashBinTrash, ArrowLeft, ArrowRight, Refresh, Magnifer } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useVendorCategoriesLite, useVendorList, useDeleteVendor } from "@/hooks/use-vendors";
import type { VendorItem } from "@/lib/queries/vendors";
import { toast } from "sonner";
import { VendorDrawer } from "./vendor-drawer";

const ROWS_PER_PAGE = 10;

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  pages.add(current);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= total) pages.add(current + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
      result.push("...");
    }
  }
  return result;
}

function SkeletonTable() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-48 rounded-xl" />
            <Skeleton className="h-9 w-52 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2.5rem_1fr_7rem_6rem_9rem_6rem_5rem] items-center gap-3 px-6 py-3.5">
              <Skeleton className="h-4 w-5" />
              <Skeleton className="h-4 w-40" style={{ width: `${60 + (i % 4) * 15}%` }} />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-t">
          <Skeleton className="h-4 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VendorsTable() {
  const { data: categories = [], isLoading: categoriesLoading, refetch: refetchCategories } = useVendorCategoriesLite();
  const deleteMutation = useDeleteVendor();
  const { can, isAdmin } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vendorDrawerOpen, setVendorDrawerOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<VendorItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: vendorsResult, isLoading: vendorsLoading, refetch: refetchVendors } = useVendorList({
    page: currentPage,
    pageSize: ROWS_PER_PAGE,
    search: debouncedSearch,
    categoryId: categoryFilter,
  });

  const paginated = vendorsResult?.data ?? [];
  const total = vendorsResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

  const openAdd = () => {
    setEditingVendor(null);
    setVendorDrawerOpen(true);
  };

  const openEdit = (vendor: VendorItem) => {
    setEditingVendor(vendor);
    setVendorDrawerOpen(true);
  };

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchCategories(), refetchVendors()]);
    setRefreshing(false);
  }

  const handleDelete = async () => {
    if (!vendorToDelete) return;
    const res = await deleteMutation.mutateAsync(vendorToDelete.id);
    if (res.success) {
      toast.success("Vendor deleted");
    } else {
      toast.error(res.error ?? "Failed");
    }
    setDeleteOpen(false);
    setVendorToDelete(null);
  };

  if (categoriesLoading || vendorsLoading) return <SkeletonTable />;

  return (
    <>
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'items-start', 'sm:items-center', 'justify-between', 'gap-3', 'px-6', 'pb-4', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <h2 className={cn('text-base', 'font-bold', 'text-foreground')}>Vendors</h2>
              <span className={cn('text-xs', 'font-medium', 'bg-secondary', 'text-secondary-foreground', 'px-3', 'py-1', 'rounded-full')}>
                {total} vendor
              </span>
            </div>
            <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2', 'w-full', 'sm:w-auto')}>
              <SearchableSelect
                options={[{ id: "all", name: "All Categories" }, ...categories.map((cat) => ({ id: cat.id, name: `${cat.name} (${cat.vendorCount})` }))]}
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}
                placeholder="All Categories"
                searchPlaceholder="Cari kategori..."
                className="w-full sm:w-48"
              />
              <div className="relative w-full sm:w-75">
                <Magnifer weight="BoldDuotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  className="pl-10 bg-muted/40"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
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
              {(can("vendor", "create") || isAdmin) && (
                <Button onClick={openAdd} className={cn('cursor-pointer', 'flex', 'items-center', 'gap-2', 'shrink-0')}>
                  <AddCircle weight="BoldDuotone" className={cn('w-4', 'h-4')} /> Add Vendor
                </Button>
              )}
            </div>
          </div>

          {/* Empty state */}
          {paginated.length === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-muted-foreground')}>
              <AddCircle weight="BoldDuotone" className={cn('h-10', 'w-10', 'mb-3', 'opacity-40')} />
              <p className="text-sm">{debouncedSearch || categoryFilter !== "all" ? "No vendors found" : "No vendors yet"}</p>
            </div>
          ) : (
            <>
              {/* Table — desktop (sm+) */}
              <div className={cn('hidden', 'sm:block', 'w-full', 'overflow-x-auto')}>
                <Table className={cn('w-full', 'text-sm')}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Vendor Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Nama Bank</TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead className="hidden lg:table-cell">Alamat</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-24 text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((vendor, idx) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="text-muted-foreground">
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="leading-tight">
                            <p className={cn('font-medium', 'text-foreground', 'truncate')}>{vendor.name}</p>
                            <p className={cn('text-xs', 'text-muted-foreground', 'mt-0.5', 'md:hidden')}>{vendor.phone || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {vendor.bankName || "-"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {vendor.phone || "-"}
                        </TableCell>
                        <TableCell className={cn('hidden', 'lg:table-cell', 'text-sm', 'text-muted-foreground', 'max-w-40', 'truncate')}>
                          {vendor.address || "-"}
                        </TableCell>
                        <TableCell>
                          <span className={cn('px-2', 'py-1', 'rounded-full', 'text-xs', 'font-medium', 'bg-secondary', 'text-secondary-foreground')}>
                            {vendor.category.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className={cn('flex', 'gap-1', 'justify-end')}>
                            {(can("vendor", "edit") || isAdmin) && (
                              <button
                                className={cn('p-1.5', 'hover:bg-muted', 'rounded-md', 'cursor-pointer')}
                                onClick={() => openEdit(vendor)}
                                aria-label={`Edit ${vendor.name}`}
                              >
                                <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                              </button>
                            )}
                            {(can("vendor", "delete") || isAdmin) && (
                              <button
                                className={cn('p-1.5', 'hover:bg-muted', 'rounded-md', 'cursor-pointer')}
                                onClick={() => { setVendorToDelete(vendor); setDeleteOpen(true); }}
                                aria-label={`Hapus ${vendor.name}`}
                              >
                                <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile (<sm): card list */}
              <div className={cn('block', 'sm:hidden', 'p-4', 'space-y-3')}>
                {paginated.map((vendor, idx) => {
                  const rowNumber = (currentPage - 1) * ROWS_PER_PAGE + idx + 1;
                  return (
                    <div
                      key={vendor.id}
                      className={cn('rounded-lg', 'border', 'bg-card', 'p-3', 'space-y-2')}
                    >
                      {/* Row 1: number + name + category badge */}
                      <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
                        <span className={cn('font-medium', 'text-foreground', 'truncate', 'text-sm')}>
                          {rowNumber}. {vendor.name}
                        </span>
                        <span className={cn('inline-flex', 'shrink-0', 'px-2', 'py-0.5', 'rounded-full', 'text-[10px]', 'font-medium', 'bg-secondary', 'text-secondary-foreground')}>
                          {vendor.category.name}
                        </span>
                      </div>

                      {/* Row 2: bank + phone */}
                      <div className={cn('flex', 'items-center', 'gap-1.5', 'flex-wrap', 'text-xs', 'text-muted-foreground')}>
                        {vendor.bankName && (
                          <span className="truncate">{vendor.bankName}</span>
                        )}
                        {vendor.bankName && vendor.phone && (
                          <span aria-hidden="true">·</span>
                        )}
                        {vendor.phone && (
                          <span>{vendor.phone}</span>
                        )}
                        {!vendor.bankName && !vendor.phone && (
                          <span>No contact info</span>
                        )}
                      </div>

                      {/* Row 3: address (if any) */}
                      {vendor.address && (
                        <p className={cn('text-xs', 'text-muted-foreground', 'truncate')}>{vendor.address}</p>
                      )}

                      {/* Footer: action buttons */}
                      <div className={cn('flex', 'items-center', 'gap-1', 'pt-1', 'border-t', 'border-border')}>
                        {(can("vendor", "edit") || isAdmin) && (
                          <Button
                            variant="outline"
                            className={cn('h-9', 'flex-1', 'text-xs')}
                            onClick={() => openEdit(vendor)}
                            aria-label={`Edit ${vendor.name}`}
                          >
                            <PenNewSquare weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Edit
                          </Button>
                        )}
                        {(can("vendor", "delete") || isAdmin) && (
                          <Button
                            variant="outline"
                            className={cn('h-9', 'flex-1', 'text-xs', 'text-destructive', 'border-destructive/30', 'hover:bg-destructive/5')}
                            onClick={() => { setVendorToDelete(vendor); setDeleteOpen(true); }}
                            aria-label={`Hapus ${vendor.name}`}
                          >
                            <TrashBinTrash weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1')} /> Hapus
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={cn('flex', 'justify-between', 'items-center', 'px-4', 'sm:px-6', 'py-4', 'border-t')}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage <= 1}
              >
                <ArrowLeft weight="BoldDuotone" className={cn('w-4', 'h-4', 'sm:mr-2')} />
                <span className={cn('hidden', 'sm:inline')}>Previous</span>
              </Button>

              {/* Mobile: page X/Y */}
              <span className={cn('text-sm', 'text-muted-foreground', 'sm:hidden')}>{currentPage} / {totalPages}</span>

              {/* Desktop: page numbers with ellipsis */}
              <div className={cn('hidden', 'sm:flex', 'items-center', 'gap-1')}>
                {buildPageRange(currentPage, totalPages).map((item, idx) =>
                  item === "..." ? (
                    <span key={`ellipsis-${idx}`} className={cn('px-2', 'py-1', 'text-sm', 'text-muted-foreground', 'select-none')}>...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item as number)}
                      className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === item ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
              >
                <span className={cn('hidden', 'sm:inline')}>Next</span>
                <ArrowRight weight="BoldDuotone" className={cn('w-4', 'h-4', 'sm:ml-2')} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <VendorDrawer
        isOpen={vendorDrawerOpen}
        onClose={() => { setVendorDrawerOpen(false); setEditingVendor(null); }}
        vendor={editingVendor}
        categories={categories}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete Vendor</DialogTitle>
          <p className={cn('text-sm', 'text-muted-foreground')}>
            Are you sure you want to delete &quot;{vendorToDelete?.name}&quot;? This action cannot be undone.
          </p>
          <div className={cn('flex', 'gap-3', 'mt-4')}>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
