"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  AddCircle,
  UsersGroupRounded,
  CheckCircle,
  CalendarMinimalistic,
  Download,
  Eye,
  Filter,
  Magnifer,
  Pen,
  Refresh,
  TrashBinTrash,
  UserCircle,
} from "@solar-icons/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useGuestbookEntries, useCheckOutGuestbookEntry, useDeleteGuestbookEntry } from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";
import type { GuestbookEntryItem } from "@/lib/queries/guestbookEntries";
import { GuestbookDrawer } from "./GuestbookDrawer";
import { GuestbookDetailDrawer } from "./GuestbookDetailDrawer";
import { resolveGuestbookPhotoUrl } from "./photo-url";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  deal: { label: "Deal", className: "bg-green-100 text-green-700 border-0" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-0" },
  pending: { label: "Pending", className: "bg-gray-100 text-gray-700 border-0" },
  to_be_discuss: { label: "To Be Discuss", className: "bg-yellow-100 text-yellow-700 border-0" },
  lost: { label: "Lost", className: "bg-red-100 text-red-700 border-0" },
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  WEDDINGS: "Wedding",
  MICE: "MICE",
};

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function todayRange(): DateRange {
  const today = new Date();
  return { from: today, to: today };
}

function formatDateRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Semua Tanggal";
  const today = new Date();
  if (isSameDay(range.from, today) && (!range.to || isSameDay(range.to, today))) {
    return "Hari Ini";
  }
  if (range.to && !isSameDay(range.from, range.to)) {
    return `${format(range.from, "dd MMM yyyy", { locale: idLocale })} — ${format(range.to, "dd MMM yyyy", { locale: idLocale })}`;
  }
  return format(range.from, "dd MMM yyyy", { locale: idLocale });
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-20 rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function MobileCard({
  entry,
  onCompleteClick,
  onViewClick,
  onEditClick,
  isCheckingOut,
}: {
  entry: GuestbookEntryItem;
  onCompleteClick: (entry: GuestbookEntryItem) => void;
  onViewClick: (entry: GuestbookEntryItem) => void;
  onEditClick: (entry: GuestbookEntryItem) => void;
  isCheckingOut: boolean;
}) {
  const sourceLabel = entry.sourceOfInformation?.name ?? null;
  const statusInfo = entry.visitStatus ? STATUS_LABELS[entry.visitStatus] : null;
  const photoSrc = resolveGuestbookPhotoUrl(entry.visitorPhoto);

  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer"
      onClick={() => onViewClick(entry)}
    >
      {/* Row 1: avatar + name + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {photoSrc ? (
            <Image src={photoSrc} alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover shrink-0" unoptimized />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-muted shrink-0 flex items-center justify-center">
              <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{entry.visitorName}</p>
            {entry.guestCode && (
              <p className="text-[10px] font-mono text-muted-foreground/70">{entry.guestCode}</p>
            )}
          </div>
        </div>
        {statusInfo ? (
          <Badge className={`rounded-full text-[10px] shrink-0 ${statusInfo.className}`}>
            {statusInfo.label}
          </Badge>
        ) : (
          <Badge variant="secondary" className="rounded-full text-[10px] shrink-0">
            —
          </Badge>
        )}
      </div>

      {/* Row 2: venue + package + sumber */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
        <span className="truncate">{entry.venue?.name ?? "Venue —"}</span>
        {entry.package?.packageName && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-foreground/70 truncate">{entry.package.packageName}</span>
          </>
        )}
        {sourceLabel && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{sourceLabel}</span>
          </>
        )}
      </div>

      {/* Row 3: bertemu + dicatat oleh */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <UserCircle weight="BoldDuotone" className="h-3 w-3 shrink-0" />
        <span className="truncate">
          Bertemu {entry.host?.fullName ?? "-"}
          {entry.createdBy?.fullName && ` · Dicatat ${entry.createdBy.fullName}`}
        </span>
      </div>

      {/* Row 4: check-in / check-out */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
          <span className="text-muted-foreground/60">in</span>
          <span className="text-foreground">{formatDate(entry.checkInAt)} {formatTime(entry.checkInAt)}</span>
        </span>
        {entry.checkOutAt && (
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground/60">out</span>
            <span className="text-foreground">{formatDate(entry.checkOutAt)} {formatTime(entry.checkOutAt)}</span>
          </span>
        )}
      </div>

      {/* Footer: action tile bar */}
      <div
        className="flex items-center justify-center gap-1 pt-1 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {entry.checkOutAt === null && (
          <button
            type="button"
            className="flex flex-col items-center justify-center gap-0.5 w-14 rounded-xl py-1.5 px-1 cursor-pointer transition-colors hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
            onClick={() => onCompleteClick(entry)}
            disabled={isCheckingOut}
          >
            <CheckCircle weight="BoldDuotone" className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground leading-none">Selesai</span>
          </button>
        )}
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 w-14 rounded-xl py-1.5 px-1 cursor-pointer transition-colors hover:bg-accent"
          onClick={() => onViewClick(entry)}
        >
          <Eye weight="BoldDuotone" className="h-5 w-5 text-primary" />
          <span className="text-[10px] font-medium text-muted-foreground leading-none">Detail</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 w-14 rounded-xl py-1.5 px-1 cursor-pointer transition-colors hover:bg-accent"
          onClick={() => onEditClick(entry)}
        >
          <Pen weight="BoldDuotone" className="h-5 w-5 text-primary" />
          <span className="text-[10px] font-medium text-muted-foreground leading-none">Edit</span>
        </button>
      </div>
    </div>
  );
}

export function GuestbookClient() {
  return (
    <Suspense>
      <GuestbookClientInner />
    </Suspense>
  );
}

function GuestbookClientInner() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GuestbookEntryItem | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<GuestbookEntryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GuestbookEntryItem | null>(null);
  const [confirmEdit, setConfirmEdit] = useState<GuestbookEntryItem | null>(null);
  const [editEntry, setEditEntry] = useState<GuestbookEntryItem | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [filterVenueId, setFilterVenueId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoOpenHandled = useRef(false);

  useEffect(() => {
    if (autoOpenHandled.current) return;
    if (searchParams.get("create") !== "1") return;
    autoOpenHandled.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-open from URL query, intentional
    setDrawerOpen(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const queryClient = useQueryClient();
  const { data: guestbookData, isLoading } = useGuestbookEntries();
  const entries = guestbookData?.data ?? [];
  const { data: venues = [] } = useVenues();
  const checkOutMutation = useCheckOutGuestbookEntry();
  const deleteMutation = useDeleteGuestbookEntry();

  function handleCompleteClick(entry: GuestbookEntryItem) {
    setConfirmComplete(entry);
  }

  function handleEditClick(entry: GuestbookEntryItem) {
    setConfirmEdit(entry);
  }

  function handleConfirmEdit() {
    if (!confirmEdit) return;
    setEditEntry(confirmEdit);
    setConfirmEdit(null);
  }

  async function handleConfirmComplete() {
    if (!confirmComplete) return;
    const result = await checkOutMutation.mutateAsync(confirmComplete.id);
    if (result.success) {
      toast.success("Check-out berhasil");
    } else {
      toast.error(result.error ?? "Gagal check-out");
    }
    setConfirmComplete(null);
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const result = await deleteMutation.mutateAsync(confirmDelete.id);
    if (result.success) {
      toast.success("Data berhasil dihapus");
    } else {
      toast.error(result.error ?? "Gagal menghapus data");
    }
    setConfirmDelete(null);
  }

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) params.set("to", format(dateRange.to, "yyyy-MM-dd"));

      const res = await fetch(`/api/guestbook/export?${params.toString()}`);
      if (!res.ok) {
        const msg =
          res.status === 429
            ? "Terlalu banyak permintaan, coba lagi sebentar."
            : "Gagal mengekspor data guestbook.";
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Guestbook_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export berhasil diunduh.");
    } catch {
      toast.error("Gagal mengekspor data guestbook.");
    } finally {
      setIsExporting(false);
    }
  }

  const filteredEntries = entries.filter((e) => {
    const d = new Date(e.checkInAt);
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    if (filterVenueId !== "all" && e.venueId !== filterVenueId) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [e.visitorName, e.guestCode, e.host?.fullName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilter =
    Boolean(dateRange?.from) || filterVenueId !== "all" || search.trim() !== "";
  const activeFilterCount =
    (dateRange?.from ? 1 : 0) +
    (filterVenueId !== "all" ? 1 : 0) +
    (search.trim() !== "" ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Table — desktop */}
      <Card className="rounded-2xl shadow-sm hidden sm:block py-0">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Riwayat Kunjungan</h2>
              <span className="text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                {filteredEntries.length} tamu
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Magnifer
                  weight="BoldDuotone"
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama tamu..."
                  className="rounded-full text-xs h-8 pl-8 w-52"
                />
              </div>

              <Popover>
                <PopoverTrigger render={
                  <button
                    type="button"
                    className="flex items-center gap-2 h-8 px-3 text-xs rounded-full border border-input bg-background hover:bg-accent transition-colors text-left"
                  >
                    <CalendarMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className={dateRange?.from ? "text-foreground" : "text-muted-foreground"}>
                      {formatDateRangeLabel(dateRange)}
                    </span>
                  </button>
                } />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={dateRange}
                    onSelect={setDateRange}
                    locale={idLocale}
                  />
                </PopoverContent>
              </Popover>

              {dateRange?.from && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs h-8 text-muted-foreground"
                  onClick={() => setDateRange(undefined)}
                >
                  Reset
                </Button>
              )}

              <Select value={filterVenueId} onValueChange={setFilterVenueId}>
                <SelectTrigger className="rounded-full text-xs h-8 w-44">
                  <SelectValue placeholder="Semua Venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 gap-1.5"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["guestbook-entries"] })}
              >
                <Refresh weight="BoldDuotone" className="h-3.5 w-3.5" />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 gap-1.5"
                onClick={() => { void handleExport(); }}
                disabled={isExporting}
              >
                <Download weight="BoldDuotone" className="h-3.5 w-3.5" />
                {isExporting ? "Mengekspor..." : "Export"}
              </Button>

              <Button
                size="sm"
                className="rounded-full text-xs h-8 gap-1.5"
                onClick={() => setDrawerOpen(true)}
              >
                <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                Tambah Tamu
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Tamu</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Bertemu</TableHead>
                  <TableHead>In / Out</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dicatat oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows />
              </TableBody>
            </Table>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <UsersGroupRounded weight="BoldDuotone" className="h-10 w-10 opacity-30" />
              <p className="text-sm">Belum ada data kunjungan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Tamu</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Bertemu</TableHead>
                    <TableHead>In / Out</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dicatat oleh</TableHead>
                    <TableHead className="text-right pr-4">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const sourceLabel = entry.sourceOfInformation?.name ?? null;
                    const statusInfo = entry.visitStatus ? STATUS_LABELS[entry.visitStatus] : null;

                    return (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {(() => {
                              const photoSrc = resolveGuestbookPhotoUrl(entry.visitorPhoto);
                              if (photoSrc) {
                                return <Image src={photoSrc} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover shrink-0" unoptimized />;
                              }
                              return null;
                            })()}
                            <div className="leading-tight">
                              <p className="font-medium text-foreground">{entry.visitorName}</p>
                              {entry.guestCode && (
                                <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                                  {entry.guestCode}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {entry.package?.category ? (
                            EVENT_CATEGORY_LABELS[entry.package.category] ?? entry.package.category
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span>{entry.venue?.name ?? "-"}</span>
                            {entry.package?.packageName && (
                              <Badge variant="secondary" className="rounded-full text-[10px] font-normal">
                                {entry.package.packageName}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.host?.fullName ?? "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-baseline gap-1.5">
                              <span className="w-6 shrink-0 text-[10px] font-medium text-muted-foreground/60">in</span>
                              <span>
                                {formatDate(entry.checkInAt)}{" "}
                                <span className="text-foreground font-medium">
                                  {formatTime(entry.checkInAt)}
                                </span>
                              </span>
                            </span>
                            <span className="flex items-baseline gap-1.5">
                              <span className="w-6 shrink-0 text-[10px] font-medium text-muted-foreground/60">out</span>
                              {entry.checkOutAt ? (
                                <span>
                                  {formatDate(entry.checkOutAt)}{" "}
                                  <span className="text-foreground font-medium">
                                    {formatTime(entry.checkOutAt)}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {sourceLabel ?? <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell>
                          {statusInfo ? (
                            <Badge className={`rounded-full text-xs ${statusInfo.className}`}>
                              {statusInfo.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {entry.createdBy?.fullName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {entry.checkOutAt === null && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-green-600 hover:bg-green-50"
                                onClick={() => handleCompleteClick(entry)}
                                disabled={checkOutMutation.isPending}
                              >
                                <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => setSelectedEntry(entry)}
                            >
                              <Eye weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleEditClick(entry)}
                            >
                              <Pen weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(entry)}
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Mobile toolbar: count · filter popover · export · refresh · add */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
            {filteredEntries.length} tamu
          </span>
          <div className="flex-1" />

          <Popover>
            <PopoverTrigger render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("shrink-0 relative", hasActiveFilter && "border-primary/50")}
                aria-label="Filter guestbook"
              >
                <Filter weight="BoldDuotone" className="h-4 w-4" />
                {hasActiveFilter && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            } />
            <PopoverContent align="end" className="w-[19rem] max-w-[calc(100vw-2rem)] p-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cari</label>
                <div className="relative">
                  <Magnifer
                    weight="BoldDuotone"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nama tamu / kode / host"
                    className="rounded-full text-xs h-9 pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tanggal</label>
                <div className="flex justify-center rounded-lg border">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    locale={idLocale}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Venue</label>
                <Select value={filterVenueId} onValueChange={setFilterVenueId}>
                  <SelectTrigger className="rounded-full text-xs h-9 w-full">
                    <SelectValue placeholder="Semua Venue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Venue</SelectItem>
                    {venues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full rounded-full text-xs text-muted-foreground"
                  onClick={() => {
                    setDateRange(undefined);
                    setFilterVenueId("all");
                    setSearch("");
                  }}
                >
                  Reset Filter
                </Button>
              )}
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => { void handleExport(); }}
            disabled={isExporting}
            aria-label="Export guestbook"
          >
            <Download weight="BoldDuotone" className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["guestbook-entries"] })}
            aria-label="Refresh data guestbook"
          >
            <Refresh weight="BoldDuotone" className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="icon"
            className="shrink-0"
            onClick={() => setDrawerOpen(true)}
            aria-label="Tambah Tamu"
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-40" />
                <div className="flex items-center justify-center gap-1 pt-1 border-t border-border">
                  <Skeleton className="h-11 w-14 rounded-xl" />
                  <Skeleton className="h-11 w-14 rounded-xl" />
                  <Skeleton className="h-11 w-14 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && filteredEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <UsersGroupRounded weight="BoldDuotone" className="h-10 w-10 opacity-30" />
            <p className="text-sm">Belum ada data kunjungan</p>
          </div>
        )}
        {!isLoading &&
          filteredEntries.map((entry) => (
            <MobileCard
              key={entry.id}
              entry={entry}
              onCompleteClick={handleCompleteClick}
              onViewClick={setSelectedEntry}
              onEditClick={handleEditClick}
              isCheckingOut={checkOutMutation.isPending}
            />
          ))}
      </div>

      <GuestbookDrawer
        isOpen={drawerOpen || editEntry !== null}
        onClose={() => {
          setDrawerOpen(false);
          setEditEntry(null);
        }}
        editEntry={editEntry}
      />

      <GuestbookDetailDrawer
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEntry(null);
          }
        }}
        entry={selectedEntry}
        allEntries={entries}
      />

      {/* Complete confirmation */}
      <AlertDialog
        open={confirmComplete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmComplete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Check-out</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai &quot;{confirmComplete?.visitorName}&quot; sudah selesai kunjungan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={handleConfirmComplete}>
              Ya, Check-out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus data &quot;{confirmDelete?.visitorName}&quot;? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit confirmation */}
      <AlertDialog
        open={confirmEdit !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmEdit(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit data tamu?</AlertDialogTitle>
            <AlertDialogDescription>
              Kamu akan mengubah data kunjungan tamu ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction className="rounded-full" onClick={handleConfirmEdit}>
              Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
