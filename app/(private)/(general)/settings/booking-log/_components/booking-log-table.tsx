"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import type { DateRange } from "react-day-picker";
import { Magnifer, CalendarDate, ClipboardList, Refresh, Filter } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { useQueryClient } from "@tanstack/react-query";
import { useBookingLogs } from "@/hooks/use-booking-log";
import type { BookingActivityLogItem, BookingActivityLogResult, BookingLogCategory } from "@/lib/queries/booking-log";

const CATEGORY_LABEL: Record<BookingLogCategory, string> = {
  WEDDINGS: "Wedding",
  MICE: "MICE",
};

const ACTION_LABEL: Record<string, string> = {
  created: "Dibuat",
  updated: "Diubah",
  deleted: "Dihapus",
  "booking.draft_created": "Draft Dibuat",
  "booking.draft_updated": "Draft Diubah",
  "booking.finalized": "Difinalisasi",
  "booking.signature_saved": "TTD Sales",
  "booking.set_harga": "Set Harga",
  "booking.update_package_prices": "Harga Diubah",
  "booking.update_tc": "S&K Diubah",
  "booking.revision_restored": "Revisi Dipulihkan",
  "booking.package_synced": "Paket Disinkron",
  "booking.reset_approval": "Approval Direset",
  "booking.vendor_updated": "Vendor Diubah",
  "booking.bonus_added": "Bonus Ditambah",
  "booking.bonus_updated": "Bonus Diubah",
  "booking.bonus_deleted": "Bonus Dihapus",
  "booking.complimentary_added": "Complimentary Ditambah",
  "booking.complimentary_updated": "Complimentary Diubah",
  "booking.complimentary_deleted": "Complimentary Dihapus",
  "booking.comment_edited": "Komentar Diubah",
  "booking.comment_deleted": "Komentar Dihapus",
  "approval.approved": "Disetujui",
  "approval.rejected": "Ditolak",
  "client_agreement.sent": "Link Dikirim",
  "client_agreement.regenerated": "Link Diperbarui",
  "client_agreement.viewed": "Dilihat Client",
  "client_signed": "Client TTD",
};

const POSITIVE_ACTIONS = new Set([
  "created", "booking.finalized", "booking.signature_saved", "booking.bonus_added",
  "booking.complimentary_added", "approval.approved", "client_signed",
]);
const DESTRUCTIVE_ACTIONS = new Set([
  "deleted", "booking.bonus_deleted", "booking.complimentary_deleted",
  "booking.comment_deleted", "approval.rejected", "booking.reset_approval",
]);

function actionBadgeClass(action: string): string {
  if (POSITIVE_ACTIONS.has(action)) return "bg-primary/10 text-primary";
  if (DESTRUCTIVE_ACTIONS.has(action)) return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bookingHref(log: BookingActivityLogItem): string | null {
  if (log.category === "WEDDINGS") return `/booking/booking-weddings/${log.bookingId}`;
  return null;
}

const CATEGORY_OPTIONS = [
  { id: "all", name: "Semua Kategori" },
  { id: "WEDDINGS", name: "Wedding" },
  { id: "MICE", name: "MICE" },
];

function FilterPanelContent({
  category,
  onCategoryChange,
  dateFrom,
  dateTo,
  onDateRangeChange,
  dateRangeOpen,
  onDateRangeOpenChange,
  hasActive,
  onReset,
}: {
  category: BookingLogCategory | "";
  onCategoryChange: (value: BookingLogCategory | "") => void;
  dateFrom: string;
  dateTo: string;
  onDateRangeChange: (range: DateRange | undefined) => void;
  dateRangeOpen: boolean;
  onDateRangeOpenChange: (open: boolean) => void;
  hasActive: boolean;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filter</p>
        {hasActive && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Kategori</label>
        <SearchableSelect
          options={CATEGORY_OPTIONS}
          value={category || "all"}
          onChange={(val) => onCategoryChange(val === "all" ? "" : (val as BookingLogCategory))}
          placeholder="Semua Kategori"
          searchPlaceholder="Cari kategori..."
          emptyText="Kategori tidak ditemukan"
          className="h-9"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Rentang Tanggal</label>
        <Popover open={dateRangeOpen} onOpenChange={onDateRangeOpenChange}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 h-9 px-3 text-xs rounded-md border border-input bg-background text-left w-full",
                  "hover:bg-accent transition-colors",
                  dateFrom && dateTo ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <CalendarDate weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {dateFrom && dateTo
                    ? `${format(new Date(dateFrom), "dd MMM yyyy")} — ${format(new Date(dateTo), "dd MMM yyyy")}`
                    : "Pilih rentang tanggal"}
                </span>
              </button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={dateFrom ? { from: new Date(dateFrom), to: dateTo ? new Date(dateTo) : undefined } : undefined}
              onSelect={onDateRangeChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export function BookingLogTable({ initialData, pageSize }: { initialData: BookingActivityLogResult; pageSize: number }) {
  const qc = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<BookingLogCategory | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: result = initialData, isFetching, isLoading, isPlaceholderData } = useBookingLogs(
    { page: currentPage, pageSize, search: debouncedSearch || undefined, category: category || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    initialData,
  );

  const logs = result.data;
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
  const isTableLoading = isLoading || isPlaceholderData || isFetching;
  const hasDateFilter = dateFrom !== "" || dateTo !== "";
  const activeFilterCount = (category !== "" ? 1 : 0) + (hasDateFilter ? 1 : 0);
  const hasActiveFilter = activeFilterCount > 0;

  async function handleRefresh() {
    setIsRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["booking-logs"] });
    setIsRefreshing(false);
  }

  function handleCategoryChange(value: BookingLogCategory | "") {
    setCategory(value);
    setCurrentPage(1);
  }

  function handleDateRangeSelect(range: DateRange | undefined) {
    if (range?.from) {
      setDateFrom(startOfDay(range.from).toISOString());
      setDateTo(endOfDay(range.to ?? range.from).toISOString());
    } else {
      setDateFrom("");
      setDateTo("");
    }
    setCurrentPage(1);
  }

  function handleResetFilters() {
    setCategory("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-0">
        {/* Header + Filters */}
        <div className={cn("flex", "flex-col", "gap-3", "px-4", "sm:px-6", "py-4", "border-b")}>
          <div className={cn("flex", "items-center", "gap-3", "flex-wrap")}>
            <h2 className={cn("text-base", "font-bold", "text-foreground")}>Booking Activity Log</h2>
            <span className={cn("text-xs", "font-medium", "bg-muted", "text-muted-foreground", "px-3", "py-1", "border", "rounded-full")}>
              {result.total} log
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              className="h-8 px-2"
              title="Refresh data"
              onClick={handleRefresh}
            >
              <Refresh weight="BoldDuotone" className={cn("h-3.5 w-3.5 text-muted-foreground", isRefreshing && "animate-spin")} />
            </Button>
          </div>

          <div className={cn("flex", "items-center", "gap-2")}>
            <div className="relative flex-1 sm:max-w-70">
              <Magnifer weight="BoldDuotone" className={cn("absolute", "left-3", "top-1/2", "-translate-y-1/2", "h-4", "w-4", "text-muted-foreground")} />
              <Input
                placeholder="Cari booking, customer, atau user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("h-9 gap-1.5 shrink-0", hasActiveFilter && "border-primary/50")}
                    aria-label="Filter booking log"
                  >
                    <Filter weight="BoldDuotone" className="h-4 w-4" />
                    <span className="hidden sm:inline">Filter</span>
                    {hasActiveFilter && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-72 p-3">
                <FilterPanelContent
                  category={category}
                  onCategoryChange={handleCategoryChange}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateRangeChange={handleDateRangeSelect}
                  dateRangeOpen={dateRangeOpen}
                  onDateRangeOpenChange={setDateRangeOpen}
                  hasActive={hasActiveFilter}
                  onReset={handleResetFilters}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Table */}
        {isTableLoading && logs.length === 0 ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className={cn("flex", "flex-col", "items-center", "justify-center", "py-16", "text-muted-foreground")}>
            <ClipboardList weight="BoldDuotone" className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Belum ada activity log booking.</p>
          </div>
        ) : (
          <>
            {/* Table — desktop (sm+) */}
            <div className={cn("hidden", "sm:block", "overflow-x-auto")}>
              <Table className="min-w-225 text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="px-3 whitespace-nowrap">Waktu</TableHead>
                    <TableHead className="px-3">Kategori</TableHead>
                    <TableHead className="px-3">Booking</TableHead>
                    <TableHead className="px-3">Aksi</TableHead>
                    <TableHead className="px-3">User</TableHead>
                    <TableHead className="px-3">Deskripsi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const href = bookingHref(log);
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="px-3 whitespace-nowrap text-muted-foreground">
                          {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
                        </TableCell>
                        <TableCell className="px-3">
                          {log.category ? (
                            <Badge variant="outline" className="text-xs">{CATEGORY_LABEL[log.category]}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className={cn("px-3", "max-w-50")}>
                          {href ? (
                            <Link href={href} className="font-medium text-foreground hover:underline truncate block">
                              {log.bookingCode ?? log.bookingId}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground truncate block">{log.bookingCode ?? log.bookingId}</span>
                          )}
                          {log.customerName && (
                            <span className="text-xs text-muted-foreground truncate block">{log.customerName}</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", actionBadgeClass(log.action))}>
                            {actionLabel(log.action)}
                          </span>
                        </TableCell>
                        <TableCell className="px-3">
                          <span className="text-foreground">{log.userName ?? "System"}</span>
                          {log.userRole && <span className="ml-1 text-xs text-muted-foreground">({log.userRole})</span>}
                        </TableCell>
                        <TableCell className={cn("px-3", "max-w-75", "truncate", "text-muted-foreground")} title={log.description ?? ""}>
                          {log.description || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile (<sm): card list */}
            <div className={cn("block", "sm:hidden", "p-4", "space-y-3")}>
              {logs.map((log) => {
                const href = bookingHref(log);
                return (
                  <div key={log.id} className={cn("rounded-lg", "border", "bg-card", "p-3", "space-y-2")}>
                    {/* Row 1: waktu + kategori */}
                    <div className={cn("flex", "items-center", "justify-between", "gap-2")}>
                      <span className={cn("text-xs", "text-muted-foreground")}>
                        {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
                      </span>
                      {log.category && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{CATEGORY_LABEL[log.category]}</Badge>
                      )}
                    </div>

                    {/* Row 2: booking + customer */}
                    <div className="min-w-0">
                      {href ? (
                        <Link href={href} className={cn("font-medium", "text-sm", "text-foreground", "hover:underline", "truncate", "block")}>
                          {log.bookingCode ?? log.bookingId}
                        </Link>
                      ) : (
                        <span className={cn("font-medium", "text-sm", "text-foreground", "truncate", "block")}>
                          {log.bookingCode ?? log.bookingId}
                        </span>
                      )}
                      {log.customerName && (
                        <span className={cn("text-xs", "text-muted-foreground", "truncate", "block")}>{log.customerName}</span>
                      )}
                    </div>

                    {/* Row 3: aksi + user */}
                    <div className={cn("flex", "items-center", "justify-between", "gap-2", "flex-wrap")}>
                      <span className={cn("text-[11px]", "font-medium", "px-2", "py-0.5", "rounded-full", actionBadgeClass(log.action))}>
                        {actionLabel(log.action)}
                      </span>
                      <span className={cn("text-xs", "text-muted-foreground", "truncate")}>
                        {log.userName ?? "System"}
                        {log.userRole && ` (${log.userRole})`}
                      </span>
                    </div>

                    {/* Deskripsi */}
                    {log.description && (
                      <p className={cn("text-xs", "text-muted-foreground", "line-clamp-2", "pt-1", "border-t", "border-border")}>
                        {log.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            label="Navigasi halaman booking activity log"
          />
        )}
      </CardContent>
    </Card>
  );
}
