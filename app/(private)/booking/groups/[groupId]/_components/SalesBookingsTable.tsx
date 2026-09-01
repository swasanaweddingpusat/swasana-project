"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Magnifer as Search,
  Calendar as CalendarDays,
  MenuDots as EllipsisVertical,
  Eye,
  Pen as Pencil,
  TrashBinTrash as Trash2,
  CloseSquare as SquareX,
  TransferHorizontal as ArrowLeftRight,
  UsersGroupRounded,
  FileText as FileSignature,
  Printer,
  FileSend as FileUp,
  ChatRound as MessageSquare,
  ClipboardCheck,
  Refresh,
  ArrowLeft,
  ArrowRight,
  Filter,
  DocumentText,
  TagPrice,
  ClockCircle,
  Download,
} from "@solar-icons/react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useSalesBookings } from "@/hooks/use-sales-bookings";
import { useDeleteBooking } from "@/hooks/use-bookings";
import { useSyncBookingPackage } from "@/hooks/use-booking-revisions";
import { usePermissions } from "@/hooks/use-permissions";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUnreadCommentCounts } from "@/hooks/use-unread-comment-counts";
import { fetchBookingComments } from "@/services/booking-comment-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AgreementModal } from "@/components/shared/booking/agreement-modal";
import { CancelBookingDialog } from "@/components/shared/booking/cancel-booking-dialog";
import { RestoreBookingDialog } from "@/components/shared/booking/restore-booking-dialog";
import { TransferBookingModal } from "@/components/shared/booking/transfer-booking-modal";
import { TransferManagerModal } from "@/components/shared/booking/transfer-manager-modal";
import { BookingDetailModal } from "@/app/(private)/booking/booking-weddings/_components/booking-detail-modal";
import { EditBookingDrawer } from "@/app/(private)/booking/booking-weddings/_components/edit-booking-drawer";
import { BookingPOPreviewModal, type BookingPOPreviewTarget } from "@/app/(private)/booking/booking-weddings/_components/booking-po-preview-modal";
import { UploadDocumentModal } from "@/app/(private)/booking/booking-weddings/_components/upload-document-modal";
import { BookingCommentPanel } from "@/app/(private)/booking/booking-weddings/_components/booking-comment-panel";
import { ActivityLogModal } from "@/app/(private)/booking/booking-weddings/_components/activity-log-modal";
import { ExportBookingsModal } from "@/app/(private)/booking/booking-weddings/_components/export-bookings-modal";
import { BookingTCDrawer } from "@/app/(private)/booking/booking-weddings/_components/booking-tc-drawer";
import { SetHargaBookingDrawer } from "@/app/(private)/booking/booking-weddings/_components/SetHargaBookingDrawer";
import { RevisionHistoryDrawer } from "@/app/(private)/booking/booking-weddings/_components/RevisionHistoryDrawer";
import { ApproveModal } from "@/app/(private)/booking/packages/_components/approve-modal";
import { ApprovalDialog } from "@/app/(private)/booking/packages/_components/approval-dialog";
import type { BookingListItem, ApprovalStatusFilter } from "@/lib/queries/bookings";
import type { AssignableSalesUser } from "@/lib/queries/users";
import type { BookingStatus } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

/** Page range with "..." gaps — always shows first, last, current, and ±1 neighbour. */
function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current]);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= total) pages.add(current + 1);
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) result.push("...");
  }
  return result;
}

const STATUS_DOT: Record<string, string> = {
  Confirmed: "bg-primary",
  Uploaded: "bg-primary/60",
  Pending: "bg-muted-foreground/60",
  Rejected: "bg-destructive",
  Canceled: "bg-muted-foreground",
  Lost: "bg-muted-foreground",
};

const STATUS_TEXT: Record<string, string> = {
  Confirmed: "text-primary border-primary/20",
  Uploaded: "text-primary/70 border-border",
  Pending: "text-muted-foreground border-border",
  Rejected: "text-destructive border-destructive/30",
  Canceled: "text-muted-foreground border-border",
  Lost: "text-muted-foreground border-border",
};

const SESSION_LABEL: Record<string, string> = {
  morning: "Pagi",
  evening: "Malam",
  fullday: "Fullday",
};

const RECORD_STATUS_OPTIONS: { id: "saved" | "draft" | "all"; name: string }[] = [
  { id: "saved", name: "Saved" },
  { id: "draft", name: "Draft" },
  { id: "all", name: "Semua" },
];

const BOOKING_STATUS_OPTIONS: { id: BookingStatus | ""; name: string }[] = [
  { id: "", name: "Semua" },
  { id: "Pending", name: "Pending" },
  { id: "Uploaded", name: "Uploaded" },
  { id: "Confirmed", name: "Confirmed" },
  { id: "Rejected", name: "Rejected" },
  { id: "Canceled", name: "Canceled" },
  { id: "Lost", name: "Lost" },
];

const APPROVAL_STATUS_OPTIONS: { id: ApprovalStatusFilter | ""; name: string }[] = [
  { id: "", name: "Semua" },
  { id: "pending", name: "Pending (semua step)" },
  { id: "approved", name: "Approved (semua step)" },
  { id: "sales-approved", name: "Sales — Sudah Approve" },
  { id: "sales-pending", name: "Sales — Belum Approve" },
  { id: "manager-approved", name: "Manager — Sudah Approve" },
  { id: "manager-pending", name: "Manager — Belum Approve" },
  { id: "finance-approved", name: "Finance — Sudah Approve" },
  { id: "finance-pending", name: "Finance — Belum Approve" },
  { id: "client-approved", name: "Client — Sudah TTD" },
  { id: "client-pending", name: "Client — Belum TTD" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SalesBookingsTableProps {
  salesId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesBookingsTable({ salesId }: SalesBookingsTableProps): React.JSX.Element {
  const qc = useQueryClient();
  const router = useRouter();
  const deleteMut = useDeleteBooking();
  const syncPackageMut = useSyncBookingPackage();
  const { can, isAdmin } = usePermissions();
  const { openBookingDrawer } = useBookingDrawer();
  const { user } = useCurrentUser();

  // ── Filter & pagination state ──────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [venueId, setVenueId] = useState("");
  const [recordStatus, setRecordStatus] = useState<"saved" | "draft" | "all">("saved");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatus | "">("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalStatusFilter | "">("");
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [sourceOfInformationFilter, setSourceOfInformationFilter] = useState("");
  // Gates the venue/source/year fetches: only load once the Filter popover is opened.
  const [filterOpened, setFilterOpened] = useState(false);

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<BookingListItem | null>(null);
  const [poPreviewTarget, setPoPreviewTarget] = useState<BookingPOPreviewTarget | null>(null);
  const [uploadDocTarget, setUploadDocTarget] = useState<BookingListItem | null>(null);
  const [transferTarget, setTransferTarget] = useState<BookingListItem | null>(null);
  const [managerTarget, setManagerTarget] = useState<BookingListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingListItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BookingListItem | null>(null);
  const [agreementModal, setAgreementModal] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null);
  const [commentTarget, setCommentTarget] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [activityLogTarget, setActivityLogTarget] = useState<BookingListItem | null>(null);
  const [approvalDialogTarget, setApprovalDialogTarget] = useState<BookingListItem | null>(null);
  const [approveModal, setApproveModal] = useState<{ stepId: string; stepLabel: string; bookingName: string } | null>(null);
  const [tcTarget, setTcTarget] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [setHargaTarget, setSetHargaTarget] = useState<{ bookingId: string; customerName: string; packageName: string; pax: number; venueName?: string } | null>(null);
  const [revisionHistoryTarget, setRevisionHistoryTarget] = useState<BookingListItem | null>(null);
  const [syncPackageTarget, setSyncPackageTarget] = useState<BookingListItem | null>(null);

  // Revision cache for PO preview sub-menu
  const [revisionCache, setRevisionCache] = useState<
    Record<string, { id: string; revisionNumber: number; reason: string | null; packageName: string; pax: number | null; price: number | null; createdAt: string }[]>
  >({});

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: result, isFetching, refetch } = useSalesBookings({
    salesId,
    page,
    pageSize,
    search: debouncedSearch || undefined,
    venueId: venueId || undefined,
    recordStatus,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    // Year only applies when no explicit event-date range is set (mirrors booking-weddings).
    year: (!dateFrom && !dateTo && yearFilter) ? yearFilter : undefined,
    approvalStatus: approvalFilter || undefined,
    bookingStatus: bookingStatusFilter || undefined,
    sourceOfInformationId: sourceOfInformationFilter || undefined,
  });

  const bookings: BookingListItem[] = result?.data ?? [];
  const totalBookings = result?.total ?? 0;
  const totalPages = Math.ceil(totalBookings / pageSize);

  // Venue list — only needed inside the Filter popover, so defer the fetch until
  // the user actually opens it (gated by filterOpened).
  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["venues-list"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      if (!res.ok) return [];
      const json = await res.json() as unknown;
      return Array.isArray(json) ? (json as { id: string; name: string }[]) : [];
    },
    enabled: filterOpened,
    staleTime: 10 * 60 * 1000,
  });

  // Source of information list — filter popover only, deferred until opened.
  const { data: sourceOfInformations = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["source-of-informations-list"],
    queryFn: async () => {
      const res = await fetch("/api/source-of-informations");
      if (!res.ok) return [];
      const json = await res.json() as unknown;
      return Array.isArray(json) ? (json as { id: string; name: string }[]) : [];
    },
    enabled: filterOpened,
    staleTime: 10 * 60 * 1000,
  });

  // Available booking years — filter popover only, deferred until opened.
  const { data: yearsData } = useQuery<{ years: number[] }>({
    queryKey: ["booking-years"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/years");
      if (!res.ok) return { years: [] };
      return res.json() as Promise<{ years: number[] }>;
    },
    enabled: filterOpened,
    staleTime: 10 * 60 * 1000,
  });
  const availableYears = yearsData?.years ?? [];

  // Sales users for TransferBookingModal — only needed once a transfer is opened,
  // so defer the fetch until then (gated by transferTarget).
  const { data: salesUsers = [] } = useQuery<AssignableSalesUser[]>({
    queryKey: ["sales-profiles-list"],
    queryFn: async () => {
      const res = await fetch("/api/users/sales");
      if (!res.ok) return [];
      const json = await res.json() as unknown;
      return Array.isArray(json) ? (json as AssignableSalesUser[]) : [];
    },
    enabled: !!transferTarget,
    staleTime: 5 * 60 * 1000,
  });

  // Approval records ride along on each booking row — getBookings attaches
  // booking.bookingApprovals for the active page only (mirrors bookings-table.tsx),
  // so there is NO separate approval fetch. Build the entityId → record map from them.
  const approvalMap = new Map(
    bookings
      .map((b) => b.bookingApprovals)
      .filter((r): r is NonNullable<BookingListItem["bookingApprovals"]> => r !== null)
      .map((r) => [r.entityId, r]),
  );

  // Unread comment counts
  const { data: countData } = useUnreadCommentCounts(bookings.map((b) => b.id));
  const unreadCounts = countData?.unreadCounts ?? {};

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Computes approval state for a booking from approvalMap + currentRevisionId.
   *  Returns both hasPending and internalApproved flags so callers don't recompute twice. */
  function getBookingApprovalState(booking: BookingListItem): { hasPending: boolean; internalApproved: boolean } {
    const allSteps = approvalMap.get(booking.id)?.steps ?? [];
    const hasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
    const currentRoundSteps = (booking.currentRevisionId && hasRevisionedSteps)
      ? allSteps.filter((s) => s.revisionId === booking.currentRevisionId)
      : allSteps;
    const nonClientSteps = currentRoundSteps.filter((s) => s.approverType !== "client");
    const hasPending = approvalMap.has(booking.id) && !nonClientSteps.every((s) => s.status === "approved");
    // Internal approval = EVERY non-client step (Sales + Manager + Finance) approved.
    const internalApproved = nonClientSteps.length > 0 && nonClientSteps.every((s) => s.status === "approved");
    return { hasPending, internalApproved };
  }

  // A manually-uploaded PO lives on the CURRENT revision's client step. Mirror the
  // revision-aware read in bookings-table.tsx: pick the client step for currentRevisionId
  // (fallback to the first) so a stale past-revision step never hides — or fakes — one.
  function getManualPO(
    booking: BookingListItem,
  ): { path: string; fileName?: string; fileType?: string } | null {
    const record = approvalMap.get(booking.id);
    if (!record) return null;
    const clientSteps = record.steps
      .filter((s) => s.approverType === "client")
      .sort((a, b) => a.stepOrder - b.stepOrder);
    const current =
      clientSteps.find((s) => s.revisionId === booking.currentRevisionId) ?? clientSteps[0];
    const uploaded = (current?.clientAgreementUploaded ?? null) as {
      path?: string;
      fileName?: string;
      fileType?: string;
    } | null;
    return uploaded?.path ? { ...uploaded, path: uploaded.path } : null;
  }

  function previewPO(
    booking: BookingListItem,
    revisionId?: string,
    revLabel?: string,
    mode?: "auto" | "manual" | "digital",
  ): void {
    const base = booking.snapCustomer?.name ?? "Booking";
    const modeLabel = mode === "manual" ? "PO Manual" : mode === "digital" ? "PO Digital" : null;
    const suffix = revLabel ?? modeLabel;
    setPoPreviewTarget({
      bookingId: booking.id,
      revisionId,
      label: suffix ? `${base} · ${suffix}` : base,
      mode,
    });
  }

  // New PDF (theme V2 Kediaman) — ungated dropdown action, renders via /api/render-po/v2.
  function previewNewPdf(booking: BookingListItem): void {
    const base = booking.snapCustomer?.name ?? "Booking";
    setPoPreviewTarget({
      bookingId: booking.id,
      label: `${base} · New PDF`,
      endpoint: "/api/render-po/v2",
    });
  }

  // "Lihat Detail" now navigates to the full detail page (row/card click still opens
  // the modal). Prefetch on hover/focus so navigation feels instant.
  function goToDetailPage(id: string): void {
    router.push(`/booking/booking-weddings/${id}`);
  }
  function prefetchDetailPage(id: string): void {
    router.prefetch(`/booking/booking-weddings/${id}`);
  }

  const fetchRevisions = useCallback((bookingId: string): void => {
    fetch(`/api/bookings/${bookingId}/revisions`)
      .then((r) => r.json())
      .then((res: unknown) => {
        const items = Array.isArray(res)
          ? res
          : Array.isArray((res as { data?: unknown[] }).data)
            ? (res as { data: unknown[] }).data
            : [];
        setRevisionCache((p) => ({
          ...p,
          [bookingId]: items as { id: string; revisionNumber: number; reason: string | null; packageName: string; pax: number | null; price: number | null; createdAt: string }[],
        }));
      })
      .catch((err) => {
        console.error("[SalesBookingsTable] fetchRevisions error:", err);
      });
  }, []);

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    const res = await deleteMut.mutateAsync(deleteTarget.id);
    if (!res.success) {
      toast.error(res.error);
    } else {
      toast.success("Booking dihapus.");
      void refetch();
    }
    setDeleteTarget(null);
  }

  // ── Filter state helpers ───────────────────────────────────────────────────
  const hasVenueFilter = venueId !== "" && venueId !== "all";
  const hasRecordStatusFilter = recordStatus !== "saved";
  const hasDateFilter = dateFrom !== "" || dateTo !== "";
  const hasYearFilter = yearFilter !== null;
  const hasApprovalFilter = approvalFilter !== "";
  const hasBookingStatusFilter = bookingStatusFilter !== "";
  const hasSourceOfInformationFilter = sourceOfInformationFilter !== "" && sourceOfInformationFilter !== "all";
  const activeFilterCount =
    (hasVenueFilter ? 1 : 0) +
    (hasRecordStatusFilter ? 1 : 0) +
    (hasDateFilter ? 1 : 0) +
    (hasYearFilter ? 1 : 0) +
    (hasApprovalFilter ? 1 : 0) +
    (hasBookingStatusFilter ? 1 : 0) +
    (hasSourceOfInformationFilter ? 1 : 0);
  const hasActiveFilter = activeFilterCount > 0;

  function resetFilters(): void {
    setVenueId("");
    setRecordStatus("saved");
    setDateFrom("");
    setDateTo("");
    setYearFilter(null);
    setApprovalFilter("");
    setBookingStatusFilter("");
    setSourceOfInformationFilter("");
    setPage(1);
  }

  // ── Per-booking action renderer ────────────────────────────────────────────
  function renderActions(booking: BookingListItem): React.JSX.Element {
    // Draft: only delete
    if (booking.recordStatus === "draft") {
      if (!can("booking", "delete")) return <></>;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")}>
            <EllipsisVertical weight="BoldDuotone" className={cn("h-4", "w-4", "text-muted-foreground")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className={cn("cursor-pointer", "text-destructive", "focus:text-destructive")}
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(booking); }}
            >
              <Trash2 weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-destructive")} />
              Hapus Draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // Approval state — internalApproved = ALL non-client steps (Sales+Manager+Finance)
    // approved (mirrors bookings-table.tsx getBookingApprovalState). hasPending drives
    // the quick-approve dropdown visibility.
    const { hasPending, internalApproved } = getBookingApprovalState(booking);

    const allSteps = approvalMap.get(booking.id)?.steps ?? [];
    const hasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
    const currentSteps =
      booking.currentRevisionId && hasRevisionedSteps
        ? allSteps.filter((s) => s.revisionId === booking.currentRevisionId)
        : allSteps;
    const nonClientSteps = currentSteps.filter((s) => s.approverType !== "client");

    // Quick approve — pending non-client steps the current user can act on.
    const actableSteps = nonClientSteps.filter((step) => {
      const isPending = step.status === "pending";
      return isPending && (
        isAdmin ||
        (step.approverType === "role" && step.approverRoleId === user?.roleId) ||
        (step.approverType === "user" && step.approverUserId === user?.profileId)
      );
    });

    const isCanceled = booking.bookingStatus === "Canceled";
    const manualPO = getManualPO(booking);
    const revisions = revisionCache[booking.id] ?? [];

    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        {/* Quick: Client Agreement — once ALL internal steps approved, before signing */}
        {!isCanceled && can("booking", "client-agreement") && internalApproved && booking.clientAgreement?.status !== "Signed" && (
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={(e) => { e.stopPropagation(); setAgreementModal({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Client" }); }} />}>
                <FileSignature weight="BoldDuotone" className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Client Agreement</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Quick: Approval — dropdown of non-client steps (mirrors booking-weddings table) */}
        {!isCanceled && approvalMap.has(booking.id) && hasPending && (
          <DropdownMenu>
            <TooltipProvider delay={200}>
              <Tooltip>
                <DropdownMenuTrigger className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")}>
                  <TooltipTrigger render={<span />}>
                    <ClipboardCheck weight="BoldDuotone" className="h-4 w-4 text-primary" />
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent side="top"><p className="text-xs">Approval</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end">
              {nonClientSteps.map((step) => {
                const label = step.approverType === "role" ? step.approverRole?.name : step.approverUser?.fullName;
                const isApproved = step.status === "approved";
                const isRejected = step.status === "rejected";
                const isPending = step.status === "pending";
                const canAct = isPending && actableSteps.some((s) => s.id === step.id);
                return (
                  <DropdownMenuItem
                    key={step.id}
                    className="cursor-pointer"
                    disabled={isApproved || isRejected || (isPending && !canAct)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canAct) {
                        setApproveModal({ stepId: step.id, stepLabel: label ?? "Unknown", bookingName: booking.snapCustomer?.name ?? "Booking" });
                      }
                    }}
                  >
                    {isApproved ? `✓ ${label}` : isRejected ? `✗ ${label}` : `Approve ${label}`}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Quick: Comment */}
        {can("booking", "comment") && (
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8 relative" onClick={(e) => { e.stopPropagation(); setCommentTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "" }); }} onMouseEnter={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }} onFocus={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }} />}>
                <MessageSquare weight="BoldDuotone" className="h-4 w-4" />
                {(unreadCounts[booking.id] ?? 0) > 0 && (
                  <span className={cn("absolute", "-top-0.5", "-right-0.5", "min-w-4", "h-4", "rounded-full", "bg-destructive", "text-destructive-foreground", "text-[9px]", "font-bold", "flex", "items-center", "justify-center", "px-0.5")}>
                    {unreadCounts[booking.id] > 9 ? "9+" : unreadCounts[booking.id]}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Komentar</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Preview PO — ungated standalone dropdown (mirrors booking-weddings) */}
        <DropdownMenu onOpenChange={(open) => { if (open) fetchRevisions(booking.id); }}>
          <TooltipProvider delay={200}>
            <Tooltip>
              <DropdownMenuTrigger className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")}>
                <TooltipTrigger render={<span />}>
                  <Printer weight="BoldDuotone" className="h-4 w-4 text-primary" />
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent side="top"><p className="text-xs">Preview PO</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end">
            {/* 1. PO Manual — only when a signed PO was uploaded for the current revision */}
            {manualPO && (
              <>
                <DropdownMenuItem className="cursor-pointer" onClick={() => previewPO(booking, undefined, undefined, "manual")}>
                  <FileSignature weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
                  <span className="flex-1">PO Manual</span>
                  <span className={cn("ml-2", "rounded-full", "bg-primary/10", "px-2", "py-0.5", "text-[10px]", "font-semibold", "text-primary")}>Upload</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {/* 2. PO Digital — system-generated document */}
            <DropdownMenuItem className="cursor-pointer" onClick={() => previewPO(booking, undefined, undefined, "digital")}>
              <Printer weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
              PO Digital
            </DropdownMenuItem>
            {revisions.map((rev) => (
              <DropdownMenuItem key={rev.id} className="cursor-pointer" onClick={() => previewPO(booking, rev.id, `Rev ${rev.revisionNumber}`, "digital")}>
                <span className="truncate">Rev {rev.revisionNumber} — {rev.packageName}{rev.pax ? ` · ${rev.pax} PAX` : ""}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {/* 3. New PDF — theme V2 (Kediaman) */}
            <DropdownMenuItem className="cursor-pointer" onClick={() => previewNewPdf(booking)}>
              <DocumentText weight="BoldDuotone" className="mr-2 h-4 w-4 text-primary" />
              New PDF
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => setRevisionHistoryTarget(booking)}>
              <ClockCircle weight="BoldDuotone" className="mr-2 h-4 w-4" />
              Kelola Versi…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")}>
            <EllipsisVertical weight="BoldDuotone" className={cn("h-4", "w-4", "text-muted-foreground")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {isCanceled ? (
              <>
                {/* Canceled: only Detail + Restore */}
                <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); goToDetailPage(booking.id); }} onMouseEnter={() => prefetchDetailPage(booking.id)} onFocus={() => prefetchDetailPage(booking.id)}>
                  <Eye weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                  Lihat Detail
                </DropdownMenuItem>
                {can("booking", "restore") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className={cn("cursor-pointer", "text-muted-foreground", "focus:text-foreground")} onClick={(e) => { e.stopPropagation(); setRestoreTarget(booking); }}>
                      <Refresh weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4")} />
                      Restore Booking
                    </DropdownMenuItem>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Detail — full page */}
                <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); goToDetailPage(booking.id); }} onMouseEnter={() => prefetchDetailPage(booking.id)} onFocus={() => prefetchDetailPage(booking.id)}>
                  <Eye weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                  Lihat Detail
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Edit */}
                {can("booking", "edit") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditTarget(booking); }}>
                    <Pencil weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                    Edit Booking
                  </DropdownMenuItem>
                )}

                {/* Sync Paket dari Master */}
                {can("booking", "edit") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Rejected" && (
                  <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSyncPackageTarget(booking); }}>
                    <Refresh weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                    Sync Paket dari Master
                  </DropdownMenuItem>
                )}

                {/* Set Harga */}
                {can("booking", "edit-set-harga") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSetHargaTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer", packageName: booking.snapPackage?.packageName ?? booking.snapPackagePricing?.packageName ?? "Package", pax: booking.snapPackagePricing?.pax ?? 0, venueName: booking.snapVenue?.venueName ?? undefined }); }}>
                    <TagPrice weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                    Set Harga
                  </DropdownMenuItem>
                )}

                {/* Term & Condition */}
                {can("booking", "term-&-condition") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setTcTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer" }); }}>
                    <DocumentText weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                    Term & Condition
                  </DropdownMenuItem>
                )}

                {/* Upload Dokumen — ungated */}
                <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setUploadDocTarget(booking); }}>
                  <FileUp weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                  Upload Dokumen
                </DropdownMenuItem>

                {/* Transfer Booking */}
                {can("booking", "transfer") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setTransferTarget(booking); }}>
                    <ArrowLeftRight weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                    Transfer Booking
                  </DropdownMenuItem>
                )}

                {/* Transfer Manager */}
                {can("booking", "transfer-manager") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setManagerTarget(booking); }}>
                    <UsersGroupRounded weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                    Transfer Manager
                  </DropdownMenuItem>
                )}

                {/* Activity Log — card has no dedicated column, keep it reachable here */}
                {can("booking", "view") && (
                  <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setActivityLogTarget(booking); }}>
                    <ClipboardCheck weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                    Lihat Activity
                  </DropdownMenuItem>
                )}

                {(can("booking", "cancel") || (can("booking", "restore") && booking.bookingStatus === "Confirmed")) && <DropdownMenuSeparator />}

                {/* Cancel Booking */}
                {can("booking", "cancel") && (
                  <DropdownMenuItem className={cn("cursor-pointer", "text-destructive", "focus:text-destructive")} onClick={(e) => { e.stopPropagation(); setCancelTarget(booking); }}>
                    <SquareX weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-destructive")} />
                    Cancel Booking
                  </DropdownMenuItem>
                )}

                {/* Restore — only when Confirmed */}
                {can("booking", "restore") && booking.bookingStatus === "Confirmed" && (
                  <DropdownMenuItem className={cn("cursor-pointer", "text-muted-foreground", "focus:text-foreground")} onClick={(e) => { e.stopPropagation(); setRestoreTarget(booking); }}>
                    <Refresh weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4")} />
                    Restore Booking
                  </DropdownMenuItem>
                )}

                {can("booking", "delete") && <DropdownMenuSeparator />}
                {can("booking", "delete") && (
                  <DropdownMenuItem className={cn("cursor-pointer", "text-destructive", "focus:text-destructive")} onClick={(e) => { e.stopPropagation(); setDeleteTarget(booking); }}>
                    <Trash2 weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-destructive")} />
                    Hapus
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // ── Filter popover content ─────────────────────────────────────────────────
  const FilterContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filter</p>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Venue filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Venue</label>
        <SearchableSelect
          options={[{ id: "all", name: "Semua Venue" }, ...venues.map((v) => ({ id: v.id, name: v.name }))]}
          value={venueId || "all"}
          onChange={(val) => { setVenueId(val === "all" ? "" : val); setPage(1); }}
          placeholder="Semua Venue"
          searchPlaceholder="Cari venue..."
          emptyText="Venue tidak ditemukan"
          className="h-9"
        />
      </div>

      {/* Source of Information */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Source of Information</label>
        <SearchableSelect
          options={[{ id: "all", name: "Semua Source" }, ...sourceOfInformations.map((s) => ({ id: s.id, name: s.name }))]}
          value={sourceOfInformationFilter || "all"}
          onChange={(val) => { setSourceOfInformationFilter(val === "all" ? "" : val); setPage(1); }}
          placeholder="Semua Source"
          searchPlaceholder="Cari source..."
          emptyText="Source tidak ditemukan"
          className="h-9"
        />
      </div>

      {/* Status Data filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status Data</label>
        <SearchableSelect
          options={RECORD_STATUS_OPTIONS}
          value={recordStatus}
          onChange={(val) => { setRecordStatus(val as "saved" | "draft" | "all"); setPage(1); }}
          placeholder="Saved"
          searchPlaceholder="Cari status..."
          emptyText="Status tidak ditemukan"
          className="h-9"
        />
      </div>

      {/* Status Booking filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status Booking</label>
        <SearchableSelect
          options={BOOKING_STATUS_OPTIONS}
          value={bookingStatusFilter || ""}
          onChange={(val) => { setBookingStatusFilter(val as BookingStatus | ""); setPage(1); }}
          placeholder="Semua"
          searchPlaceholder="Cari status booking..."
          emptyText="Status tidak ditemukan"
          className="h-9"
        />
      </div>

      {/* Date range filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Event Date</label>
        <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 h-9 px-3 text-xs rounded-md border border-input bg-background text-left",
                  "hover:bg-accent transition-colors",
                  dateFrom || dateTo ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <CalendarDays weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {dateFrom && dateTo
                    ? `${format(new Date(dateFrom), "dd MMM yyyy")} — ${format(new Date(dateTo), "dd MMM yyyy")}`
                    : dateFrom
                      ? format(new Date(dateFrom), "dd MMM yyyy")
                      : "Pilih rentang tanggal"}
                </span>
              </button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={
                dateFrom
                  ? { from: new Date(dateFrom), to: dateTo ? new Date(dateTo) : undefined }
                  : undefined
              }
              onSelect={(range: DateRange | undefined) => {
                if (range?.from) {
                  setDateFrom(startOfDay(range.from).toISOString());
                  setDateTo(endOfDay(range.to ?? range.from).toISOString());
                } else {
                  setDateFrom("");
                  setDateTo("");
                }
                setPage(1);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {hasDateFilter && (
          <button
            type="button"
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            Hapus filter tanggal
          </button>
        )}
      </div>

      {/* Tahun filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Tahun</label>
        <SearchableSelect
          options={availableYears.map((y) => ({ id: String(y), name: String(y) }))}
          value={yearFilter !== null ? String(yearFilter) : ""}
          onChange={(val) => { setYearFilter(val ? Number(val) : null); setPage(1); }}
          placeholder="Semua tahun"
          searchPlaceholder="Cari tahun..."
          emptyText="Tahun tidak ditemukan"
          className="h-9"
        />
      </div>

      {/* Status Approval filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status Approval</label>
        <SearchableSelect
          options={APPROVAL_STATUS_OPTIONS}
          value={approvalFilter || ""}
          onChange={(val) => { setApprovalFilter(val as ApprovalStatusFilter | ""); setPage(1); }}
          placeholder="Semua"
          searchPlaceholder="Cari status approval..."
          emptyText="Status tidak ditemukan"
          className="h-9"
        />
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        {/* Count badge */}
        <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
          {totalBookings} booking
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Refresh */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            void refetch();
            qc.invalidateQueries({ queryKey: ["booking-approvals"] }).catch((err) => {
              console.error("[SalesBookingsTable] invalidateQueries error:", err);
            });
          }}
          disabled={isFetching}
          aria-label="Muat ulang"
          className="shrink-0"
        >
          <Refresh weight="BoldDuotone" className={cn("h-4", "w-4", isFetching && "animate-spin")} />
        </Button>

        {/* Export */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setExportOpen(true)}
          aria-label="Export data booking sales ini"
          className="shrink-0"
        >
          <Download weight="BoldDuotone" className="h-4 w-4" />
        </Button>

        {/* Filter popover */}
        <Popover onOpenChange={(o) => { if (o) setFilterOpened(true); }}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn("shrink-0", "relative", hasActiveFilter && "border-primary/50")}
                aria-label="Filter"
              >
                <Filter weight="BoldDuotone" className="h-4 w-4" />
                {hasActiveFilter && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-72 p-3">
            {FilterContent}
          </PopoverContent>
        </Popover>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search weight="BoldDuotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari booking..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 w-full"
        />
      </div>

      {/* Booking list — compact card layout, overflow-x-hidden */}
      <div className="overflow-x-hidden w-full">
        {isFetching && bookings.length === 0 ? (
          // Approvals ride along with the bookings query, so a single load gate suffices.
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CalendarDays weight="BoldDuotone" className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm text-center">
              {search
                ? `Tidak ada hasil untuk "${search}"`
                : recordStatus === "draft"
                  ? "Tidak ada draft booking."
                  : "Belum ada booking."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((booking) => {
              const approvalRecord = approvalMap.get(booking.id);
              const isDraft = booking.recordStatus === "draft";

              const eventDate = booking.eventDate ? new Date(booking.eventDate) : null;
              return (
                <div
                  key={booking.id}
                  className={cn(
                    "group flex gap-3 rounded-2xl border border-border bg-card p-3",
                    "cursor-pointer select-none transition-all",
                    "hover:shadow-md hover:border-border/80",
                  )}
                  onClick={() => {
                    if (isDraft) {
                      openBookingDrawer({ resumeMode: true, initialDraftId: booking.id, onSuccess: () => { void refetch(); } });
                    } else {
                      setDetailTarget(booking.id);
                    }
                  }}
                >
                  {/* Date anchor — the most actionable info for a sales rep */}
                  <div className="shrink-0 flex flex-col items-center justify-center w-14 rounded-xl bg-secondary/60 px-1 py-2 text-center">
                    <span className="text-lg font-bold font-heading text-foreground leading-none tabular-nums">
                      {eventDate ? format(eventDate, "dd") : "—"}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                      {eventDate ? format(eventDate, "MMM") : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {eventDate ? format(eventDate, "yyyy") : ""}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Row 1: name + actions */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-snug min-w-0 flex-1">
                        {booking.snapCustomer?.name ?? booking.customer?.name ?? "—"}
                      </p>
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0 -mt-1 -mr-1">
                        {renderActions(booking)}
                      </div>
                    </div>

                    {/* Row 2: status-line — status + venue, the two signals that matter */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {isDraft && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-border bg-secondary text-secondary-foreground text-[10px] font-semibold">
                          Draft
                        </span>
                      )}
                      {booking.editDraft && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-border bg-secondary text-secondary-foreground text-[10px] font-semibold">
                          Sedang diedit
                        </span>
                      )}
                      {/* Status — the primary signal */}
                      <span className={cn("inline-flex items-center text-[11px] font-semibold", STATUS_TEXT[booking.bookingStatus]?.split(" ")[0] ?? "text-muted-foreground")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full mr-1", STATUS_DOT[booking.bookingStatus] ?? "bg-muted-foreground")} />
                        {booking.bookingStatus}
                      </span>
                      {booking.snapVenue?.venueName && (
                        <>
                          <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                          <span className="text-[11px] text-muted-foreground truncate">{booking.snapVenue.venueName}</span>
                        </>
                      )}
                      {/* Approval — kept as a tappable pill (opens timeline) */}
                      {approvalRecord && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setApprovalDialogTarget(booking); }}
                          className={cn(
                            "inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
                            approvalRecord.status === "approved" && "bg-primary text-primary-foreground",
                            approvalRecord.status === "pending" && "bg-muted text-muted-foreground",
                            approvalRecord.status === "rejected" && "bg-destructive/10 text-destructive",
                          )}
                        >
                          {approvalRecord.status === "approved" ? "Approved" : approvalRecord.status === "pending" ? "Pending" : "Rejected"}
                        </button>
                      )}
                      {(unreadCounts[booking.id] ?? 0) > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                          {unreadCounts[booking.id]} baru
                        </span>
                      )}
                    </div>

                    {/* Row 3: quiet meta — bank · session · PO */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[11px] text-muted-foreground">
                      <span>{booking.paymentMethod?.bankName ?? "N/A"}</span>
                      {booking.weddingSession && (
                        <>
                          <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                          <span>{SESSION_LABEL[booking.weddingSession] ?? booking.weddingSession}</span>
                        </>
                      )}
                      {booking.poNumber && (
                        <>
                          <span aria-hidden="true" className="text-muted-foreground/50">·</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(booking.poNumber!).catch((err) => {
                                console.error("[SalesBookingsTable] clipboard error:", err);
                              });
                              toast.success("Nomor PO disalin", { duration: 1500 });
                            }}
                            className="font-mono bg-muted px-1.5 py-0.5 rounded hover:bg-muted/80 transition-colors cursor-pointer truncate max-w-36"
                          >
                            {booking.poNumber}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: page-size selector (always) + numbered pagination (when >1 page) */}
      {totalBookings > 0 && (
        <div className="flex flex-col gap-3 pt-3 mt-1 border-t border-border sm:flex-row sm:items-center sm:justify-between">
          {/* Page size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tampilkan</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            >
              <SelectTrigger size="sm" className="w-20 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground tabular-nums">dari {totalBookings}</span>
          </div>

          {/* Numbered pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
              >
                <ArrowLeft weight="BoldDuotone" className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <div className="flex items-center gap-1">
                {buildPageRange(page, totalPages).map((item, idx) =>
                  item === "..." ? (
                    <span key={`gap-${idx}`} className="px-1.5 py-1 text-xs text-muted-foreground select-none">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item as number)}
                      className={cn(
                        "min-w-8 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors",
                        page === item
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
              >
                <span className="hidden sm:inline">Next</span>
                <ArrowRight weight="BoldDuotone" className="w-4 h-4 sm:ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Export — scoped to this sales (PIC) */}
      <ExportBookingsModal open={exportOpen} onClose={() => setExportOpen(false)} salesId={salesId} />

      {/* Edit Booking Drawer */}
      <EditBookingDrawer
        key={editTarget?.id ?? ""}
        booking={editTarget}
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus booking{" "}
              <strong>{deleteTarget?.snapCustomer?.name ?? "ini"}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { void handleDelete(); }}
              className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Booking */}
      <CancelBookingDialog open={!!cancelTarget} booking={cancelTarget} onClose={() => setCancelTarget(null)} />

      {/* Restore */}
      <RestoreBookingDialog open={!!restoreTarget} booking={restoreTarget} onClose={() => setRestoreTarget(null)} />

      {/* Transfer Booking */}
      <TransferBookingModal
        open={!!transferTarget}
        booking={transferTarget}
        salesProfiles={salesUsers.map(({ id, fullName }) => ({ id, fullName }))}
        onClose={() => setTransferTarget(null)}
      />

      {/* Transfer Manager */}
      <TransferManagerModal open={!!managerTarget} booking={managerTarget} onClose={() => setManagerTarget(null)} />

      {/* Activity Log */}
      <ActivityLogModal
        open={!!activityLogTarget}
        onClose={() => setActivityLogTarget(null)}
        bookingId={activityLogTarget?.id ?? ""}
        customerName={activityLogTarget?.snapCustomer?.name}
      />

      {/* Booking Detail */}
      <BookingDetailModal open={!!detailTarget} onClose={() => setDetailTarget(null)} bookingId={detailTarget} />

      {/* Agreement */}
      {agreementModal && (
        <AgreementModal
          bookingId={agreementModal.bookingId}
          customerName={agreementModal.customerName}
          onClose={() => { void refetch(); setAgreementModal(null); }}
        />
      )}

      {/* Comment Panel */}
      <BookingCommentPanel
        open={!!commentTarget}
        onClose={() => {
          setCommentTarget(null);
          qc.invalidateQueries({ queryKey: ["unread-comments"] }).catch((err) => {
            console.error("[SalesBookingsTable] invalidateQueries error:", err);
          });
        }}
        bookingId={commentTarget?.bookingId ?? null}
        customerName={commentTarget?.customerName ?? ""}
      />

      {/* Upload Document */}
      {uploadDocTarget && (
        <UploadDocumentModal
          open={!!uploadDocTarget}
          onClose={() => { setUploadDocTarget(null); void refetch(); }}
          bookingId={uploadDocTarget.id}
          bookingName={uploadDocTarget.snapCustomer?.name ?? ""}
        />
      )}

      {/* PO Preview */}
      <BookingPOPreviewModal
        open={!!poPreviewTarget}
        onOpenChange={(open) => { if (!open) setPoPreviewTarget(null); }}
        target={poPreviewTarget}
      />

      {/* Term & Condition Drawer */}
      {tcTarget && (
        <BookingTCDrawer
          open={!!tcTarget}
          onClose={() => setTcTarget(null)}
          bookingId={tcTarget.bookingId}
          customerName={tcTarget.customerName}
        />
      )}

      {/* Set Harga Booking Drawer */}
      {setHargaTarget && (
        <SetHargaBookingDrawer
          key={setHargaTarget.bookingId}
          isOpen={!!setHargaTarget}
          onClose={() => {
            void qc.invalidateQueries({ queryKey: ["bookings"] });
            void qc.invalidateQueries({ queryKey: ["booking-approvals"] });
            void qc.invalidateQueries({ queryKey: ["groups"] });
            setSetHargaTarget(null);
          }}
          bookingId={setHargaTarget.bookingId}
          customerName={setHargaTarget.customerName}
          packageName={setHargaTarget.packageName}
          pax={setHargaTarget.pax}
          venueName={setHargaTarget.venueName}
        />
      )}

      {/* Riwayat Versi — lihat & restore versi lama */}
      <RevisionHistoryDrawer
        booking={revisionHistoryTarget}
        open={!!revisionHistoryTarget}
        onOpenChange={(open) => { if (!open) setRevisionHistoryTarget(null); }}
        onPreviewPO={previewPO}
      />

      {/* Sync Paket dari Master */}
      <AlertDialog open={!!syncPackageTarget} onOpenChange={(o) => { if (!o) setSyncPackageTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sync paket dari master?</AlertDialogTitle>
            <AlertDialogDescription>
              Isi paket booking <strong>{syncPackageTarget?.snapCustomer?.name ?? "ini"}</strong> akan ditarik ulang dari data master terbaru. Yang akan terjadi:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ol className={cn("space-y-2.5", "rounded-xl", "border", "border-border", "bg-muted/30", "p-4")}>
            {(syncPackageTarget?.snapshotFrozenAt
              ? [
                  "Data paket (nama, harga, item, dan T&C) ditarik ulang dari master terbaru dan menimpa isi booking ini.",
                  "Setelan takeout (harga jual custom per kategori) tetap dipertahankan.",
                  "Dibuat revisi baru dan approval di-reset ke Pending — perlu approval ulang dari awal.",
                  "Persetujuan klien dibatalkan; klien harus tanda tangan ulang kontraknya.",
                  "⚠️ Jika harga berubah dan booking sudah punya pembayaran, cek ulang cicilan (TOP) lewat Set Harga.",
                ]
              : [
                  "Data paket (nama, harga, item, dan T&C) ditarik ulang dari master terbaru dan menimpa isi booking ini.",
                  "Setelan takeout (harga jual custom per kategori) tetap dipertahankan.",
                  "Approval yang sudah berjalan (Manager/Finance) TIDAK direset — tetap seperti sekarang.",
                  "Booking belum ditandatangani klien, jadi tidak dibuat revisi baru dan klien tidak perlu tanda tangan ulang.",
                  "⚠️ Jika harga berubah dan booking sudah punya pembayaran, cek ulang cicilan (TOP) lewat Set Harga.",
                ]
            ).map((text, i) => (
              <li key={i} className={cn("flex", "gap-2.5", "text-sm", "text-muted-foreground")}>
                <span className={cn("mt-0.5", "flex", "h-5", "w-5", "shrink-0", "items-center", "justify-center", "rounded-full", "bg-primary/10", "text-xs", "font-semibold", "text-primary")}>
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={syncPackageMut.isPending}
              onClick={async () => {
                if (!syncPackageTarget) return;
                const res = await syncPackageMut.mutateAsync({ bookingId: syncPackageTarget.id });
                if (!res.success) { toast.error(res.error ?? "Gagal sync paket."); return; }
                toast.success("Paket berhasil di-sync dari master");
                void qc.invalidateQueries({ queryKey: ["bookings"] });
                void qc.invalidateQueries({ queryKey: ["booking-approvals"] });
                void qc.invalidateQueries({ queryKey: ["groups"] });
                setSyncPackageTarget(null);
              }}
            >
              {syncPackageMut.isPending ? "Memproses..." : "Ya, sync sekarang"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approval Dialog (from approval badge) */}
      {approvalDialogTarget && user && (
        <ApprovalDialog
          open={!!approvalDialogTarget}
          onClose={() => {
            setApprovalDialogTarget(null);
            qc.invalidateQueries({ queryKey: ["bookings"] }).catch((err) => {
              console.error("[SalesBookingsTable] invalidateQueries error:", err);
            });
            qc.invalidateQueries({ queryKey: ["booking-approvals"] }).catch((err) => {
              console.error("[SalesBookingsTable] invalidateQueries error:", err);
            });
            qc.invalidateQueries({ queryKey: ["groups"] }).catch((err) => {
              console.error("[SalesBookingsTable] invalidateQueries error:", err);
            });
          }}
          packageId={approvalDialogTarget.id}
          packageName={approvalDialogTarget.snapCustomer?.name ?? "Booking"}
          userProfileId={user.profileId}
          userRoleId={user.roleId}
          canReset={can("booking", "reset-approval")}
          module="booking"
        />
      )}

      {/* Approve Step Modal */}
      {approveModal && (
        <ApproveModal
          open={!!approveModal}
          onClose={() => {
            setApproveModal(null);
            qc.invalidateQueries({ queryKey: ["bookings"] }).catch((err) => {
              console.error("[SalesBookingsTable] invalidateQueries error:", err);
            });
            qc.invalidateQueries({ queryKey: ["booking-approvals"] }).catch((err) => {
              console.error("[SalesBookingsTable] invalidateQueries error:", err);
            });
            qc.invalidateQueries({ queryKey: ["groups"] }).catch((err) => {
              console.error("[SalesBookingsTable] invalidateQueries error:", err);
            });
          }}
          stepId={approveModal.stepId}
          stepLabel={approveModal.stepLabel}
          packageName={approveModal.bookingName}
        />
      )}
    </>
  );
}
