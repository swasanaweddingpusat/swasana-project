"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TrashBinTrash, ArrowLeft, ArrowRight, PenNewSquare, Eye, AddCircle, SettingsMinimalistic, ClipboardCheck, Refresh, FileText, Scanner, MenuDots, Magnifer } from "@solar-icons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useVenues } from "@/hooks/use-venues";
import { usePackages, useDeletePackage, useDeleteBulkPackages, usePackageApprovals, useTogglePackageAvailable, useUnverifyPackage } from "@/hooks/use-packages";
import type { PackageQueryItem, PackagesQueryResult } from "@/lib/queries/packages";
import { fetchPackages } from "@/services/package-service";
import { toast } from "sonner";
import { DrawerPackage } from "./drawer-package";
import { DetailModal } from "./detail-modal";
import { DrawerFinance } from "./drawer-finance";
import { ApprovalDialog } from "./approval-dialog";
import { ApproveModal } from "./approve-modal";
import { PackageTCDrawer } from "./package-tc-drawer";
import { POPreviewModal } from "./po-preview-modal";
import { useCurrentUser } from "@/hooks/use-current-user";

const ROWS_PER_PAGE = 10;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

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

function SkeletonTableBody({ rows = ROWS_PER_PAGE }: { rows?: number }) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-4 rounded-sm" /></TableCell>
          <TableCell><Skeleton className="h-4 w-5" /></TableCell>
          <TableCell>
            <div className="space-y-1.5">
              <Skeleton className="h-4 rounded" style={{ width: `${55 + (i % 5) * 9}%` }} />
              <Skeleton className="h-3 w-32 rounded lg:hidden" />
            </div>
          </TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24 rounded" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-8 rounded" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20 rounded" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell>
            <div className="flex items-center gap-1 justify-end">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

function SkeletonMobileCards({ rows = ROWS_PER_PAGE }: { rows?: number }) {
  return (
    <div className="block sm:hidden p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
              <Skeleton className="h-4 rounded" style={{ width: `${120 + (i % 4) * 20}px` }} />
            </div>
            <Skeleton className="h-5 w-20 rounded-full shrink-0" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <div className="flex items-center gap-1 pt-1 border-t border-border">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-md shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonTable() {
  return (
    <Card>
      <CardContent className="p-0">
        {/* Header skeleton: title + count + search + btn */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-52 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>

        {/* Table header skeleton */}
        <div className="grid grid-cols-[2.5rem_2.5rem_1fr_1fr_5rem_7rem_6rem_7rem_6rem] items-center gap-3 px-6 py-3 border-b">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-5" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>

        {/* Table rows skeleton */}
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2.5rem_2.5rem_1fr_1fr_5rem_7rem_6rem_7rem_6rem] items-center gap-3 px-6 py-3.5">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <Skeleton className="h-4 w-5" />
              <Skeleton className="h-4 w-40" style={{ width: `${60 + (i % 4) * 15}%` }} />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Pagination skeleton */}
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

export function PackagesTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: venues = [] } = useVenues();

  const { data: packagesResult, isLoading, isFetching } = usePackages({
    page: currentPage,
    pageSize: ROWS_PER_PAGE,
    search: debouncedSearch || undefined,
    venueId: selectedVenueId,
  });

  const packages = packagesResult?.data ?? [];
  const total = packagesResult?.total ?? 0;
  const totalPages = packagesResult?.totalPages ?? 0;

  const deleteMutation = useDeletePackage();
  const bulkDeleteMutation = useDeleteBulkPackages();
  const { canCreate, can, isAdmin } = usePermissions();
  const qc = useQueryClient();
  const toggleAvailableMutation = useTogglePackageAvailable();
  const unverifyMutation = useUnverifyPackage();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["packages"] });
    await qc.invalidateQueries({ queryKey: ["package-approvals"] });
    setRefreshing(false);
  }

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageQueryItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pkgToDelete, setPkgToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPkg, setDetailPkg] = useState<PackageQueryItem | null>(null);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [financePkg, setFinancePkg] = useState<PackageQueryItem | null>(null);
  const [approvalPkg, setApprovalPkg] = useState<PackageQueryItem | null>(null);
  const [approveModal, setApproveModal] = useState<{ stepId: string; stepLabel: string; packageName: string } | null>(null);
  const { user } = useCurrentUser();
  const [tcDrawerOpen, setTcDrawerOpen] = useState(false);
  const [tcPkg, setTcPkg] = useState<PackageQueryItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    packageId: string;
    packageName: string;
  } | null>(null);
  const { data: approvals = [], isLoading: approvalsLoading } = usePackageApprovals();

  // Map approvals by entityId for quick lookup
  const approvalMap = useMemo(() => {
    const map = new Map<string, typeof approvals[number]>();
    for (const r of approvals) map.set(r.entityId, r);
    return map;
  }, [approvals]);

  const paginated = packages;

  // Helpers
  const getPackagePrice = (pkg: PackageQueryItem) => {
    if (pkg.sellingPrice > 0) return formatCurrency(pkg.sellingPrice);
    const base = (pkg.categoryPrices ?? []).reduce((s, c) => s + Number(c.basePrice), 0);
    if (!base) return "-";
    return formatCurrency(base + Math.round(base * ((pkg.margin ?? 0) / 100)));
  };

  const allSelected = paginated.length > 0 && paginated.every((p) => selectedIds.has(p.id));

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
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
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

  function renderPackageActions(pkg: PackageQueryItem) {
    return (
      <>
        {can("package", "term-&-condition") && (
          <Tooltip>
            <TooltipTrigger
              className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}
              onClick={async () => {
                // Open immediately with current data, then silently refresh just this
                // package's T&C in the background — without touching the table query
                // (refetchQueries would flip isFetching and flash the whole table).
                setTcPkg(pkg);
                setTcDrawerOpen(true);
                try {
                  const fresh = await fetchPackages({
                    page: currentPage,
                    pageSize: ROWS_PER_PAGE,
                    search: debouncedSearch || undefined,
                    venueId: selectedVenueId,
                  });
                  const updated = fresh.data.find((p) => p.id === pkg.id);
                  if (updated) setTcPkg(updated);
                } catch {
                  /* keep the already-shown data on failure */
                }
              }}
            >
              <FileText weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground')} />
            </TooltipTrigger>
            <TooltipContent>Term & Condition</TooltipContent>
          </Tooltip>
        )}
        {can("package", "set-harga") && (
          <Tooltip>
            <TooltipTrigger
              className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}
              onClick={() => { setFinancePkg(pkg); setFinanceOpen(true); }}
            >
              <SettingsMinimalistic weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground')} />
            </TooltipTrigger>
            <TooltipContent>Set Harga</TooltipContent>
          </Tooltip>
        )}
        {approvalMap.has(pkg.id) && (() => {
          const record = approvalMap.get(pkg.id)!;
          if (record.status === "approved" || pkg.approvalStatus === "approved") return null;
          const steps = record.steps;
          return (
            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger asChild>
                  <TooltipTrigger
                    className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}
                  >
                    <ClipboardCheck weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground')} />
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent>Approval</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {steps.map((step) => {
                  const label = step.approverType === "role" ? step.approverRole?.name : step.approverUser?.fullName;
                  const isApproved = step.status === "approved";
                  const isRejected = step.status === "rejected";
                  const isPending = step.status === "pending";
                  const canAct = isPending && (
                    isAdmin ||
                    (step.approverType === "role" && step.approverRoleId === user?.roleId) ||
                    (step.approverType === "user" && step.approverUserId === user?.profileId)
                  );
                  return (
                    <DropdownMenuItem
                      key={step.id}
                      className="cursor-pointer"
                      disabled={isApproved || isRejected || (isPending && !canAct)}
                      onClick={() => {
                        if (canAct) {
                          setApproveModal({ stepId: step.id, stepLabel: label ?? "Unknown", packageName: pkg.packageName });
                        } else {
                          setApprovalPkg(pkg);
                        }
                      }}
                    >
                      {isApproved ? `✓ ${label}` : isRejected ? `✗ ${label}` : `Approve ${label}`}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}
        {can("package", "edit") && (
          <Tooltip>
            <TooltipTrigger
              className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer', 'hidden', 'sm:flex')}
              onClick={() => openEdit(pkg)}
            >
              <PenNewSquare weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground')} />
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
        )}
        {(can("package", "view") || can("package", "delete")) && (
          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger
                  className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}
                >
                  <MenuDots weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground')} />
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent>Lainnya</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              {can("package", "view") && (
                <DropdownMenuItem
                  onSelect={() => { setDetailPkg(pkg); setDetailOpen(true); }}
                >
                  <Eye weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
                  Lihat Detail
                </DropdownMenuItem>
              )}
              {can("package", "view") && (
                <DropdownMenuItem
                  onSelect={() => {
                    setPreviewTarget({ packageId: pkg.id, packageName: pkg.packageName });
                    setPreviewOpen(true);
                  }}
                >
                  <Scanner weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
                  Preview PO
                </DropdownMenuItem>
              )}
              {can("package", "delete") && (
                <>
                  {can("package", "view") && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onSelect={() => { setPkgToDelete(pkg.id); setDeleteConfirmOpen(true); }}
                    className="text-destructive focus:text-destructive"
                  >
                    <TrashBinTrash weight="BoldDuotone" className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </>
    );
  }

  if (isLoading || approvalsLoading) return <SkeletonTable />;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'items-start', 'sm:items-center', 'justify-between', 'gap-3', 'px-6', 'pb-4', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <h2 className={cn('text-base', 'font-bold', 'text-foreground')}>Packages</h2>
              <span className={cn('text-sm', 'text-muted-foreground')}>({total})</span>
              <button onClick={handleRefresh} disabled={refreshing} className={cn('p-1', 'rounded-md', 'hover:bg-muted', 'cursor-pointer', 'text-muted-foreground')}>
                <Refresh weight="BoldDuotone" className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </button>
            </div>
            <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2')}>
              {/* Venue filter */}
              <Select
                value={selectedVenueId ?? "all"}
                onValueChange={(val) => {
                  setSelectedVenueId(val === "all" ? undefined : val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-48 bg-muted/40">
                  <SelectValue placeholder="Semua Venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-full sm:w-75">
                <Magnifer weight="BoldDuotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages..."
                  className="pl-10 bg-muted/40"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
              {selectedIds.size > 0 && can("package", "delete") && (
                <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)} className={cn('cursor-pointer', 'flex', 'items-center', 'gap-2')}>
                  <TrashBinTrash weight="BoldDuotone" className={cn('h-4', 'w-4')} /> Delete ({selectedIds.size})
                </Button>
              )}
              {canCreate("package") && (
                <Button onClick={openAdd} className={cn('cursor-pointer', 'flex', 'items-center', 'gap-2')}>
                  <AddCircle weight="BoldDuotone" className={cn('h-4', 'w-4')} /> Add New Package
                </Button>
              )}
            </div>
          </div>

          {/* Table — desktop (sm+) */}
          {!isFetching && paginated.length === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-muted-foreground')}>
              <AddCircle weight="BoldDuotone" className={cn('h-10', 'w-10', 'mb-3', 'opacity-40')} />
              <p className="text-sm">{debouncedSearch || selectedVenueId ? "No packages found" : "No packages yet"}</p>
            </div>
          ) : (
            <>
              <div className={cn('hidden', 'sm:block', 'w-full', 'overflow-x-auto')}>
                <Table className={cn('w-full', 'text-sm')}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                      </TableHead>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Package Name</TableHead>
                      <TableHead className={cn('hidden', 'sm:table-cell')}>Venue</TableHead>
                      <TableHead className={cn('hidden', 'lg:table-cell')}>PAX</TableHead>
                      <TableHead className={cn('hidden', 'lg:table-cell')}>Harga Jual</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className={cn('hidden', 'sm:table-cell')}>Approval</TableHead>
                      <TableHead className="w-24 text-right pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  {isFetching ? (
                    <SkeletonTableBody rows={Math.max(paginated.length, ROWS_PER_PAGE)} />
                  ) : (
                  <TableBody>
                    {paginated.map((pkg, idx) => (
                      <TableRow key={pkg.id} className={cn(selectedIds.has(pkg.id) && "bg-muted/50")}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(pkg.id)}
                            onCheckedChange={() => toggleOne(pkg.id)}
                            aria-label={`Select ${pkg.packageName}`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="leading-tight">
                            <p className={cn('font-medium', 'text-foreground', 'truncate')}>{pkg.packageName}</p>
                            {/* venue + PAX shown in name cell on md (when cols are hidden at lg) */}
                            <p className={cn('text-xs', 'text-muted-foreground', 'mt-0.5', 'lg:hidden')}>{pkg.venue?.name ?? "—"}{pkg.pax ? ` · ${pkg.pax} PAX` : ""}</p>
                            <p className={cn('text-xs', 'text-muted-foreground', 'lg:hidden')}>{getPackagePrice(pkg)}</p>
                          </div>
                        </TableCell>
                        <TableCell className={cn('hidden', 'sm:table-cell')}>{pkg.venue?.name ?? "-"}</TableCell>
                        <TableCell className={cn('hidden', 'lg:table-cell')}>{pkg.pax ?? 0}</TableCell>
                        <TableCell className={cn('hidden', 'lg:table-cell')}>{getPackagePrice(pkg)}</TableCell>
                        <TableCell>
                          {can("package", "set-status") ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await toggleAvailableMutation.mutateAsync(pkg.id);
                                if (!res.success) toast.error(res.error);
                              }}
                              disabled={toggleAvailableMutation.isPending}
                              className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-70 transition-opacity",
                                pkg.available ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                              )}
                            >
                              {pkg.available ? "Available" : "Unavailable"}
                            </button>
                          ) : (
                            <span className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                              pkg.available ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                            )}>
                              {pkg.available ? "Available" : "Unavailable"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={cn('hidden', 'sm:table-cell')}>
                          {pkg.approvalStatus !== "approved" ? (
                            <button
                              type="button"
                              onClick={() => setApprovalPkg(pkg)}
                              className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                pkg.approvalStatus === "pending" && "bg-muted text-muted-foreground",
                                pkg.approvalStatus === "rejected" && "bg-destructive/10 text-destructive",
                                pkg.approvalStatus === "draft" && "bg-secondary text-muted-foreground",
                              )}
                            >
                              {pkg.approvalStatus === "pending" ? "Pending" : pkg.approvalStatus === "rejected" ? "Rejected" : "Draft"}
                            </button>
                          ) : can("package", "set-status") ? (
                            <button
                              type="button"
                              disabled={unverifyMutation.isPending}
                              onClick={async () => {
                                const res = await unverifyMutation.mutateAsync(pkg.id);
                                if (!res.success) toast.error(res.error ?? "Gagal unverify");
                              }}
                              className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground cursor-pointer hover:opacity-80 transition-opacity")}
                            >
                              Approved
                            </button>
                          ) : (
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground")}>Approved</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={cn('flex', 'items-center', 'gap-1', 'justify-end')}>
                            {renderPackageActions(pkg)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  )}
                </Table>
              </div>

              {/* Mobile (<sm): card list */}
              {isFetching ? (
                <SkeletonMobileCards rows={Math.max(paginated.length, ROWS_PER_PAGE)} />
              ) : (
              <div className={cn('block', 'sm:hidden', 'p-4', 'space-y-3')}>
                {paginated.map((pkg, idx) => {
                  const rowNumber = (currentPage - 1) * ROWS_PER_PAGE + idx + 1;
                  return (
                    <div
                      key={pkg.id}
                      className={cn('rounded-lg', 'border', 'bg-card', 'p-3', 'space-y-2', selectedIds.has(pkg.id) && "border-primary/40 bg-primary/5")}
                    >
                      {/* Row 1: checkbox + name + status badge */}
                      <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
                        <div className={cn('flex', 'items-center', 'gap-2', 'min-w-0')}>
                          <Checkbox
                            checked={selectedIds.has(pkg.id)}
                            onCheckedChange={() => toggleOne(pkg.id)}
                            aria-label={`Select ${pkg.packageName}`}
                          />
                          <span className={cn('font-medium', 'text-foreground', 'truncate', 'text-sm')}>
                            {rowNumber}. {pkg.packageName}
                          </span>
                        </div>
                        {can("package", "set-status") ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await toggleAvailableMutation.mutateAsync(pkg.id);
                              if (!res.success) toast.error(res.error);
                            }}
                            disabled={toggleAvailableMutation.isPending}
                            className={cn(
                              "inline-flex shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-70 transition-opacity",
                              pkg.available ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {pkg.available ? "Available" : "Unavailable"}
                          </button>
                        ) : (
                          <span className={cn(
                            "inline-flex shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium",
                            pkg.available ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                          )}>
                            {pkg.available ? "Available" : "Unavailable"}
                          </span>
                        )}
                      </div>

                      {/* Row 2: venue + pax */}
                      <div className={cn('flex', 'items-center', 'gap-1.5', 'flex-wrap', 'text-xs', 'text-muted-foreground')}>
                        <span className="truncate">{pkg.venue?.name ?? "Venue —"}</span>
                        {pkg.pax ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{pkg.pax} PAX</span>
                          </>
                        ) : null}
                        {getPackagePrice(pkg) !== "-" && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-foreground/70 font-medium">{getPackagePrice(pkg)}</span>
                          </>
                        )}
                      </div>

                      {/* Row 3: approval badge */}
                      <div className={cn('flex', 'items-center', 'gap-1.5', 'flex-wrap', 'text-xs')}>
                        {pkg.approvalStatus !== "approved" ? (
                          <button
                            type="button"
                            onClick={() => setApprovalPkg(pkg)}
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                              pkg.approvalStatus === "pending" && "bg-muted text-muted-foreground",
                              pkg.approvalStatus === "rejected" && "bg-destructive/10 text-destructive",
                              pkg.approvalStatus === "draft" && "bg-secondary text-muted-foreground",
                            )}
                          >
                            {pkg.approvalStatus === "pending" ? "Pending" : pkg.approvalStatus === "rejected" ? "Rejected" : "Draft"}
                          </button>
                        ) : can("package", "set-status") ? (
                          <button
                            type="button"
                            disabled={unverifyMutation.isPending}
                            onClick={async () => {
                              const res = await unverifyMutation.mutateAsync(pkg.id);
                              if (!res.success) toast.error(res.error ?? "Gagal unverify");
                            }}
                            className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary text-primary-foreground cursor-pointer hover:opacity-80 transition-opacity")}
                          >
                            Approved
                          </button>
                        ) : (
                          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary text-primary-foreground")}>Approved</span>
                        )}
                      </div>

                      {/* Footer: action buttons */}
                      <div className={cn('flex', 'items-center', 'gap-1', 'pt-1', 'border-t', 'border-border')}>
                        {can("package", "edit") && (
                          <Button
                            variant="outline"
                            className={cn('h-9', 'flex-1', 'text-xs')}
                            onClick={() => openEdit(pkg)}
                            aria-label={`Edit ${pkg.packageName}`}
                          >
                            <PenNewSquare weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Edit
                          </Button>
                        )}
                        {can("package", "view") && (
                          <Button
                            variant="outline"
                            className={cn('h-9', 'flex-1', 'text-xs')}
                            onClick={() => { setDetailPkg(pkg); setDetailOpen(true); }}
                            aria-label={`Lihat detail ${pkg.packageName}`}
                          >
                            <Eye weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Detail
                          </Button>
                        )}
                        <div className={cn('flex', 'items-center', 'gap-1', 'shrink-0')}>
                          {renderPackageActions(pkg)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={cn('flex', 'justify-between', 'items-center', 'px-4', 'sm:px-6', 'py-4', 'border-t')}>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage <= 1}>
                <ArrowLeft weight="BoldDuotone" className={cn('w-4', 'h-4', 'sm:mr-2')} /> <span className={cn('hidden', 'sm:inline')}>Previous</span>
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
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages}>
                <span className={cn('hidden', 'sm:inline')}>Next</span> <ArrowRight weight="BoldDuotone" className={cn('w-4', 'h-4', 'sm:ml-2')} />
              </Button>
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
          const p = paginated.find((x) => x.id === id);
          if (p) openEdit(p);
        }}
      />

      {/* Finance Drawer */}
      <DrawerFinance
        isOpen={financeOpen}
        onClose={() => { setFinanceOpen(false); setFinancePkg(null); }}
        pkg={financePkg}
      />

      {approvalPkg && user && (
        <ApprovalDialog
          open={!!approvalPkg}
          onClose={() => setApprovalPkg(null)}
          packageId={approvalPkg.id}
          packageName={approvalPkg.packageName}
          userProfileId={user.profileId}
          userRoleId={user.roleId}
          isSuperAdmin={user.isSuperAdmin}
        />
      )}

      {approveModal && (
        <ApproveModal
          open={!!approveModal}
          onClose={() => setApproveModal(null)}
          stepId={approveModal.stepId}
          stepLabel={approveModal.stepLabel}
          packageName={approveModal.packageName}
        />
      )}

      <PackageTCDrawer
        open={tcDrawerOpen}
        onClose={() => { setTcDrawerOpen(false); setTcPkg(null); }}
        pkg={tcPkg}
      />

      <POPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        target={previewTarget}
      />

      {/* Delete Confirm */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Package</DialogTitle>
          <p className={cn('text-sm', 'text-muted-foreground')}>Are you sure? This action cannot be undone.</p>
          <div className={cn('flex', 'justify-end', 'gap-2', 'mt-4')}>
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
          <p className={cn('text-sm', 'text-muted-foreground')}>Are you sure? This action cannot be undone.</p>
          <div className={cn('flex', 'justify-end', 'gap-2', 'mt-4')}>
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
