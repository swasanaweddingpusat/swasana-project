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
import { TrashBinTrash, ArrowLeft, ArrowRight, PenNewSquare, Eye, AddCircle, SettingsMinimalistic, ClipboardCheck, Refresh, FileText, Scanner, MenuDots, Magnifer, Filter, CloseCircle, Copy } from "@solar-icons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useVenues } from "@/hooks/use-venues";
import { usePackages, useDeletePackage, useDuplicatePackage, useDeleteBulkPackages, usePackageApprovals, useTogglePackageAvailable, useUnverifyPackage } from "@/hooks/use-packages";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { fetchPackages } from "@/services/package-service";
import { toast } from "sonner";
import { DrawerPackage } from "./drawer-package";
import { DetailModal } from "./detail-modal";
import { DrawerFinance } from "./drawer-finance";
import { ApprovalDialog } from "./approval-dialog";
import { ApproveModal } from "./approve-modal";
import { PackageTCDrawer } from "@/components/shared/PackageTCDrawer";
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
        <div key={i} className="rounded-2xl border bg-card p-4 space-y-2 shadow-sm">
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

export function PackagesTable({ packageType = "wedding" }: { packageType?: "wedding" | "mice" } = {}) {
  const category = packageType === "mice" ? "MICE" : "WEDDINGS";
  const permModule = packageType === "mice" ? "package-mice" : "package";
  const approvalModule = permModule;
  const titleLabel = packageType === "mice" ? "Mice Packages" : "Packages";
  const addLabel = packageType === "mice" ? "Add New Mice Package" : "Add New Package";

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
    category,
  });

  const packages = packagesResult?.data ?? [];
  const total = packagesResult?.total ?? 0;
  const totalPages = packagesResult?.totalPages ?? 0;

  const deleteMutation = useDeletePackage();
  const duplicateMutation = useDuplicatePackage();
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
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [pkgToDuplicate, setPkgToDuplicate] = useState<PackageQueryItem | null>(null);
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
  const { data: approvals = [], isLoading: approvalsLoading } = usePackageApprovals(approvalModule);

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

  const handleDuplicate = async () => {
    if (!pkgToDuplicate) return;
    const res = await duplicateMutation.mutateAsync(pkgToDuplicate.id);
    if (res.success) {
      toast.success(`Package diduplikat sebagai "${res.data.packageName}"`);
    } else {
      toast.error(res.error ?? "Gagal menduplikat package");
    }
    setDuplicateConfirmOpen(false);
    setPkgToDuplicate(null);
  };

  const openEdit = (pkg: PackageQueryItem) => {
    setEditingPkg(pkg);
    setDrawerOpen(true);
  };

  const openAdd = () => {
    setEditingPkg(null);
    setDrawerOpen(true);
  };

  // Desktop actions — icon buttons + dropdowns (sm+)
  function renderPackageActions(pkg: PackageQueryItem) {
    return (
      <>
        {can(permModule,"term-&-condition") && (
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
                    category,
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
        {can(permModule,"set-harga") && (
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
        {can(permModule,"edit") && (
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
        {(can(permModule,"view") || can(permModule,"create") || can(permModule,"delete") || (can(permModule,"set-status") && pkg.approvalStatus === "approved")) && (
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
              {can(permModule,"view") && (
                <DropdownMenuItem
                  onSelect={() => { setDetailPkg(pkg); setDetailOpen(true); }}
                >
                  <Eye weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
                  Lihat Detail
                </DropdownMenuItem>
              )}
              {can(permModule,"view") && (
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
              {can(permModule,"create") && (
                <DropdownMenuItem
                  onSelect={() => { setPkgToDuplicate(pkg); setDuplicateConfirmOpen(true); }}
                >
                  <Copy weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
                  Duplikat
                </DropdownMenuItem>
              )}
              {can(permModule,"set-status") && pkg.approvalStatus === "approved" && (
                <>
                  {can(permModule,"view") && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={unverifyMutation.isPending}
                    onSelect={async () => {
                      const res = await unverifyMutation.mutateAsync(pkg.id);
                      if (!res.success) toast.error(res.error ?? "Gagal unverify");
                      else toast.success("Approval dibatalkan, paket kembali ke draft.");
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <CloseCircle weight="BoldDuotone" className="mr-2 h-4 w-4" />
                    Batalkan Approval
                  </DropdownMenuItem>
                </>
              )}
              {can(permModule,"delete") && (
                <>
                  {can(permModule,"view") && <DropdownMenuSeparator />}
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

  // Mobile actions — compact single dropdown "..." with all secondary actions
  function renderMobileActions(pkg: PackageQueryItem) {
    const hasTc = can(permModule,"term-&-condition");
    const hasSetHarga = can(permModule,"set-harga");
    const hasPreview = can(permModule,"view");
    const hasDuplicate = can(permModule,"create");
    const hasDelete = can(permModule,"delete");

    const approvalRecord = approvalMap.get(pkg.id);
    const hasApproval = !!approvalRecord &&
      approvalRecord.status !== "approved" &&
      pkg.approvalStatus !== "approved";
    const hasUnverify = can(permModule,"set-status") && pkg.approvalStatus === "approved";

    const hasAnySecondary = hasTc || hasSetHarga || hasPreview || hasDuplicate || hasDelete || hasApproval || hasUnverify;
    if (!hasAnySecondary) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors cursor-pointer shrink-0"
            aria-label="Aksi lainnya"
          >
            <MenuDots weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {hasTc && (
            <DropdownMenuItem
              onSelect={async () => {
                setTcPkg(pkg);
                setTcDrawerOpen(true);
                try {
                  const fresh = await fetchPackages({
                    page: currentPage,
                    pageSize: ROWS_PER_PAGE,
                    search: debouncedSearch || undefined,
                    venueId: selectedVenueId,
                    category,
                  });
                  const updated = fresh.data.find((p) => p.id === pkg.id);
                  if (updated) setTcPkg(updated);
                } catch {
                  /* keep the already-shown data on failure */
                }
              }}
            >
              <FileText weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
              Term & Condition
            </DropdownMenuItem>
          )}
          {hasSetHarga && (
            <DropdownMenuItem
              onSelect={() => { setFinancePkg(pkg); setFinanceOpen(true); }}
            >
              <SettingsMinimalistic weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
              Set Harga
            </DropdownMenuItem>
          )}
          {hasApproval && approvalRecord && (() => {
            const steps = approvalRecord.steps;
            return steps.map((step) => {
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
                  <ClipboardCheck weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
                  {isApproved ? `✓ ${label}` : isRejected ? `✗ ${label}` : `Approve ${label}`}
                </DropdownMenuItem>
              );
            });
          })()}
          {hasPreview && (
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
          {hasDuplicate && (
            <DropdownMenuItem
              onSelect={() => { setPkgToDuplicate(pkg); setDuplicateConfirmOpen(true); }}
            >
              <Copy weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
              Duplikat
            </DropdownMenuItem>
          )}
          {hasUnverify && (
            <>
              {(hasTc || hasSetHarga || hasApproval || hasPreview || hasDuplicate) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={unverifyMutation.isPending}
                onSelect={async () => {
                  const res = await unverifyMutation.mutateAsync(pkg.id);
                  if (!res.success) toast.error(res.error ?? "Gagal unverify");
                  else toast.success("Approval dibatalkan, paket kembali ke draft.");
                }}
                className="text-destructive focus:text-destructive"
              >
                <CloseCircle weight="BoldDuotone" className="mr-2 h-4 w-4" />
                Batalkan Approval
              </DropdownMenuItem>
            </>
          )}
          {hasDelete && (
            <>
              {(hasTc || hasSetHarga || hasApproval || hasPreview || hasDuplicate || hasUnverify) && <DropdownMenuSeparator />}
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
    );
  }

  if (isLoading || approvalsLoading) return <SkeletonTable />;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* ── Mobile toolbar (< sm) ──
              Row 1: [Packages (count) refresh] ── [filter] [add]
              Row 2: [search full-width] */}
          <div className="flex flex-col gap-2 px-4 pt-0 pb-3 border-b sm:hidden">
            {/* Row 1 */}
            <div className="flex items-center gap-2">
              <h2 className={cn('text-base', 'font-bold', 'text-foreground')}>{titleLabel}</h2>
              <span className={cn('text-sm', 'text-muted-foreground')}>({total})</span>
              <button onClick={handleRefresh} disabled={refreshing} className={cn('p-1', 'rounded-md', 'hover:bg-muted', 'cursor-pointer', 'text-muted-foreground')}>
                <Refresh weight="BoldDuotone" className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </button>
              <div className="flex-1" />
              {/* Venue filter — icon only */}
              <Select
                value={selectedVenueId ?? "all"}
                onValueChange={(val) => {
                  setSelectedVenueId(val === "all" ? undefined : val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  aria-label="Filter venue"
                  className={cn('shrink-0', 'w-9', 'justify-center', 'px-0', '[&>svg:last-child]:hidden', 'bg-muted/40', selectedVenueId && 'border-primary/50')}
                >
                  <Filter weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                  <SelectValue className="hidden!" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIds.size > 0 && can(permModule,"delete") && (
                <Button variant="destructive" size="icon" onClick={() => setBulkDeleteOpen(true)} aria-label={`Hapus ${selectedIds.size} paket`} className="shrink-0">
                  <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                </Button>
              )}
              {canCreate(permModule) && (
                <Button size="icon" onClick={openAdd} aria-label={addLabel} className="shrink-0">
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                </Button>
              )}
            </div>
            {/* Row 2: Search */}
            <div className="relative w-full">
              <Magnifer weight="BoldDuotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search packages..."
                className="pl-10 bg-muted/40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {/* ── Desktop toolbar (sm+) ── */}
          <div className={cn('hidden', 'sm:flex', 'flex-row', 'items-center', 'justify-between', 'gap-3', 'px-6', 'pt-0', 'pb-4', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <h2 className={cn('text-base', 'font-bold', 'text-foreground')}>{titleLabel}</h2>
              <span className={cn('text-sm', 'text-muted-foreground')}>({total})</span>
              <button onClick={handleRefresh} disabled={refreshing} className={cn('p-1', 'rounded-md', 'hover:bg-muted', 'cursor-pointer', 'text-muted-foreground')}>
                <Refresh weight="BoldDuotone" className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </button>
            </div>
            <div className={cn('flex', 'flex-row', 'items-center', 'gap-2')}>
              <div className="relative w-75">
                <Magnifer weight="BoldDuotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages..."
                  className="pl-10 bg-muted/40"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <Select
                value={selectedVenueId ?? "all"}
                onValueChange={(val) => {
                  setSelectedVenueId(val === "all" ? undefined : val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-48 bg-muted/40">
                  <SelectValue placeholder="Semua Venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIds.size > 0 && can(permModule,"delete") && (
                <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)} className={cn('cursor-pointer', 'flex', 'items-center', 'gap-2')}>
                  <TrashBinTrash weight="BoldDuotone" className={cn('h-4', 'w-4')} /> Delete ({selectedIds.size})
                </Button>
              )}
              {canCreate(permModule) && (
                <Button onClick={openAdd} className={cn('cursor-pointer', 'flex', 'items-center', 'gap-2')}>
                  <AddCircle weight="BoldDuotone" className={cn('h-4', 'w-4')} /> {addLabel}
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
                          {can(permModule,"set-status") ? (
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
                          {/* Status badge — always opens the read-only approval dialog
                              (incl. Approved). Unverify lives in the "..." menu. */}
                          <button
                            type="button"
                            onClick={() => setApprovalPkg(pkg)}
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                              pkg.approvalStatus === "pending" && "bg-muted text-muted-foreground",
                              pkg.approvalStatus === "rejected" && "bg-destructive/10 text-destructive",
                              pkg.approvalStatus === "draft" && "bg-secondary text-muted-foreground",
                              pkg.approvalStatus === "approved" && "bg-primary text-primary-foreground",
                            )}
                          >
                            {pkg.approvalStatus === "pending" ? "Pending" : pkg.approvalStatus === "rejected" ? "Rejected" : pkg.approvalStatus === "approved" ? "Approved" : "Draft"}
                          </button>
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
              <div className={cn('block', 'sm:hidden', 'px-3', 'py-3', 'space-y-3')}>
                {paginated.map((pkg, idx) => {
                  const rowNumber = (currentPage - 1) * ROWS_PER_PAGE + idx + 1;
                  return (
                    <div
                      key={pkg.id}
                      className={cn('rounded-2xl', 'border', 'bg-card', 'p-4', 'space-y-2', 'shadow-sm', 'hover:shadow-md', 'transition-shadow', selectedIds.has(pkg.id) && "border-primary/40 bg-primary/5")}
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
                        {can(permModule,"set-status") ? (
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
                        {/* Status badge — always opens the read-only approval dialog
                            (incl. Approved). Unverify lives in the "..." menu. */}
                        <button
                          type="button"
                          onClick={() => setApprovalPkg(pkg)}
                          className={cn(
                            "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                            pkg.approvalStatus === "pending" && "bg-muted text-muted-foreground",
                            pkg.approvalStatus === "rejected" && "bg-destructive/10 text-destructive",
                            pkg.approvalStatus === "draft" && "bg-secondary text-muted-foreground",
                            pkg.approvalStatus === "approved" && "bg-primary text-primary-foreground",
                          )}
                        >
                          {pkg.approvalStatus === "pending" ? "Pending" : pkg.approvalStatus === "rejected" ? "Rejected" : pkg.approvalStatus === "approved" ? "Approved" : "Draft"}
                        </button>
                      </div>

                      {/* Footer: action buttons — primary CTAs + compact secondary dropdown */}
                      <div className={cn('flex', 'items-center', 'gap-1.5', 'pt-2', 'border-t', 'border-border')}>
                        {can(permModule,"edit") && (
                          <Button
                            variant="outline"
                            className={cn('h-9', 'flex-1', 'text-xs', 'rounded-xl')}
                            onClick={() => openEdit(pkg)}
                            aria-label={`Edit ${pkg.packageName}`}
                          >
                            <PenNewSquare weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Edit
                          </Button>
                        )}
                        {can(permModule,"view") && (
                          <Button
                            variant="outline"
                            className={cn('h-9', 'flex-1', 'text-xs', 'rounded-xl')}
                            onClick={() => { setDetailPkg(pkg); setDetailOpen(true); }}
                            aria-label={`Lihat detail ${pkg.packageName}`}
                          >
                            <Eye weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Detail
                          </Button>
                        )}
                        {renderMobileActions(pkg)}
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
        packageType={packageType}
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
          module={approvalModule}
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

      {/* Duplicate Confirm */}
      <Dialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Duplikat Package</DialogTitle>
          <p className={cn('text-sm', 'text-muted-foreground')}>
            Buat salinan dari <span className="font-medium text-foreground">{pkgToDuplicate?.packageName}</span>? Package baru dibuat sebagai draft dan belum tersedia sampai disetujui.
          </p>
          <div className={cn('flex', 'justify-end', 'gap-2', 'mt-4')}>
            <Button variant="outline" onClick={() => setDuplicateConfirmOpen(false)}>Batal</Button>
            <Button onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
              {duplicateMutation.isPending ? "Menduplikat..." : "Duplikat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
