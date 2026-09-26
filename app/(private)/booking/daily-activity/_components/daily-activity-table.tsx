"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, isSameDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddCircle, PenNewSquare, TrashBinTrash, Refresh, Magnifer, Eye, Filter, Download } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { useDailyActivities, useDeleteDailyActivity } from "@/hooks/use-daily-activities";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import type { ProgressStatus } from "@/lib/validations/daily-activity";
import type {
  DailyActivitiesResult,
  DailyActivityItem,
  DailyActivitySegmentOption,
} from "@/lib/queries/daily-activity";
import type { SalesMiceProfile } from "@/lib/queries/bookings";
import type { SourceOfInformationItem } from "@/lib/queries/source-of-information";
import type { FetchDailyActivitiesParams } from "@/services/daily-activity-service";
import { ProgressStatusBadge } from "./progress-status";
import { DailyActivityDrawer } from "./daily-activity-drawer";
import { DailyActivityDetailModal } from "./daily-activity-detail-modal";
import { DailyActivityFilterDrawer } from "./DailyActivityFilterDrawer";

const ROWS_PER_PAGE = 10;
const DEBOUNCE_DELAY_MS = 400;

function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// Local calendar day (not UTC) — avoids the off-by-one from toISOString().
// Duplicated here (not imported from lib/queries/daily-activity.ts) because
// that file imports `db` (Prisma/Neon) at module scope and would break the
// client bundle if pulled into a "use client" component.
function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Current calendar month as a range — the default "Tanggal Aktivitas" filter
 * when the user hasn't picked a custom range. Must mirror the default computed
 * server-side in `app/(private)/booking/daily-activity/page.tsx` so the
 * initial render and this component agree. */
function getDefaultMonthRange(): DateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

function isSameRange(a: DateRange | undefined, b: DateRange | undefined): boolean {
  if (!a?.from || !b?.from) return !a?.from && !b?.from;
  if (!isSameDay(a.from, b.from)) return false;
  if (!a.to || !b.to) return !a.to && !b.to;
  return isSameDay(a.to, b.to);
}

interface DailyActivityTableProps {
  initialData: DailyActivitiesResult;
  salesProfiles: SalesMiceProfile[];
  segments: DailyActivitySegmentOption[];
  sources: SourceOfInformationItem[];
}

export function DailyActivityTable({
  initialData,
  salesProfiles,
  segments,
  sources,
}: DailyActivityTableProps): React.ReactElement {
  const { can, isAdmin } = usePermissions();
  const deleteMutation = useDeleteDailyActivity();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [progressStatus, setProgressStatus] = useState<ProgressStatus | "">("");
  const [segmentId, setSegmentId] = useState("");
  const [salesId, setSalesId] = useState("");
  const [activityDateRange, setActivityDateRange] = useState<DateRange | undefined>(
    getDefaultMonthRange,
  );
  const [siteVisitRange, setSiteVisitRange] = useState<DateRange | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<DailyActivityItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<DailyActivityItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<DailyActivityItem | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, DEBOUNCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Filter setters below each also reset page to 1 (event handlers, not an
  // effect — avoids the cascading-render setState-in-effect lint rule).
  function handleProgressStatusChange(value: ProgressStatus | ""): void {
    setProgressStatus(value);
    setPage(1);
  }

  function handleSegmentIdChange(value: string): void {
    setSegmentId(value);
    setPage(1);
  }

  function handleSalesIdChange(value: string): void {
    setSalesId(value);
    setPage(1);
  }

  function handleActivityDateRangeChange(range: DateRange | undefined): void {
    setActivityDateRange(range);
    setPage(1);
  }

  function handleSiteVisitRangeChange(range: DateRange | undefined): void {
    setSiteVisitRange(range);
    setPage(1);
  }

  const params: FetchDailyActivitiesParams = {
    page,
    pageSize: ROWS_PER_PAGE,
    ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
    ...(progressStatus && { progressStatus }),
    ...(segmentId && { segmentId }),
    ...(salesId && { salesId }),
    ...(activityDateRange?.from && { activityDateFrom: toIsoDay(activityDateRange.from) }),
    ...(activityDateRange?.to && { activityDateTo: toIsoDay(activityDateRange.to) }),
    ...(siteVisitRange?.from && { siteVisitFrom: toIsoDay(siteVisitRange.from) }),
    ...(siteVisitRange?.to && { siteVisitTo: toIsoDay(siteVisitRange.to) }),
  };

  const isDefaultParams =
    page === 1 &&
    !debouncedSearch.trim() &&
    !progressStatus &&
    !segmentId &&
    !salesId &&
    isSameRange(activityDateRange, getDefaultMonthRange()) &&
    !siteVisitRange?.from;

  const query = useDailyActivities(params, isDefaultParams ? initialData : undefined);
  const rows = query.data?.data ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  const activeFilterCount =
    (isSameRange(activityDateRange, getDefaultMonthRange()) ? 0 : 1) +
    (siteVisitRange?.from ? 1 : 0) +
    (progressStatus ? 1 : 0) +
    (segmentId ? 1 : 0) +
    (salesId ? 1 : 0);

  function resetFilters(): void {
    setProgressStatus("");
    setSegmentId("");
    setSalesId("");
    setActivityDateRange(getDefaultMonthRange());
    setSiteVisitRange(undefined);
    setPage(1);
  }

  async function handleRefresh(): Promise<void> {
    const result = await query.refetch();
    if (result.isSuccess) {
      toast.success("Data diperbarui.");
    } else {
      toast.error("Gagal memuat ulang data.");
    }
  }

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      // Same active filters as the table listing — minus page/pageSize, since
      // export always pulls every row matching the current filter.
      const { page: _page, pageSize: _pageSize, ...exportFilter } = params;
      const exportParams = new URLSearchParams();
      for (const [key, value] of Object.entries(exportFilter)) {
        if (value) exportParams.set(key, String(value));
      }

      const res = await fetch(`/api/daily-activities/export?${exportParams.toString()}`);
      if (!res.ok) {
        const msg =
          res.status === 429
            ? "Terlalu banyak permintaan, coba lagi sebentar."
            : "Gagal mengekspor data daily activity.";
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `daily-activity-${toIsoDay(new Date())}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export berhasil diunduh.");
    } catch {
      toast.error("Gagal mengekspor data daily activity.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleOpenAdd(): void {
    setEditingItem(null);
    setDrawerOpen(true);
  }

  function handleOpenEdit(item: DailyActivityItem): void {
    setEditingItem(item);
    setDrawerOpen(true);
  }

  async function handleDelete(): Promise<void> {
    if (!deletingItem) return;
    const result = await deleteMutation.mutateAsync(deletingItem.id);
    if (!result.success) {
      toast.error(result.error ?? "Gagal menghapus daily activity.");
      setDeletingItem(null);
      return;
    }
    toast.success("Daily activity berhasil dihapus.");
    setDeletingItem(null);
  }

  if (query.isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-0">
          <div className={cn("flex", "items-center", "justify-between", "px-4", "sm:px-6", "py-4", "border-b")}>
            <div className={cn("flex", "items-center", "gap-2")}>
              <Skeleton className={cn("h-5", "w-32")} />
              <Skeleton className={cn("h-4", "w-8")} />
            </div>
            <Skeleton className={cn("h-9", "w-24", "rounded-xl")} />
          </div>
          <div className="px-4 sm:px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex", "items-center", "gap-4", "py-3", "border-b", "last:border-0")}>
                <Skeleton className={cn("h-4", "w-8")} />
                <Skeleton className={cn("h-4", "w-48")} />
                <Skeleton className={cn("h-4", "w-20")} />
                <div className="flex-1" />
                <div className={cn("flex", "gap-1")}>
                  <Skeleton className={cn("h-7", "w-7")} />
                  <Skeleton className={cn("h-7", "w-7")} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("flex", "flex-col", "sm:flex-row", "items-start", "sm:items-center", "justify-between", "px-4", "sm:px-6", "py-4", "gap-3", "border-b")}>
            <div className={cn("flex", "items-center", "gap-2")}>
              <h2 className={cn("text-base", "font-heading", "font-bold", "text-foreground")}>Daily Activity</h2>
              <span className={cn("text-sm", "text-muted-foreground")}>({query.data?.total ?? 0})</span>
            </div>
            <div className={cn("flex", "flex-wrap", "items-center", "gap-2")}>
              <div className="relative">
                <Magnifer weight="BoldDuotone" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari perusahaan / kontak / milestone..."
                  className="pl-8 h-9 w-56 rounded-xl"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-9", "w-9", "p-0", "cursor-pointer", "rounded-xl", "relative")}
                onClick={() => setFilterOpen(true)}
                aria-label="Filter"
              >
                <Filter weight="BoldDuotone" className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={query.isFetching}
                className={cn("h-9", "w-9", "p-0", "cursor-pointer", "rounded-xl")}
                aria-label="Refresh"
              >
                <Refresh weight="BoldDuotone" className={cn("w-4", "h-4", query.isFetching && "animate-spin")} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void handleExport(); }}
                disabled={isExporting}
                className={cn("h-9", "cursor-pointer", "rounded-xl", "gap-1.5")}
              >
                <Download weight="BoldDuotone" className="w-4 h-4" />
                {isExporting ? "Mengekspor..." : "Export"}
              </Button>
              {(can("daily-activity", "create") || isAdmin) && (
                <Button onClick={handleOpenAdd} className={cn("cursor-pointer", "rounded-xl")}>
                  <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-2")} /> Tambah Daily Activity
                </Button>
              )}
            </div>
          </div>

          {/* Mobile: card list (<sm) */}
          <div className="block sm:hidden px-3 py-2 space-y-2">
            {rows.length === 0 ? (
              <div className={cn("text-center", "py-8", "text-muted-foreground", "text-sm")}>Belum ada data.</div>
            ) : (
              rows.map((item) => (
                <Card key={item.id} className="rounded-xl border bg-card shadow-none">
                  <CardContent className="px-3 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{item.companyName ?? "—"}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <ProgressStatusBadge status={item.progressStatus} />
                        <button onClick={() => setDetailItem(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Detail">
                          <Eye weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                        </button>
                        {(can("daily-activity", "edit") || isAdmin) && (
                          <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                            <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                          </button>
                        )}
                        {(can("daily-activity", "delete") || isAdmin) && (
                          <button onClick={() => setDeletingItem(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                            <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(item.activityDate)} · {item.sales.fullName} · {item.segment.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.milestone}</p>
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
                  <TableHead className={cn("px-4", "sm:px-6")}>Tanggal</TableHead>
                  <TableHead>Perusahaan</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead className="w-28 text-right pr-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className={cn("text-center", "py-8", "text-muted-foreground")}>
                      Belum ada data.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className={cn("px-4", "sm:px-6", "whitespace-nowrap")}>
                        {formatShortDate(item.activityDate)}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium truncate max-w-48">{item.companyName ?? "—"}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{item.sales.fullName}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.segment.name}</TableCell>
                      <TableCell>
                        <ProgressStatusBadge status={item.progressStatus} />
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground line-clamp-1 max-w-56">{item.milestone}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{item.contactName ?? "—"}</TableCell>
                      <TableCell>
                        <div className={cn("flex", "items-center", "gap-1", "justify-end", "pr-2")}>
                          <button onClick={() => setDetailItem(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Detail">
                            <Eye weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                          </button>
                          {(can("daily-activity", "edit") || isAdmin) && (
                            <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                              <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                            </button>
                          )}
                          {(can("daily-activity", "delete") || isAdmin) && (
                            <button onClick={() => setDeletingItem(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                              <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
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

          {totalPages > 1 && (
            <PaginationBar
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              label="Navigasi halaman daily activity"
            />
          )}
        </CardContent>
      </Card>

      <DailyActivityDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingItem(null); }}
        editingItem={editingItem}
        salesProfiles={salesProfiles}
        segments={segments}
        sources={sources}
      />

      <DailyActivityFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activityDateRange={activityDateRange}
        onActivityDateRangeChange={handleActivityDateRangeChange}
        siteVisitRange={siteVisitRange}
        onSiteVisitRangeChange={handleSiteVisitRangeChange}
        progressStatus={progressStatus}
        onProgressStatusChange={handleProgressStatusChange}
        segmentId={segmentId}
        onSegmentIdChange={handleSegmentIdChange}
        salesId={salesId}
        onSalesIdChange={handleSalesIdChange}
        segments={segments}
        salesProfiles={salesProfiles}
        onReset={resetFilters}
      />

      <DailyActivityDetailModal
        item={detailItem}
        open={detailItem !== null}
        onOpenChange={(o) => { if (!o) setDetailItem(null); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => { if (!open) setDeletingItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Daily Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus aktivitas untuk <strong>{deletingItem?.companyName ?? "kontak ini"}</strong>? Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
