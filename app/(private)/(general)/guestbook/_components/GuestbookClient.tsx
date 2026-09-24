"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AddCircle,
  UsersGroupRounded,
  CalendarMinimalistic,
  Download,
  Eye,
  Filter,
  Logout,
  Magnifer,
  Pen,
  QrCode,
  Refresh,
  Repeat,
  TrashBinTrash,
  UserCircle,
  ChartSquare,
  Buildings2,
  VolumeLoud,
  Leaf,
  Link as LinkIcon,
} from "@solar-icons/react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn, formatRupiah } from "@/lib/utils";
import { computeFullPrice } from "@/lib/package-prices";
import {
  useGuestbookEntries,
  useDeleteGuestbookEntry,
  useCheckOutGuestbookEntry,
  useDeleteBulkGuestbookEntries,
  useBulkCheckOutGuestbookEntries,
} from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";
import { useSalesUsers } from "@/hooks/use-sales-users";
import type {
  GuestbookEntryItem,
  GuestbookCategoryFilter,
  GuestbookOverview,
  GuestbookOverviewBucket,
} from "@/lib/queries/guestbookEntries";
import type { GuestInteractionType, GuestVisitStatus } from "@prisma/client";
import type { ProofFiles } from "@/lib/validations/guestbook";
import { GuestbookDrawer } from "./GuestbookDrawer";
import { GuestbookDetailDrawer } from "./GuestbookDetailDrawer";
import { GuestbookFilterDrawer } from "./GuestbookFilterDrawer";
import { resolveGuestbookProofThumb } from "./photo-url";
import { PaginationBar } from "@/components/shared/pagination-bar";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  cold: { label: "Cold", className: "bg-sky-100 text-sky-700 border-0" },
  warm: { label: "Warm", className: "bg-amber-100 text-amber-700 border-0" },
  hot: { label: "Hot", className: "bg-orange-100 text-orange-700 border-0" },
  done_visit: { label: "Done Visit", className: "bg-emerald-100 text-emerald-700 border-0" },
  to_be_discuss: { label: "To Be Discuss", className: "bg-yellow-100 text-yellow-700 border-0" },
  deal: { label: "Deal", className: "bg-green-100 text-green-700 border-0" },
  lost: { label: "Lost", className: "bg-red-100 text-red-700 border-0" },
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  WEDDINGS: "Wedding",
  MICE: "MICE",
};

const CHECKOUT_STATUS_OPTIONS: { value: "deal" | "to_be_discuss" | "lost"; label: string }[] = [
  { value: "deal", label: "Deal" },
  { value: "to_be_discuss", label: "To Be Discuss" },
  { value: "lost", label: "Lost" },
];

// checkInAt/checkOutAt are stored as naive local wall-clock values anchored to UTC on the
// server — display must read them back with timeZone: "UTC" to avoid double-converting.
function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function todayRange(): DateRange {
  const today = new Date();
  return { from: today, to: today };
}

function getPackagePrice(pkg: NonNullable<GuestbookEntryItem["package"]>): number {
  if (pkg.sellingPrice > 0) return pkg.sellingPrice;
  const base = (pkg.categoryPrices ?? []).reduce((sum, c) => sum + c.basePrice, 0);
  return computeFullPrice([{ basePrice: base }], pkg.margin ?? 0);
}

// Shorten an ad URL for display (drop protocol + trailing slash).
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// Lightweight per-page visit-count indicator — mirrors the matching logic in
// GuestbookDetailDrawer (same name + same phone number = same contact), but
// only against the current page's entries (not the full history).
function countVisitsOnPage(entry: GuestbookEntryItem, pageEntries: GuestbookEntryItem[]): number {
  const matching = pageEntries.filter(
    (e) =>
      e.id !== entry.id &&
      e.visitorName.toLowerCase() === entry.visitorName.toLowerCase() &&
      e.phoneNumber != null &&
      entry.phoneNumber != null &&
      e.phoneNumber === entry.phoneNumber
  );
  return matching.length + 1;
}

// Progress-bar row used by the "Sumber Iklan" card — label + count + percentage.
function AdsSourceBarRow({
  label,
  count,
  total,
}: {
  label: React.ReactNode;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {count.toLocaleString("id-ID")}
          <span className="ml-1 text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Dedicated card for the ad-source breakdown — needs clickable URLs + an
// "Organik" fallback row, which the generic `lists` item renderer below
// doesn't support.
function GuestbookAdsSourceCard({
  buckets,
  organik,
  total,
}: {
  buckets: GuestbookOverviewBucket[];
  organik: number;
  total: number;
}) {
  const isEmpty = buckets.length === 0 && organik === 0;
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <VolumeLoud weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Sumber Iklan</p>
        </div>
        {isEmpty ? (
          <p className="text-xs text-muted-foreground">Tidak ada data.</p>
        ) : (
          <div className="space-y-3">
            {buckets.map((b) => (
              <AdsSourceBarRow
                key={b.key}
                total={total}
                count={b.count}
                label={
                  <a
                    href={b.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <LinkIcon weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{shortUrl(b.label)}</span>
                  </a>
                }
              />
            ))}
            {organik > 0 && (
              <AdsSourceBarRow
                key="__organik__"
                total={total}
                count={organik}
                label={
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Leaf weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                    Organik (tanpa iklan)
                  </span>
                }
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GuestbookOverview({
  overview,
  activeStatus,
  onStatusClick,
  activeCategory,
  onCategoryClick,
  activeSourceId,
  onSourceClick,
  activeVenueId,
  onVenueClick,
  activeHostId,
  onHostClick,
}: {
  overview: GuestbookOverview;
  activeStatus: string | undefined;
  onStatusClick: (key: string) => void;
  activeCategory: string | undefined;
  onCategoryClick: (key: string) => void;
  activeSourceId: string | undefined;
  onSourceClick: (key: string) => void;
  activeVenueId: string | undefined;
  onVenueClick: (key: string) => void;
  activeHostId: string | undefined;
  onHostClick: (key: string) => void;
}) {
  const metrics = [
    { label: "Rencana Kunjungan", value: overview.total, icon: UsersGroupRounded },
    { label: "Sedang Berlangsung", value: overview.activeVisits, icon: ChartSquare },
    { label: "Sudah Checkout", value: overview.checkedOut, icon: Buildings2 },
    { label: "Online Meeting", value: overview.onlineMeetings, icon: ChartSquare },
    { label: "Kunjungan Fisik", value: overview.inPersonVisits, icon: UsersGroupRounded },
  ];

  const lists: {
    title: string;
    items: GuestbookOverviewBucket[];
    activeKey: string | undefined;
    onItemClick: (key: string) => void;
  }[] = [
    { title: "Status", items: overview.byStatus, activeKey: activeStatus, onItemClick: onStatusClick },
    { title: "Kategori Event", items: overview.byCategory, activeKey: activeCategory, onItemClick: onCategoryClick },
    { title: "Sumber Data", items: overview.bySource, activeKey: activeSourceId, onItemClick: onSourceClick },
    { title: "Venue Teratas", items: overview.byVenue, activeKey: activeVenueId, onItemClick: onVenueClick },
    { title: "PIC Teratas", items: overview.byHost, activeKey: activeHostId, onItemClick: onHostClick },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {metrics.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lists.map(({ title, items, activeKey, onItemClick }) => (
          <Card key={title} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada data</p>
              ) : (
                <div className="space-y-1">
                  {items.slice(0, 5).map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                      <div
                        key={item.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => onItemClick(item.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onItemClick(item.key);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 text-xs transition-colors hover:bg-accent",
                          isActive && "bg-accent ring-1 ring-ring"
                        )}
                      >
                        <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
                        <Badge variant="secondary" className="shrink-0 rounded-full">{item.count}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <GuestbookAdsSourceCard
        buckets={overview.adsUrlBuckets}
        organik={overview.adsUrlOrganik}
        total={overview.total}
      />
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-20 rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function MobileCard({
  entry,
  totalVisit,
  onViewClick,
  onEditClick,
  onDeleteClick,
  onStatusClick,
  onCheckoutSelect,
}: {
  entry: GuestbookEntryItem;
  totalVisit: number;
  onViewClick: (entry: GuestbookEntryItem) => void;
  onEditClick: (entry: GuestbookEntryItem) => void;
  onDeleteClick: (entry: GuestbookEntryItem) => void;
  onStatusClick?: (status: string) => void;
  onCheckoutSelect: (entry: GuestbookEntryItem, visitStatus: "deal" | "to_be_discuss" | "lost") => void;
}) {
  const sourceLabel = entry.sourceOfInformation?.name ?? null;
  const statusInfo = entry.visitStatus ? STATUS_LABELS[entry.visitStatus] : null;
  const photoSrc = resolveGuestbookProofThumb((entry.proofFiles ?? null) as ProofFiles | null);

  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer"
      onClick={() => onViewClick(entry)}
    >
      {/* Row 1: avatar + name + status badge */}
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {photoSrc ? (
            <Image src={photoSrc} alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover shrink-0" unoptimized />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-muted shrink-0 flex items-center justify-center">
              <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-medium text-foreground text-sm truncate">
              {entry.visitorName}
              {totalVisit > 1 && (
                <span className="inline-flex items-center gap-0.5 shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  <Repeat weight="BoldDuotone" className="h-2.5 w-2.5" />
                  {totalVisit}x
                </span>
              )}
            </p>
            {statusInfo && (
              <Badge
                className={cn(
                  "rounded-full text-[10px] mt-0.5 cursor-pointer transition-opacity hover:opacity-80",
                  statusInfo.className
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusClick?.(entry.visitStatus as string);
                }}
              >
                {statusInfo.label}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: venue + package + sumber */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
        <span className="truncate">{entry.venue?.name ?? "Venue —"}</span>
        {entry.package?.packageName && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-foreground/70 truncate">
              {entry.package.packageName} ({entry.package.pax} pax, {formatRupiah(getPackagePrice(entry.package))})
            </span>
          </>
        )}
        {sourceLabel && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{sourceLabel}</span>
          </>
        )}
        {entry.segment?.name && (
          <Badge variant="secondary" className="rounded-full text-[10px] font-normal max-w-full truncate">
            {entry.segment.name}
          </Badge>
        )}
      </div>

      {/* Row 3: bertemu + dicatat oleh */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <UserCircle weight="BoldDuotone" className="h-3 w-3 shrink-0" />
        <span className="truncate">
          PIC {entry.host?.fullName ?? "-"}
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
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 w-14 rounded-xl py-1.5 px-1 cursor-pointer transition-colors hover:bg-destructive/10"
          onClick={() => onDeleteClick(entry)}
        >
          <TrashBinTrash weight="BoldDuotone" className="h-5 w-5 text-destructive" />
          <span className="text-[10px] font-medium text-destructive leading-none">Hapus</span>
        </button>
        {!entry.checkOutAt && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-0.5 w-14 rounded-xl py-1.5 px-1 cursor-pointer transition-colors hover:bg-accent"
              >
                <Logout weight="BoldDuotone" className="h-5 w-5 text-primary" />
                <span className="text-[10px] font-medium text-muted-foreground leading-none">Checkout</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CHECKOUT_STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => onCheckoutSelect(entry, opt.value)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
  const [confirmDelete, setConfirmDelete] = useState<GuestbookEntryItem | null>(null);
  const [confirmEdit, setConfirmEdit] = useState<GuestbookEntryItem | null>(null);
  const [editEntry, setEditEntry] = useState<GuestbookEntryItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [filterVenueId, setFilterVenueId] = useState<string>("all");
  const [filterHostId, setFilterHostId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | GuestbookCategoryFilter>("all");
  const [filterInteractionType, setFilterInteractionType] = useState<"all" | GuestInteractionType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | GuestVisitStatus>("all");
  const [filterSourceId, setFilterSourceId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoOpenHandled = useRef(false);

  useEffect(() => {
    if (autoOpenHandled.current) return;
    if (searchParams.get("create") !== "1") return;
    autoOpenHandled.current = true;
    setDrawerOpen(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  // Debounce search → debouncedSearch (mirrors vendors-table.tsx), resets page to 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Any other filter change also resets page to 1.
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, filterVenueId, filterHostId, filterCategory, filterInteractionType, filterStatus, filterSourceId]);

  // Clear selection whenever the visible page/filter set changes, so bulk
  // actions never act on rows the user can no longer see.
  useEffect(() => {
    setSelectedIds([]);
  }, [currentPage, debouncedSearch, filterVenueId, filterHostId, filterCategory, filterInteractionType, filterStatus, filterSourceId]);

  const queryClient = useQueryClient();
  const { data: guestbookData, isLoading } = useGuestbookEntries({
    page: currentPage,
    pageSize: 50,
    search: debouncedSearch,
    venueId: filterVenueId !== "all" ? filterVenueId : undefined,
    hostId: filterHostId !== "all" ? filterHostId : undefined,
    dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    category: filterCategory !== "all" ? filterCategory : undefined,
    interactionType: filterInteractionType !== "all" ? filterInteractionType : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    sourceOfInformationId: filterSourceId !== "all" ? filterSourceId : undefined,
  });
  const entries = guestbookData?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((guestbookData?.total ?? 0) / 50));
  const { data: venues = [] } = useVenues();
  const { users: salesUsers } = useSalesUsers();
  const salesOptions = salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? u.id }));
  const deleteMutation = useDeleteGuestbookEntry();
  const checkoutMutation = useCheckOutGuestbookEntry();
  const bulkDeleteMutation = useDeleteBulkGuestbookEntries();
  const bulkCheckoutMutation = useBulkCheckOutGuestbookEntries();

  function handleStatusBucketClick(key: string) {
    setFilterStatus((prev) => (prev === key ? "all" : (key as GuestVisitStatus)));
  }

  function handleSourceBucketClick(key: string) {
    setFilterSourceId((prev) => (prev === key ? "all" : key));
  }

  function handleCategoryBucketClick(key: string) {
    setFilterCategory((prev) => (prev === key ? "all" : (key as GuestbookCategoryFilter)));
  }

  function handleVenueBucketClick(key: string) {
    setFilterVenueId((prev) => (prev === key ? "all" : key));
  }

  function handleHostBucketClick(key: string) {
    setFilterHostId((prev) => (prev === key ? "all" : key));
  }

  async function handleCheckoutSelect(
    entry: GuestbookEntryItem,
    visitStatus: "deal" | "to_be_discuss" | "lost"
  ): Promise<void> {
    const result = await checkoutMutation.mutateAsync({ id: entry.id, visitStatus });
    if (result.success) {
      toast.success(`"${entry.visitorName}" berhasil di-checkout sebagai ${CHECKOUT_STATUS_OPTIONS.find((o) => o.value === visitStatus)?.label ?? visitStatus}`);
    } else {
      toast.error(result.error ?? "Gagal melakukan checkout.");
    }
  }

  function handleEditClick(entry: GuestbookEntryItem) {
    setConfirmEdit(entry);
  }

  function handleConfirmEdit() {
    if (!confirmEdit) return;
    setEditEntry(confirmEdit);
    setConfirmEdit(null);
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

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? entries.map((e) => e.id) : []);
  }

  function toggleSelectRow(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  }

  async function handleBulkDelete(): Promise<void> {
    const result = await bulkDeleteMutation.mutateAsync(selectedIds);
    if (result.success) {
      toast.success(`${result.count ?? selectedIds.length} data berhasil dihapus`);
      setSelectedIds([]);
    } else {
      toast.error(result.error ?? "Gagal menghapus data");
    }
    setConfirmBulkDelete(false);
  }

  async function handleBulkCheckout(visitStatus: "deal" | "to_be_discuss" | "lost"): Promise<void> {
    const result = await bulkCheckoutMutation.mutateAsync({ ids: selectedIds, visitStatus });
    if (result.success) {
      toast.success(`${result.count ?? selectedIds.length} data berhasil di-checkout`);
      setSelectedIds([]);
    } else {
      toast.error(result.error ?? "Gagal melakukan checkout");
    }
  }

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange?.to) params.set("to", format(dateRange.to, "yyyy-MM-dd"));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterVenueId !== "all") params.set("venueId", filterVenueId);
      if (filterHostId !== "all") params.set("hostId", filterHostId);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterInteractionType !== "all") params.set("interactionType", filterInteractionType);

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

  const activeFilterCount =
    (dateRange?.from ? 1 : 0) +
    (filterVenueId !== "all" ? 1 : 0) +
    (filterHostId !== "all" ? 1 : 0) +
    (search.trim() !== "" ? 1 : 0) +
    (filterCategory !== "all" ? 1 : 0) +
    (filterInteractionType !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (filterSourceId !== "all" ? 1 : 0);

  function resetFilters() {
    setDateRange(todayRange());
    setFilterVenueId("all");
    setFilterHostId("all");
    setFilterCategory("all");
    setFilterInteractionType("all");
    setFilterStatus("all");
    setFilterSourceId("all");
    setSearch("");
    setCurrentPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
      <GuestbookOverview
        overview={guestbookData?.overview ?? {
          total: 0,
          checkedOut: 0,
          activeVisits: 0,
          onlineMeetings: 0,
          inPersonVisits: 0,
          byStatus: [],
          byCategory: [],
          bySource: [],
          byVenue: [],
          byHost: [],
          adsUrlBuckets: [],
          adsUrlOrganik: 0,
        }}
        activeStatus={filterStatus !== "all" ? filterStatus : undefined}
        onStatusClick={handleStatusBucketClick}
        activeCategory={filterCategory !== "all" ? filterCategory : undefined}
        onCategoryClick={handleCategoryBucketClick}
        activeSourceId={filterSourceId !== "all" ? filterSourceId : undefined}
        onSourceClick={handleSourceBucketClick}
        activeVenueId={filterVenueId !== "all" ? filterVenueId : undefined}
        onVenueClick={handleVenueBucketClick}
        activeHostId={filterHostId !== "all" ? filterHostId : undefined}
        onHostClick={handleHostBucketClick}
      />
      {/* Table — desktop */}
      <Card className="rounded-2xl shadow-sm hidden sm:block py-0">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Buku Tamu</h2>
              <span className="text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                {guestbookData?.total ?? 0} tamu
              </span>
              <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                Wedding {guestbookData?.weddingCount ?? 0}
              </span>
              <span className="text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                MICE {guestbookData?.miceCount ?? 0}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Magnifer
                  weight="BoldDuotone"
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama tamu, kode, atau PIC..."
                  className="rounded-xl pl-8 h-8 text-xs"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 gap-1.5 relative"
                onClick={() => setFilterOpen(true)}
              >
                <Filter weight="BoldDuotone" className="h-3.5 w-3.5" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

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
                nativeButton={false}
                className="rounded-full text-xs h-8 gap-1.5"
                render={<Link href="/guestbook/scan" />}
              >
                <QrCode weight="BoldDuotone" className="h-3.5 w-3.5" />
                Scan Kehadiran
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

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 border-b bg-primary/5">
              <span className="text-sm text-foreground">
                <span className="font-semibold">{selectedIds.length}</span> tamu dipilih
              </span>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full text-xs h-8 gap-1.5">
                      <Logout weight="BoldDuotone" className="h-3.5 w-3.5" />
                      Checkout
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {CHECKOUT_STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuItem key={opt.value} onClick={() => { void handleBulkCheckout(opt.value); }}>
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-8 gap-1.5 text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmBulkDelete(true)}
                >
                  <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                  Hapus
                </Button>
                <Button variant="ghost" size="sm" className="rounded-full text-xs h-8" onClick={() => setSelectedIds([])}>
                  Batal
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={entries.length > 0 && selectedIds.length === entries.length}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < entries.length}
                      onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                      disabled={entries.length === 0}
                      aria-label="Pilih semua tamu di halaman ini"
                    />
                  </TableHead>
                  <TableHead>Nama Tamu</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Festival</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>In / Out</TableHead>
                  <TableHead className="hidden xl:table-cell">Sumber</TableHead>
                  <TableHead className="hidden xl:table-cell">Dicatat oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows />
              </TableBody>
            </Table>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <UsersGroupRounded weight="BoldDuotone" className="h-10 w-10 opacity-30" />
              <p className="text-sm">Belum ada data kunjungan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 px-3">
                      <Checkbox
                        checked={entries.length > 0 && selectedIds.length === entries.length}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < entries.length}
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        disabled={entries.length === 0}
                        aria-label="Pilih semua tamu di halaman ini"
                      />
                    </TableHead>
                    <TableHead>Nama Tamu</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Festival</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>PIC</TableHead>
                    <TableHead>In / Out</TableHead>
                    <TableHead className="hidden xl:table-cell">Sumber</TableHead>
                    <TableHead className="hidden xl:table-cell">Dicatat oleh</TableHead>
                    <TableHead className="text-right pr-4">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const sourceLabel = entry.sourceOfInformation?.name ?? null;
                    const statusInfo = entry.visitStatus ? STATUS_LABELS[entry.visitStatus] : null;
                    const totalVisit = countVisitsOnPage(entry, entries);
                    const festivalLabel = entry.festival?.name ?? "-";

                    return (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(entry.id)}
                            onCheckedChange={(checked) => toggleSelectRow(entry.id, checked === true)}
                            aria-label="Pilih tamu"
                          />
                        </TableCell>
                        <TableCell className="max-w-48">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {(() => {
                              const photoSrc = resolveGuestbookProofThumb((entry.proofFiles ?? null) as ProofFiles | null);
                              if (photoSrc) {
                                return <Image src={photoSrc} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover shrink-0" unoptimized />;
                              }
                              return null;
                            })()}
                            <div className="leading-tight min-w-0">
                              <p className="flex items-center gap-1 font-medium text-foreground truncate">
                                {entry.visitorName}
                                {totalVisit > 1 && (
                                  <span
                                    className="hidden sm:inline-flex shrink-0 items-center gap-0.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                                    title={`${totalVisit}x kunjungan (nama & nomor telepon sama)`}
                                  >
                                    <Repeat weight="BoldDuotone" className="h-2.5 w-2.5" />
                                    {totalVisit}x
                                  </span>
                                )}
                              </p>
                              {statusInfo && (
                                <Badge
                                  className={cn(
                                    "rounded-full text-[10px] mt-0.5 cursor-pointer transition-opacity hover:opacity-80",
                                    statusInfo.className
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusBucketClick(entry.visitStatus as string);
                                  }}
                                >
                                  {statusInfo.label}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const cat = entry.eventCategory ?? entry.package?.category;
                            if (!cat) return <span className="text-muted-foreground/50">—</span>;
                            const badgeClass =
                              cat === "MICE"
                                ? "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)]"
                                : "bg-primary/10 text-primary";
                            return (
                              <Badge className={`rounded-full text-[10px] font-medium border-0 ${badgeClass}`}>
                                {EVENT_CATEGORY_LABELS[cat] ?? cat}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-40 truncate">
                          {festivalLabel}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-56">
                          <div className="flex flex-col gap-1 items-start min-w-0 max-w-full">
                            <span className="truncate max-w-full">{entry.venue?.name ?? "-"}</span>
                            {entry.package?.packageName && (
                              <Badge variant="secondary" className="rounded-full text-[10px] font-normal max-w-full truncate">
                                {entry.package.packageName} · {entry.package.pax} pax · {formatRupiah(getPackagePrice(entry.package))}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-32 truncate">
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
                        <TableCell className="text-muted-foreground max-w-32 hidden xl:table-cell">
                          <div className="flex flex-col gap-1 items-start min-w-0 max-w-full">
                            <span className="truncate max-w-full">
                              {sourceLabel ?? <span className="text-muted-foreground/50">—</span>}
                            </span>
                            {entry.segment?.name && (
                              <Badge variant="secondary" className="rounded-full text-[10px] font-normal max-w-full truncate">
                                {entry.segment.name}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-32 truncate hidden xl:table-cell">
                          {entry.createdBy?.fullName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
                            {!entry.checkOutAt && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    aria-label="Checkout"
                                  >
                                    <Logout weight="BoldDuotone" className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {CHECKOUT_STATUS_OPTIONS.map((opt) => (
                                    <DropdownMenuItem
                                      key={opt.value}
                                      onClick={() => { void handleCheckoutSelect(entry, opt.value); }}
                                    >
                                      {opt.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            label="Navigasi halaman guestbook"
          />
        </CardContent>
      </Card>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {/* Mobile search bar */}
        <div className="relative">
          <Magnifer
            weight="BoldDuotone"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama tamu, kode, atau PIC..."
            className="rounded-xl pl-9 h-10 text-sm w-full"
          />
        </div>

        {/* Mobile toolbar: count · filter popover · export · refresh · add */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
            {guestbookData?.total ?? 0} tamu
          </span>
          <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full shrink-0">
            Wedding {guestbookData?.weddingCount ?? 0}
          </span>
          <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
            MICE {guestbookData?.miceCount ?? 0}
          </span>
          <div className="flex-1" />

          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("shrink-0 relative", activeFilterCount > 0 && "border-primary/50")}
            onClick={() => setFilterOpen(true)}
            aria-label="Filter guestbook"
          >
            <Filter weight="BoldDuotone" className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                {activeFilterCount}
              </span>
            )}
          </Button>

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
        {!isLoading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <UsersGroupRounded weight="BoldDuotone" className="h-10 w-10 opacity-30" />
            <p className="text-sm">Belum ada data kunjungan</p>
          </div>
        )}
        {!isLoading &&
          entries.map((entry) => (
            <MobileCard
              key={entry.id}
              entry={entry}
              totalVisit={countVisitsOnPage(entry, entries)}
              onViewClick={setSelectedEntry}
              onEditClick={handleEditClick}
              onDeleteClick={setConfirmDelete}
              onStatusClick={handleStatusBucketClick}
              onCheckoutSelect={(e, visitStatus) => { void handleCheckoutSelect(e, visitStatus); }}
            />
          ))}

        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          label="Navigasi halaman guestbook"
        />
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

      <GuestbookFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        search={search}
        onSearchChange={setSearch}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        venueId={filterVenueId}
        onVenueIdChange={setFilterVenueId}
        hostId={filterHostId}
        onHostIdChange={setFilterHostId}
        category={filterCategory}
        onCategoryChange={setFilterCategory}
        interactionType={filterInteractionType}
        onInteractionTypeChange={setFilterInteractionType}
        status={filterStatus}
        onStatusChange={setFilterStatus}
        sourceOfInformationId={filterSourceId}
        onSourceOfInformationIdChange={setFilterSourceId}
        venues={venues}
        salesOptions={salesOptions}
        onReset={resetFilters}
      />

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

      {/* Bulk delete confirmation */}
      <AlertDialog
        open={confirmBulkDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmBulkDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Massal</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus {selectedIds.length} data terpilih? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { void handleBulkDelete(); }}
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
