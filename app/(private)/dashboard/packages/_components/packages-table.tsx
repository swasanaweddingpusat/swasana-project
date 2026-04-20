"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Trash2, ArrowLeft, ArrowRight, PenLine, Eye, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { usePackages, useDeletePackage, useDeleteBulkPackages } from "@/hooks/use-packages";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { toast } from "sonner";
import SearchBar from "@/components/shared/search-bar";
import { DrawerPackage } from "./drawer-package";
import { DetailModal } from "./detail-modal";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

function SkeletonTable() {
  return (
    <div className="space-y-4 p-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 py-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <div className="flex gap-2"><Skeleton className="h-6 w-6" /><Skeleton className="h-6 w-6" /></div>
        </div>
      ))}
    </div>
  );
}

export function PackagesTable() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { data: packages = [], isLoading } = usePackages();
  const deleteMutation = useDeletePackage();
  const bulkDeleteMutation = useDeleteBulkPackages();
  const { canCreate, canEdit, canDelete, can } = usePermissions();

  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageQueryItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pkgToDelete, setPkgToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPkg, setDetailPkg] = useState<PackageQueryItem | null>(null);

  const searchQuery = searchParams.get("search") || "";
  const rowsPerPage = 10;

  // Filter
  const filtered = useMemo(() => {
    if (!searchQuery) return packages;
    const q = searchQuery.toLowerCase();
    return packages.filter(
      (p) =>
        p.packageName.toLowerCase().includes(q) ||
        p.venue?.name?.toLowerCase().includes(q)
    );
  }, [packages, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Helpers
  const priceRange = (pkg: PackageQueryItem) => {
    if (!pkg.variants?.length) return "-";
    const prices = pkg.variants.map((v) => v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
  };

  const allSelected = paginated.length > 0 && paginated.every((p) => selectedIds.has(p.id));
  const someSelected = paginated.some((p) => selectedIds.has(p.id));

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        paginated.forEach((p) => next.delete(p.id));
      } else {
        paginated.forEach((p) => next.add(p.id));
      }
      return next;
    });
  }, [allSelected, paginated]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleDelete = async () => {
    if (!pkgToDelete) return;
    const res = await deleteMutation.mutateAsync(pkgToDelete);
    if (res.success) {
      toast.success("Package deleted");
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(pkgToDelete); return n; });
    } else {
      toast.error(res.error ?? "Failed to delete");
    }
    setDeleteConfirmOpen(false);
    setPkgToDelete(null);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const res = await bulkDeleteMutation.mutateAsync(ids);
    if (res.success) {
      toast.success(`${ids.length} packages deleted`);
      setSelectedIds(new Set());
    } else {
      toast.error(res.error ?? "Failed to delete");
    }
    setBulkDeleteOpen(false);
  };

  const openEdit = (pkg: PackageQueryItem) => {
    setEditingPkg(pkg);
    setDrawerOpen(true);
  };

  const openAdd = () => {
    setEditingPkg(null);
    setDrawerOpen(true);
  };

  if (isLoading) return <SkeletonTable />;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Packages</h2>
              <span className="text-sm text-muted-foreground">({filtered.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <SearchBar placeholder="Search packages..." />
              {selectedIds.size > 0 && can("package", "delete") && (
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete ({selectedIds.size})
                </Button>
              )}
              {canCreate("package") && (
                <Button onClick={openAdd} className="cursor-pointer flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white rounded-md px-4 py-2 text-sm font-medium">
                  <Plus className="h-4 w-4" /> Add New Package
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Package Name</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Price Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No packages found" : "No packages yet"}
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((pkg, idx) => (
                  <TableRow key={pkg.id} className={cn(selectedIds.has(pkg.id) && "bg-muted/50")}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(pkg.id)}
                        onCheckedChange={() => toggleOne(pkg.id)}
                        aria-label={`Select ${pkg.packageName}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(currentPage - 1) * rowsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{pkg.packageName}</TableCell>
                    <TableCell>{pkg.venue?.name ?? "-"}</TableCell>
                    <TableCell>{pkg.variants?.length ?? 0}</TableCell>
                    <TableCell>{priceRange(pkg)}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        pkg.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {pkg.available ? "Available" : "Unavailable"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1.5 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => { setDetailPkg(pkg); setDetailOpen(true); }}
                          aria-label="View"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </button>
                        {can("package", "edit") && (
                          <button
                            className="p-1.5 rounded-md hover:bg-muted cursor-pointer"
                            onClick={() => openEdit(pkg)}
                            aria-label="Edit"
                          >
                            <PenLine className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                        {can("package", "delete") && (
                          <button
                            className="p-1.5 rounded-md hover:bg-muted cursor-pointer"
                            onClick={() => { setPkgToDelete(pkg.id); setDeleteConfirmOpen(true); }}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        )}
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
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
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

      {/* Drawer */}
      <DrawerPackage
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingPkg(null); }}
        editingPackage={editingPkg}
      />

      {/* Detail Modal */}
      <DetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        pkg={detailPkg}
        onEdit={(id) => {
          setDetailOpen(false);
          const p = packages.find((x) => x.id === id);
          if (p) openEdit(p);
        }}
      />

      {/* Delete Confirm */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Package</DialogTitle>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete {selectedIds.size} Packages</DialogTitle>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
