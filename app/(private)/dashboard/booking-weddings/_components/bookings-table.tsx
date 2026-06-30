"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar as CalendarDays, ArrowLeft, ArrowRight, Magnifer as Search, Eye, Refresh, MenuDots as EllipsisVertical, TrashBinTrash as Trash2, CloseSquare as SquareX, Pen as Pencil, TransferHorizontal as ArrowLeftRight, FileText as FileSignature, Printer, FileSend as FileUp, ChatRound as MessageSquare, ClipboardCheck, AddCircle, UsersGroupRounded, Filter, DocumentText, Widget, UserCircle, TagPrice, Gift, Tag, HandMoney } from "@solar-icons/react";
const RotateCcw = Refresh;
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter as useNextRouter } from "next/navigation";
import { useBookings, useDeleteBooking } from "@/hooks/use-bookings";
import { usePermissions } from "@/hooks/use-permissions";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AgreementModal } from "@/components/shared/booking/agreement-modal";
import { RejectBookingModal } from "@/components/shared/booking/reject-booking-modal";
import { MarkLostDialog } from "@/components/shared/booking/mark-lost-dialog";
import { RestoreBookingDialog } from "@/components/shared/booking/restore-booking-dialog";
import { TransferBookingModal } from "@/components/shared/booking/transfer-booking-modal";
import { TransferManagerModal } from "@/components/shared/booking/transfer-manager-modal";
import { UploadDocumentModal } from "./upload-document-modal";
import { ActivityLogModal } from "./activity-log-modal";
import { BookingDetailModal } from "./booking-detail-modal";
import { EditBookingDrawer } from "./edit-booking-drawer";
import { BookingPOPreviewModal, type BookingPOPreviewTarget } from "./booking-po-preview-modal";
import { BookingCommentPanel } from "./booking-comment-panel";
import { BookingTCDrawer } from "./booking-tc-drawer";
import { EditPackageDrawer, type EditPackageTarget } from "./EditPackageDrawer";
import { SetHargaBookingDrawer } from "./SetHargaBookingDrawer";
import { EditComplimentaryDrawer, type EditComplimentaryTarget } from "./EditComplimentaryDrawer";
import { EditTakeoutDrawer } from "@/app/(private)/dashboard/booking-weddings/_components/EditTakeoutDrawer";
import { EditTopDrawerById } from "@/app/(private)/dashboard/booking-weddings/_components/edit-top-drawer";
import { useUnreadCommentCounts } from "@/hooks/use-unread-comment-counts";
import { fetchBookingComments } from "@/services/booking-comment-service";
import { fetchBookingDetail } from "@/services/booking-detail-service";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ApproveModal } from "@/app/(private)/dashboard/packages/_components/approve-modal";
import { ApprovalDialog } from "@/app/(private)/dashboard/packages/_components/approval-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { BookingsResult, BookingListItem, SalesProfile } from "@/lib/queries/bookings";

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

const SESSION_STYLE: Record<string, string> = {
  morning: "bg-muted text-foreground/70",
  evening: "bg-muted text-foreground/70",
  fullday: "bg-muted text-foreground/70",
};

const SESSION_LABEL: Record<string, string> = {
  morning: "Pagi",
  evening: "Malam",
  fullday: "Fullday",
};


function fmtRp(n: unknown) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(n))}`;
}

/** Returns a page range array with "..." for gaps.
 *  Always shows: first, last, current, and 1 neighbour each side.
 *  Example (current=50, total=150): [1, "...", 49, 50, 51, "...", 150]
 */
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

const ROWS_PER_PAGE = 10;

export function BookingsTable({ initialData, salesProfiles }: { initialData: BookingsResult; salesProfiles: SalesProfile[] }) {
  const qc = useQueryClient();
  const deleteMut = useDeleteBooking();
  const { can, isAdmin } = usePermissions();
  const { openBookingDrawer } = useBookingDrawer();
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const routerNav = useNextRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [salesFilter, setSalesFilter] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState<"saved" | "draft" | "all">("saved");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [approvalFilter, setApprovalFilter] = useState<"pending" | "approved" | "">("");

  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["venues-list"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: result = initialData, refetch, isFetching, isLoading, isPlaceholderData } = useBookings(
    { page: currentPage, pageSize: ROWS_PER_PAGE, search: debouncedSearch, venueId: venueFilter || undefined, recordStatus: recordStatusFilter, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, approvalStatus: approvalFilter || undefined, salesId: salesFilter || undefined },
    initialData,
  );
  // Show shimmer on initial load AND while transitioning pages/filters (keepPreviousData
  // keeps the old rows mounted, so isPlaceholderData is the signal for that transition).
  const isTableLoading = isLoading || isPlaceholderData;
  const bookings = result.data;
  const totalBookings = result.total;
  const totalPages = Math.ceil(totalBookings / ROWS_PER_PAGE);
  const [approveModal, setApproveModal] = useState<{ stepId: string; stepLabel: string; bookingName: string } | null>(null);
  const [approvalDialogTarget, setApprovalDialogTarget] = useState<BookingListItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null);
  const [editTarget, setEditTarget] = useState<BookingListItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BookingListItem | null>(null);
  const [lostTarget, setLostTarget] = useState<BookingListItem | null>(null);
  const [transferTarget, setTransferTarget] = useState<BookingListItem | null>(null);
  const [uploadDocTarget, setUploadDocTarget] = useState<BookingListItem | null>(null);
  const [managerTarget, setManagerTarget] = useState<BookingListItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BookingListItem | null>(null);
  const [activityLogTarget, setActivityLogTarget] = useState<BookingListItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  // Warm the detail modal's cache on hover/focus so opening a row is instant
  // (shares the ["booking-detail", id] key + staleTime with useBookingDetail).
  const prefetchDetail = (id: string) => {
    qc.prefetchQuery({ queryKey: ["booking-detail", id], queryFn: () => fetchBookingDetail(id), staleTime: 30_000 });
  };
  // Mark a booking's cached detail stale after a mutation so the next open/refresh
  // refetches fresh data instead of serving a pre-mutation snapshot.
  const invalidateDetail = (id: string) => {
    qc.invalidateQueries({ queryKey: ["booking-detail", id] });
  };
  const [commentTarget, setCommentTarget] = useState<BookingListItem | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [poPreviewTarget, setPoPreviewTarget] = useState<BookingPOPreviewTarget | null>(null);
  const [revisionCache, setRevisionCache] = useState<Record<string, { id: string; revisionNumber: number; reason: string | null; packageName: string; pax: number | null; price: number | null; createdAt: string }[]>>({});
  const [agreementModal, setAgreementModal] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [tcTarget, setTcTarget] = useState<{ bookingId: string; customerName: string; initialTC: string | null } | null>(null);
  const [editPackageTarget, setEditPackageTarget] = useState<EditPackageTarget | null>(null);
  const [setHargaTarget, setSetHargaTarget] = useState<{ bookingId: string; customerName: string; packageName: string; pax: number; venueName?: string } | null>(null);
  const [editComplimentaryTarget, setEditComplimentaryTarget] = useState<EditComplimentaryTarget | null>(null);
  const [editTakeoutTarget, setEditTakeoutTarget] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [editTopTarget, setEditTopTarget] = useState<{ bookingId: string; customerName: string } | null>(null);
  // Approval records now ride along on each booking row (Fix #1: getBookings attaches
  // booking.bookingApprovals for the active page only), so no separate fetch of ALL
  // approval records is needed here. Build the entityId → record map from the list.
  const approvalMap = new Map(
    bookings
      .map((b: BookingListItem) => b.bookingApprovals)
      .filter((r): r is NonNullable<BookingListItem["bookingApprovals"]> => r !== null)
      .map((r) => [r.entityId, r]),
  );

  const APPROVAL_STATUS_OPTIONS: { id: "" | "pending" | "approved"; name: string }[] = [
    { id: "", name: "Semua" },
    { id: "pending", name: "Pending" },
    { id: "approved", name: "Approved" },
  ];

  // Open the PO preview in a modal (no new tab). The modal fetches + renders
  // the PDF itself; here we just point it at the booking / revision.
  function previewPO(booking: BookingListItem, revisionId?: string, revLabel?: string) {
    const base = booking.snapCustomer?.name ?? "Booking";
    setPoPreviewTarget({
      bookingId: booking.id,
      revisionId,
      label: revLabel ? `${base} · ${revLabel}` : base,
    });
  }

  function fetchRevisions(bookingId: string) {
    fetch(`/api/bookings/${bookingId}/revisions`).then((r) => r.json()).then((res) => {
      const items = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setRevisionCache((p) => ({ ...p, [bookingId]: items }));
    }).catch(() => {});
  }


  const { data: countData } = useUnreadCommentCounts(bookings.map((b: BookingListItem) => b.id));
  const unreadCounts = countData?.unreadCounts ?? {};
  const mentionCounts = countData?.mentionCounts ?? {};

  // Handle deep-link dari notification mention: ?bookingId=X&openComments=true&highlightComment=Y
  useEffect(() => {
    const bookingId = searchParams.get("bookingId");
    const openComments = searchParams.get("openComments");
    const highlightComment = searchParams.get("highlightComment");
    if (!bookingId || openComments !== "true" || !bookings.length) return;
    const target = bookings.find((b: BookingListItem) => b.id === bookingId);
    if (!target) return;
    setCommentTarget(target);
    if (highlightComment) setHighlightCommentId(highlightComment);
    const url = new URL(window.location.href);
    url.searchParams.delete("bookingId");
    url.searchParams.delete("openComments");
    url.searchParams.delete("highlightComment");
    const cleanSearch = url.search === "?" ? "" : url.search;
    routerNav.replace(url.pathname + cleanSearch, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, bookings.length]);

  // ---------------------------------------------------------------------------
  // Shared helpers — used by both desktop renderBookingActions AND mobile bar
  // ---------------------------------------------------------------------------

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
    const isManagerApproved = currentRoundSteps.some((s) => s.approverRole?.name === "manager" && s.status === "approved");
    const isFinanceApproved = currentRoundSteps.some((s) => s.approverRole?.name === "finance" && s.status === "approved");
    const internalApproved = isManagerApproved && isFinanceApproved;
    return { hasPending, internalApproved };
  }

  /** Returns true when there are non-client approval steps in the current revision
   *  that are NOT all approved yet (i.e. approval is still pending). */
  function hasPendingApproval(booking: BookingListItem): boolean {
    return getBookingApprovalState(booking).hasPending;
  }

  /** Renders the DropdownMenuItems for the Approval dropdown (shared between desktop & mobile). */
  function renderApprovalItems(booking: BookingListItem): React.ReactNode {
    if (!approvalMap.has(booking.id)) return null;
    const record = approvalMap.get(booking.id)!;
    const allSteps = record.steps;
    const bHasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
    const steps = (booking.currentRevisionId && bHasRevisionedSteps)
      ? allSteps.filter((s) => s.revisionId === booking.currentRevisionId)
      : allSteps;
    return (
      <>
        {steps.filter((s) => s.approverType !== "client").map((step) => {
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
                  setApproveModal({ stepId: step.id, stepLabel: label ?? "Unknown", bookingName: booking.snapCustomer?.name ?? "Booking" });
                }
              }}
            >
              {isApproved ? `✓ ${label}` : isRejected ? `✗ ${label}` : `Approve ${label}`}
            </DropdownMenuItem>
          );
        })}
      </>
    );
  }

  /** Renders the DropdownMenuItems for the PO preview dropdown (shared between desktop & mobile). */
  function renderPoItems(booking: BookingListItem): React.ReactNode {
    return (
      <>
        <DropdownMenuItem className="cursor-pointer" onClick={() => previewPO(booking)}>
          Lihat Terbaru (Live)
        </DropdownMenuItem>
        {(revisionCache[booking.id] ?? []).length > 0 && <DropdownMenuSeparator />}
        {(revisionCache[booking.id] ?? []).map((rev) => (
          <DropdownMenuItem key={rev.id} className="cursor-pointer" onClick={() => previewPO(booking, rev.id, `Rev ${rev.revisionNumber}`)}>
            <span className="truncate">Rev {rev.revisionNumber} — {rev.packageName}{rev.pax ? ` · ${rev.pax} PAX` : ""}</span>
          </DropdownMenuItem>
        ))}
      </>
    );
  }

  /** Renders the DropdownMenuItems for the More dropdown (shared between desktop & mobile). */
  function renderMoreItems(booking: BookingListItem): React.ReactNode {
    return (
      <>
        <DropdownMenuItem className="cursor-pointer" onClick={() => setDetailTarget(booking.id)} onMouseEnter={() => prefetchDetail(booking.id)} onFocus={() => prefetchDetail(booking.id)}>
          <Eye weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Lihat Detail
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {can("booking", "edit") && (
          <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditTarget(booking); }}>
            <Pencil weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Edit Booking
          </DropdownMenuItem>
        )}
        {can("booking", "edit-package") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Rejected" && booking.bookingStatus !== "Canceled" && (
          <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditPackageTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer" }); }}>
            <Widget weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Edit Package
          </DropdownMenuItem>
        )}
        {can("booking", "edit-package") && (
          <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditComplimentaryTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer" }); }}>
            <Gift weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Edit Complimentary
          </DropdownMenuItem>
        )}
        {can("booking", "edit") && (
          <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditTakeoutTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer" }); }}>
            <Tag weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Edit Takeout
          </DropdownMenuItem>
        )}
        {can("booking", "edit") && (
          <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditTopTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer" }); }}>
            <HandMoney weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Edit TOP
          </DropdownMenuItem>
        )}
        {can("booking", "edit-set-harga") && (
          <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSetHargaTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer", packageName: booking.snapPackage?.packageName ?? booking.snapPackagePricing?.packageName ?? "Package", pax: booking.snapPackagePricing?.pax ?? 0, venueName: booking.snapVenue?.venueName ?? undefined }); }}>
            <TagPrice weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Set Harga
          </DropdownMenuItem>
        )}
        {can("booking", "term-&-condition") && (
          <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setTcTarget({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Customer", initialTC: booking.snapPackagePricing?.termAndCondition ?? null }); }}>
            <DocumentText weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Term & Condition
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="cursor-pointer" onClick={() => setUploadDocTarget(booking)}>
          <FileUp weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Upload Dokumen
        </DropdownMenuItem>
        {can("booking", "transfer") && (
          <DropdownMenuItem className="cursor-pointer" onClick={() => setTransferTarget(booking)}>
            <ArrowLeftRight weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Transfer Booking
          </DropdownMenuItem>
        )}
        {can("booking", "transfer-manager") && (
          <DropdownMenuItem className="cursor-pointer" onClick={() => setManagerTarget(booking)}>
            <UsersGroupRounded weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Transfer Manager
          </DropdownMenuItem>
        )}
        {((can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost") || (can("booking", "mark-lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed") || (can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed"))) && <DropdownMenuSeparator />}
        {can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost" && (
          <DropdownMenuItem className="cursor-pointer" onClick={() => setRejectTarget(booking)}>
            <SquareX weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-destructive')} /> Reject Booking
          </DropdownMenuItem>
        )}
        {can("booking", "mark-lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed" && (
          <DropdownMenuItem className={cn('cursor-pointer', 'text-muted-foreground', 'focus:text-foreground')} onClick={() => setLostTarget(booking)}>
            <SquareX weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4')} /> Lost Booking
          </DropdownMenuItem>
        )}
        {can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed") && (
          <DropdownMenuItem className={cn('cursor-pointer', 'text-muted-foreground', 'focus:text-foreground')} onClick={() => setRestoreTarget(booking)}>
            <RotateCcw weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4')} /> Restore Booking
          </DropdownMenuItem>
        )}
        {can("booking", "delete") && <DropdownMenuSeparator />}
        {can("booking", "delete") && (
          <DropdownMenuItem className={cn('cursor-pointer', 'text-destructive', 'focus:text-destructive')} onClick={() => setDeleteTarget(booking)}>
            <Trash2 weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-destructive')} /> Hapus
          </DropdownMenuItem>
        )}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Desktop action cell renderer (TABLE view — sm and above)
  // ---------------------------------------------------------------------------
  function renderBookingActions(booking: BookingListItem) {
    // Draft rows: show only a delete action (resume happens via row click)
    if (booking.recordStatus === "draft") {
      return (
        <>
          {can("booking", "delete") && (
            <DropdownMenu>
              <DropdownMenuTrigger className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}>
                <EllipsisVertical weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground')} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className={cn('cursor-pointer', 'text-destructive', 'focus:text-destructive')}
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(booking); }}
                >
                  <Trash2 weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-destructive')} /> Hapus Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      );
    }

    // Client Agreement is gated on internal approval: it appears only after BOTH
    // the manager and finance approval steps (current revision) are approved.
    // Filter steps by currentRevisionId (snapshot approach).
    // Backward compat: if booking has no currentRevisionId OR all steps have null revisionId,
    // fall back to showing all steps (legacy data before this feature).
    const allAgreementSteps = approvalMap.get(booking.id)?.steps ?? [];
    // booking.currentRevisionId is a scalar field returned by Prisma `include` — no cast needed.
    const currentRevisionId = booking.currentRevisionId;
    const hasRevisionedSteps = allAgreementSteps.some((s) => s.revisionId !== null);
    const currentRoundSteps = (currentRevisionId && hasRevisionedSteps)
      ? allAgreementSteps.filter((s) => s.revisionId === currentRevisionId)
      : allAgreementSteps;
    const isManagerApproved = currentRoundSteps.some((s) => s.approverRole?.name === "manager" && s.status === "approved");
    const isFinanceApproved = currentRoundSteps.some((s) => s.approverRole?.name === "finance" && s.status === "approved");
    const internalApproved = isManagerApproved && isFinanceApproved;
    return (
      <>
        {/* Agreement modal trigger — hidden on mobile. Shown only once manager +
            finance approved, and hidden again after the client has signed. */}
        {can("booking", "client-agreement") && internalApproved && booking.clientAgreement?.status !== "Signed" && (
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" className={cn('cursor-pointer', 'hidden', 'sm:inline-flex')} onClick={(e) => { e.stopPropagation(); setAgreementModal({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Client" }); }} />}>
              <FileSignature weight="BoldDuotone" className={cn('h-4', 'w-4')} />
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">Client Agreement</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        )}

        {/* Booking Approval dropdown */}
        {approvalMap.has(booking.id) && hasPendingApproval(booking) && (
          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}>
                  <ClipboardCheck weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-primary')} />
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent side="top"><p className="text-xs">Approval</p></TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              {renderApprovalItems(booking)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Comment button — placed last, right before the More actions menu */}
        <PermissionGate module="booking" action="comment">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" className={cn('cursor-pointer', 'relative')} onClick={() => setCommentTarget(booking)} onMouseEnter={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }} onFocus={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }} />}>
              <MessageSquare weight="BoldDuotone" className={cn('h-4', 'w-4')} />
              {/* Badge merah — unread biasa */}
              {(unreadCounts[booking.id] ?? 0) > 0 && (
                <span className={cn('absolute', '-top-0.5', '-right-0.5', 'min-w-4', 'h-4', 'rounded-full', 'bg-destructive', 'text-destructive-foreground', 'text-[9px]', 'font-bold', 'flex', 'items-center', 'justify-center', 'px-0.5')}>
                  {unreadCounts[booking.id] > 9 ? "9+" : unreadCounts[booking.id]}
                </span>
              )}
              {/* Badge @ emas — unread mentions, sendiri di top-right */}
              {(mentionCounts[booking.id] ?? 0) > 0 && (unreadCounts[booking.id] ?? 0) === 0 && (
                <span
                  className={cn('absolute', '-top-0.5', '-right-0.5', 'min-w-4', 'h-4', 'rounded-full', 'text-[9px]', 'font-bold', 'flex', 'items-center', 'justify-center', 'px-0.5', 'text-white')}
                  style={{ backgroundColor: "var(--brand-gold)" }}
                >
                  @
                </span>
              )}
              {/* Badge @ emas — ada bersamaan dengan unread biasa, posisi bottom-right */}
              {(mentionCounts[booking.id] ?? 0) > 0 && (unreadCounts[booking.id] ?? 0) > 0 && (
                <span
                  className={cn('absolute', '-bottom-0.5', '-right-0.5', 'min-w-4', 'h-4', 'rounded-full', 'text-[9px]', 'font-bold', 'flex', 'items-center', 'justify-center', 'px-0.5', 'text-white')}
                  style={{ backgroundColor: "var(--brand-gold)" }}
                >
                  @
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">Komentar{(mentionCounts[booking.id] ?? 0) > 0 ? " · Ada mention" : ""}</p></TooltipContent>
          </Tooltip>
        </PermissionGate>

        {/* Preview PO — standalone icon button. Click opens a dropdown with the
            live PO plus any saved revisions. Available regardless of approval
            status; opens in a modal (no new tab). */}
        <DropdownMenu onOpenChange={(open) => { if (open) fetchRevisions(booking.id); }}>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}>
                <Printer weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-primary')} />
              </TooltipTrigger>
            </DropdownMenuTrigger>
            <TooltipContent side="top"><p className="text-xs">Preview PO</p></TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {renderPoItems(booking)}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* More actions dropdown */}
        <DropdownMenu>
          <Tooltip>
            <DropdownMenuTrigger asChild>
              <TooltipTrigger className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')}>
                <EllipsisVertical weight="BoldDuotone" className={cn('h-4', 'w-4', 'text-muted-foreground')} />
              </TooltipTrigger>
            </DropdownMenuTrigger>
            <TooltipContent side="top"><p className="text-xs">Lainnya</p></TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            {renderMoreItems(booking)}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteMut.mutateAsync(deleteTarget.id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Booking dihapus."); refetch(); }
    setDeleteTarget(null);
  }

  const hasVenueFilter = venueFilter !== "" && venueFilter !== "all";
  const hasSalesFilter = salesFilter !== "";
  const hasRecordStatusFilter = recordStatusFilter !== "saved";
  const hasDateFilter = dateFrom !== "" || dateTo !== "";
  const hasApprovalFilter = approvalFilter !== "";
  const activeFilterCount = (hasVenueFilter ? 1 : 0) + (hasSalesFilter ? 1 : 0) + (hasRecordStatusFilter ? 1 : 0) + (hasDateFilter ? 1 : 0) + (hasApprovalFilter ? 1 : 0);
  const hasActiveFilter = activeFilterCount > 0;

  const RECORD_STATUS_OPTIONS: { id: "saved" | "draft" | "all"; name: string }[] = [
    { id: "saved", name: "Saved" },
    { id: "draft", name: "Draft" },
    { id: "all", name: "Semua" },
  ];

  const FilterPopoverContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filter</p>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => { setVenueFilter(""); setSalesFilter(""); setRecordStatusFilter("saved"); setDateFrom(""); setDateTo(""); setApprovalFilter(""); setCurrentPage(1); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Venue</label>
        <SearchableSelect
          options={[
            { id: "all", name: "Semua Venue" },
            ...venues.map((v) => ({ id: v.id, name: v.name })),
          ]}
          value={venueFilter || "all"}
          onChange={(val) => { setVenueFilter(val === "all" ? "" : val); setCurrentPage(1); }}
          placeholder="Semua Venue"
          searchPlaceholder="Cari venue..."
          emptyText="Venue tidak ditemukan"
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Sales</label>
        <SearchableSelect
          options={[
            { id: "", name: "Semua Sales" },
            ...salesProfiles.map((s) => ({ id: s.id, name: s.fullName ?? s.id })),
          ]}
          value={salesFilter || ""}
          onChange={(val) => { setSalesFilter(val); setCurrentPage(1); }}
          placeholder="Semua Sales"
          searchPlaceholder="Cari sales..."
          emptyText="Sales tidak ditemukan"
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status Data</label>
        <SearchableSelect
          options={RECORD_STATUS_OPTIONS}
          value={recordStatusFilter}
          onChange={(val) => { setRecordStatusFilter(val as "saved" | "draft" | "all"); setCurrentPage(1); }}
          placeholder="Saved"
          searchPlaceholder="Cari status..."
          emptyText="Status tidak ditemukan"
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Event Date</label>
        <div className="flex items-center gap-2">
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
                    // Local day-start as a UTC instant — matches how eventDate is
                    // stored (local date → toISOString); avoids off-by-one in non-UTC TZ.
                    setDateFrom(startOfDay(range.from).toISOString());
                    // Single date (no `to` yet): filter that day only — local day-end
                    // of the SAME date as inclusive upper bound.
                    setDateTo(endOfDay(range.to ?? range.from).toISOString());
                  } else {
                    setDateFrom("");
                    setDateTo("");
                  }
                  setCurrentPage(1);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        {hasDateFilter && (
          <button
            type="button"
            onClick={() => { setDateFrom(""); setDateTo(""); setCurrentPage(1); }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            Hapus filter tanggal
          </button>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status Approval</label>
        <SearchableSelect
          options={APPROVAL_STATUS_OPTIONS}
          value={approvalFilter || ""}
          onChange={(val) => { setApprovalFilter(val as "pending" | "approved" | ""); setCurrentPage(1); }}
          placeholder="Semua"
          searchPlaceholder="Cari status approval..."
          emptyText="Status tidak ditemukan"
          className="h-9"
        />
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* ════════════════════════════════════════════════════════════════
              MOBILE TOOLBAR  (visible < sm)
              Row 1: [count badge] ──── [filter icon] [refresh icon] [add button]
              Row 2: [search full-width]
          ════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-2 px-4 pb-3 border-b sm:hidden">
            {/* Row 1 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
                {totalBookings}
              </span>
              <div className="flex-1" />
              {/* Filter popover */}
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn("shrink-0 relative", hasActiveFilter && "border-primary/50")}
                      aria-label="Filter booking"
                    >
                      <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                      {hasActiveFilter && (
                        <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                          {activeFilterCount}
                        </span>
                      )}
                    </Button>
                  }
                />
                <PopoverContent align="end" className="w-72 p-3">
                  {FilterPopoverContent}
                </PopoverContent>
              </Popover>
              {/* Refresh */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => { refetch(); }}
                disabled={isFetching}
                aria-label="Muat ulang data booking"
                className="shrink-0"
              >
                <Refresh weight="BoldDuotone" aria-hidden="true" className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
              {/* Add */}
              {can("booking", "create") && (
                <Button size="icon" onClick={() => openBookingDrawer()} className="shrink-0" aria-label="Tambah booking">
                  <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                </Button>
              )}
            </div>
            {/* Row 2: Search full-width */}
            <div className="relative w-full">
              <Search weight="BoldDuotone" aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari booking..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full" />
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DESKTOP TOOLBAR  (visible sm+)
              Single row: [count] | [refresh] [filter] [search] →→ [add]
          ════════════════════════════════════════════════════════════════ */}
          <div className="hidden sm:flex items-center gap-2 px-6 pb-3 border-b">
            {/* Count badge */}
            <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full shrink-0">
              {totalBookings} Bookings
            </span>

            {/* Divider */}
            <div className="w-px h-5 bg-border shrink-0 mx-1" aria-hidden="true" />

            {/* Refresh */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["booking-approvals"] }); }}
              disabled={isFetching}
              aria-label="Muat ulang data booking"
              title="Muat ulang"
              className="shrink-0"
            >
              <Refresh weight="BoldDuotone" aria-hidden="true" className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>

            {/* Filter popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("h-9 gap-1.5 shrink-0", hasActiveFilter && "border-primary/50")}
                    aria-label="Filter booking"
                  >
                    <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                    Filter
                    {hasActiveFilter && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-72 p-3">
                {FilterPopoverContent}
              </PopoverContent>
            </Popover>

            {/* Search */}
            <div className="relative">
              <Search weight="BoldDuotone" aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari booking..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-52" />
            </div>

            {/* Add — pushed to far right */}
            {can("booking", "create") && (
              <Button onClick={() => openBookingDrawer()} className="ml-auto shrink-0 cursor-pointer">
                <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                Tambah Booking
              </Button>
            )}
          </div>

          {/* Table */}
          {isTableLoading ? (
            <>
              {/* Desktop skeleton — mirrors the real table columns/visibility */}
              <div className={cn('hidden', 'sm:block', 'w-full', 'overflow-x-auto')}>
                <Table className={cn('w-full', 'text-sm')}>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'text-center', 'w-[3%]', 'hidden', 'sm:table-cell')}>No</TableHead>
                      <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground')}>Customer</TableHead>
                      <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'sm:table-cell', 'w-[15%]')}>Venue & PO</TableHead>
                      <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'lg:table-cell', 'w-[14%]')}>Package</TableHead>
                      <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'sm:table-cell', 'w-[10%]')}>Event Date</TableHead>
                      <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'lg:table-cell', 'w-[8%]')}>Activity</TableHead>
                      <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'lg:table-cell', 'w-[8%]')}>Approval</TableHead>
                      <TableHead className={cn('px-1', 'py-2', 'text-muted-foreground', 'text-right', 'pr-5', 'w-[15%]')}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: ROWS_PER_PAGE }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className={cn('px-2', 'py-2', 'text-center', 'hidden', 'sm:table-cell')}>
                          <Skeleton className="h-4 w-5 mx-auto" />
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2')}>
                          <Skeleton className="h-4 w-32 mb-1.5" />
                          <Skeleton className="h-3 w-24" />
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2', 'hidden', 'sm:table-cell')}>
                          <Skeleton className="h-4 w-24 mb-1.5" />
                          <Skeleton className="h-3 w-20" />
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2', 'hidden', 'lg:table-cell')}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2', 'hidden', 'sm:table-cell')}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2', 'hidden', 'lg:table-cell')}>
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                        <TableCell className={cn('px-2', 'py-2', 'hidden', 'lg:table-cell')}>
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell className={cn('px-1', 'py-2')}>
                          <div className={cn('flex', 'items-center', 'justify-end', 'gap-1.5', 'pr-4')}>
                            <Skeleton className="h-7 w-7 rounded-md" />
                            <Skeleton className="h-7 w-7 rounded-md" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile skeleton — mirrors the card layout */}
              <div className={cn('block', 'sm:hidden', 'p-4', 'space-y-3')}>
                {Array.from({ length: ROWS_PER_PAGE }).map((_, i) => (
                  <div key={i} className={cn('rounded-lg', 'border', 'bg-card', 'p-3', 'space-y-2')}>
                    <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-24" />
                    <div className={cn('flex', 'items-center', 'justify-end', 'gap-1.5', 'pt-1')}>
                      <Skeleton className="h-7 w-7 rounded-md" />
                      <Skeleton className="h-7 w-7 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : bookings.length === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-muted-foreground')}>
              <CalendarDays weight="BoldDuotone" className={cn('h-10', 'w-10', 'mb-3', 'opacity-40')} />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : hasApprovalFilter ? "Tidak ada booking yang cocok dengan filter approval." : recordStatusFilter === "draft" ? "Tidak ada draft booking." : "Belum ada booking."}</p>
            </div>
          ) : (
            <>
            <div className={cn('hidden', 'sm:block', 'w-full', 'overflow-x-auto')}>
              <Table className={cn('w-full', 'text-sm')}>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'text-center', 'w-[3%]', 'hidden', 'sm:table-cell')}>No</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground')}>Customer</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'sm:table-cell', 'w-[15%]')}>Venue & PO</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'lg:table-cell', 'w-[14%]')}>Package</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'sm:table-cell', 'w-[10%]')}>Event Date</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'lg:table-cell', 'w-[8%]')}>Activity</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-muted-foreground', 'hidden', 'lg:table-cell', 'w-[8%]')}>Approval</TableHead>
                    <TableHead className={cn('px-1', 'py-2', 'text-muted-foreground', 'text-right', 'pr-5', 'w-[15%]')}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking: BookingListItem, idx: number) => (
                    <TableRow
                      key={booking.id}
                      className={cn('hover:bg-muted/40', 'cursor-pointer')}
                      onMouseEnter={() => { if (booking.recordStatus !== "draft") prefetchDetail(booking.id); }}
                      onClick={() => {
                        if (booking.recordStatus === "draft") {
                          openBookingDrawer({ resumeMode: true, initialDraftId: booking.id, onSuccess: () => { void refetch(); } });
                        } else {
                          setDetailTarget(booking.id);
                        }
                      }}
                    >
                      <TableCell className={cn('px-2', 'py-2', 'text-center', 'hidden', 'sm:table-cell')}>{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>

                      {/* Customer cell */}
                      <TableCell className={cn('px-2', 'py-2')}>
                        <div className="overflow-hidden max-w-0 min-w-full">
                          <p className={cn('text-sm', 'font-medium', 'text-foreground', 'truncate')}>{booking.snapCustomer?.name ?? booking.customer?.name ?? "—"}</p>
                          <Tooltip>
                            <TooltipTrigger className="block truncate w-full text-left text-xs text-muted-foreground mt-0.5">
                              {(() => {
                                const raw = booking.snapCustomer?.mobileNumber ?? (typeof booking.customer?.mobileNumber === "string" ? booking.customer.mobileNumber : JSON.stringify(booking.customer?.mobileNumber ?? "")) ?? "";
                                try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr.map((e: { name?: string; number: string }) => e.name ? `${e.name}: ${e.number}` : e.number).join(", "); } catch { /* not JSON */ }
                                return raw;
                              })()}
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="max-w-72">
                              <ul className="space-y-1">
                                {(() => {
                                  const raw = booking.snapCustomer?.mobileNumber ?? (typeof booking.customer?.mobileNumber === "string" ? booking.customer.mobileNumber : JSON.stringify(booking.customer?.mobileNumber ?? "")) ?? "";
                                  let nums: { name?: string; number: string }[] = [];
                                  try { const arr = JSON.parse(raw); if (Array.isArray(arr)) nums = arr; } catch { nums = raw.split(/[,\n]+/).map((s: string) => ({ number: s.trim() })).filter((e) => e.number); }
                                  return nums.map((e, i) => <li key={i} className="text-sm">{e.name ? <><span className="text-muted-foreground">{e.name}:</span> {e.number}</> : e.number}</li>);
                                })()}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                          {/* Event date — tablet only (date col shown at sm) */}
                          <p className={cn('text-xs', 'text-muted-foreground', 'mt-0.5', 'sm:hidden')}>{booking.eventDate ? format(new Date(booking.eventDate), "dd MMM yyyy") : "—"}</p>
                          <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-1', 'mt-1')}>
                            {/* Draft badge — shown when recordStatus is draft */}
                            {booking.recordStatus === "draft" && (
                              <span className={cn('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded-full', 'border', 'border-border', 'bg-secondary', 'text-secondary-foreground', 'text-[10px]', 'font-semibold')}>
                                Draft
                              </span>
                            )}
                            {/* Edit-in-progress badge — booking has uncommitted material changes */}
                            {booking.editDraft && (
                              <span className={cn('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded-full', 'border', 'border-border', 'bg-secondary', 'text-secondary-foreground', 'text-[10px]', 'font-semibold')}>
                                Sedang diedit
                              </span>
                            )}
                            {/* Status badge */}
                            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-background", STATUS_TEXT[booking.bookingStatus] ?? "text-muted-foreground border-border")}>
                              <span className={cn("w-1 h-1 rounded-full mr-1", STATUS_DOT[booking.bookingStatus] ?? "bg-muted-foreground")} />
                              {booking.bookingStatus}
                            </span>
                            {/* Payment method badge */}
                            <span className={cn('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded-full', 'border', 'border-border', 'bg-muted', 'text-muted-foreground', 'text-[10px]', 'font-medium')}>
                              {booking.paymentMethod?.bankName ?? "N/A"}
                            </span>
                            {/* Session badge */}
                            {booking.weddingSession && (
                              <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium", SESSION_STYLE[booking.weddingSession] ?? "bg-muted text-muted-foreground")}>
                                {SESSION_LABEL[booking.weddingSession] ?? booking.weddingSession}
                              </span>
                            )}
                            {/* Source of information badge */}
                            {booking.sourceOfInformation?.name && (
                              <span className={cn('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded-full', 'text-[10px]', 'font-medium', 'bg-muted', 'text-muted-foreground')}>
                                {booking.sourceOfInformation.name}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActivityLogTarget(booking); }}
                            className={cn('cursor-pointer', 'mt-1', 'text-[10px]', 'text-muted-foreground', 'hover:text-foreground', 'underline', 'underline-offset-2', 'text-left', 'lg:hidden')}
                          >
                            Lihat Activity
                          </button>
                        </div>
                      </TableCell>

                      {/* Venue cell */}
                      <TableCell className={cn('px-2', 'py-2', 'hidden', 'sm:table-cell')}>
                        <div className="leading-tight">
                          <span className={cn('block', 'truncate', 'text-sm', 'font-medium')}>{booking.snapVenue?.venueName ?? "—"}</span>
                          <div className="mt-0.5">
                            {booking.poNumber ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(booking.poNumber!); toast.success("PO Number copied!", { duration: 1500 }); }}
                                className={cn('inline-flex', 'items-center', 'max-w-full', 'px-1.5', 'py-0.5', 'rounded', 'bg-muted', 'text-[10px]', 'font-mono', 'text-muted-foreground', 'hover:bg-muted/80', 'transition-colors', 'cursor-pointer', 'truncate')}
                              >
                                <span className="truncate">{booking.poNumber}</span>
                              </button>
                            ) : (
                              <span className={cn('text-muted-foreground', 'text-[10px]')}>No PO</span>
                            )}
                          </div>
                          {booking.sales?.fullName && (
                            <div className={cn('flex', 'items-center', 'gap-0.5', 'mt-1', 'text-[10px]', 'text-muted-foreground')}>
                              <UserCircle weight="BoldDuotone" className="h-3 w-3 shrink-0" />
                              <span className="truncate">{booking.sales.fullName}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Package cell */}
                      <TableCell className={cn('px-2', 'py-2', 'hidden', 'lg:table-cell')}>
                        <div className="leading-tight">
                          <span className={cn('truncate', 'block')}>{booking.snapPackage?.packageName ?? "—"}</span>
                          {booking.snapPackagePricing && (
                            <span className={cn('text-xs', 'text-muted-foreground', 'block')}>{booking.snapPackagePricing.pax} PAX · {fmtRp(Math.max(0, Number(booking.snapPackagePricing.price) - (booking.discountAmount ?? 0)))}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Event Date */}
                      <TableCell className={cn('px-2', 'py-2', 'whitespace-nowrap', 'text-sm', 'hidden', 'sm:table-cell')}>
                        {booking.eventDate ? format(new Date(booking.eventDate), "MMM dd, yyyy") : "—"}
                      </TableCell>

                      {/* Activity */}
                      <TableCell className={cn('px-2', 'py-2', 'hidden', 'lg:table-cell')}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActivityLogTarget(booking); }}
                          className={cn('cursor-pointer', 'text-xs', 'text-muted-foreground', 'hover:text-foreground', 'underline', 'underline-offset-2')}
                        >
                          Lihat Activity
                        </button>
                      </TableCell>

                      {/* Approval */}
                      <TableCell className={cn('px-2', 'py-2', 'hidden', 'lg:table-cell')} onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const record = approvalMap.get(booking.id);
                          if (!record) return <span className={cn('text-xs', 'text-muted-foreground')}>—</span>;
                          return (
                            <button
                              type="button"
                              onClick={() => setApprovalDialogTarget(booking)}
                              className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                                record.status === "approved" && "bg-primary text-primary-foreground",
                                record.status === "pending" && "bg-muted text-muted-foreground",
                                record.status === "rejected" && "bg-destructive/10 text-destructive",
                              )}
                            >
                              {record.status === "approved" ? "Approved" : record.status === "pending" ? "Pending" : "Rejected"}
                            </button>
                          );
                        })()}
                      </TableCell>

                      {/* Action */}
                      <TableCell className={cn('px-1', 'py-2', 'whitespace-nowrap')} onClick={(e) => e.stopPropagation()}>
                        <div className={cn('flex', 'items-center', 'gap-1', 'justify-end')}>
                          {renderBookingActions(booking)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile (<sm): card list */}
            <div className={cn('block', 'sm:hidden', 'p-4', 'space-y-3')}>
              {bookings.map((booking: BookingListItem, idx: number) => {
                const rowNumber = (currentPage - 1) * ROWS_PER_PAGE + idx + 1;
                const variant = booking.snapPackagePricing;
                return (
                  <div
                    key={booking.id}
                    className={cn('rounded-lg', 'border', 'bg-card', 'p-3', 'space-y-2', 'cursor-pointer')}
                    onMouseEnter={() => { if (booking.recordStatus !== "draft") prefetchDetail(booking.id); }}
                    onClick={() => {
                      if (booking.recordStatus === "draft") {
                        openBookingDrawer({ resumeMode: true, initialDraftId: booking.id, onSuccess: () => { void refetch(); } });
                      } else {
                        setDetailTarget(booking.id);
                      }
                    }}
                  >
                    {/* Row 1: customer name + status badge */}
                    <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
                      <span className={cn('font-medium', 'text-foreground', 'truncate')}>
                        {rowNumber}. {booking.snapCustomer?.name ?? booking.customer?.name ?? "—"}
                      </span>
                      <div className={cn('flex', 'items-center', 'gap-1', 'shrink-0')}>
                        {booking.recordStatus === "draft" && (
                          <span className={cn('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded-full', 'border', 'border-border', 'bg-secondary', 'text-secondary-foreground', 'text-[10px]', 'font-semibold')}>
                            Draft
                          </span>
                        )}
                        {booking.editDraft && (
                          <span className={cn('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded-full', 'border', 'border-border', 'bg-secondary', 'text-secondary-foreground', 'text-[10px]', 'font-semibold')}>
                            Sedang diedit
                          </span>
                        )}
                        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-background", STATUS_TEXT[booking.bookingStatus] ?? "text-muted-foreground border-border")}>
                          <span className={cn("w-1 h-1 rounded-full mr-1", STATUS_DOT[booking.bookingStatus] ?? "bg-muted-foreground")} />
                          {booking.bookingStatus}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: venue + package */}
                    <div className={cn('flex', 'items-center', 'gap-1.5', 'flex-wrap', 'text-xs', 'text-muted-foreground')}>
                      <span className="truncate">{booking.snapVenue?.venueName ?? "Venue —"}</span>
                      {booking.snapPackage?.packageName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-foreground/70 truncate">{booking.snapPackage.packageName}</span>
                        </>
                      )}
                    </div>

                    {/* Row 3: event date + session badge */}
                    <div className={cn('flex', 'items-center', 'gap-2', 'flex-wrap', 'text-xs', 'text-muted-foreground')}>
                      <span className={cn('flex', 'items-center', 'gap-1')}>
                        <CalendarDays weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'shrink-0', 'text-muted-foreground')} />
                        {booking.eventDate ? format(new Date(booking.eventDate), "dd MMM yyyy") : "—"}
                      </span>
                      {booking.weddingSession && (
                        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium", SESSION_STYLE[booking.weddingSession] ?? "bg-muted text-muted-foreground")}>
                          {SESSION_LABEL[booking.weddingSession] ?? booking.weddingSession}
                        </span>
                      )}
                      {variant && (
                        <span>{variant.pax} PAX</span>
                      )}
                    </div>

                    {/* Row 4: approval badge + PO number */}
                    <div className={cn('flex', 'items-center', 'gap-1.5', 'flex-wrap', 'text-xs')}>
                      {(() => {
                        const record = approvalMap.get(booking.id);
                        if (!record) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setApprovalDialogTarget(booking); }}
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer",
                              record.status === "approved" && "bg-primary text-primary-foreground",
                              record.status === "pending" && "bg-muted text-muted-foreground",
                              record.status === "rejected" && "bg-destructive/10 text-destructive",
                            )}
                          >
                            {record.status === "approved" ? "Approved" : record.status === "pending" ? "Pending" : "Rejected"}
                          </button>
                        );
                      })()}
                      {booking.poNumber ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(booking.poNumber!); toast.success("PO Number copied!", { duration: 1500 }); }}
                          className={cn('inline-flex', 'items-center', 'max-w-full', 'px-1.5', 'py-0.5', 'rounded', 'bg-muted', 'text-[10px]', 'font-mono', 'text-muted-foreground', 'hover:bg-muted/80', 'transition-colors', 'cursor-pointer', 'truncate')}
                        >
                          <span className="truncate">{booking.poNumber}</span>
                        </button>
                      ) : (
                        <span className={cn('text-muted-foreground', 'text-[10px]')}>No PO</span>
                      )}
                    </div>

                    {/* Row 4b: Sales PIC — shown below PO when available */}
                    {booking.sales?.fullName && (
                      <div className={cn('flex', 'items-center', 'gap-0.5', 'text-[10px]', 'text-muted-foreground')}>
                        <UserCircle weight="BoldDuotone" className="h-3 w-3 shrink-0" />
                        <span className="truncate">{booking.sales.fullName}</span>
                      </div>
                    )}

                    {/* Footer: mobile action tile bar — icon above + label below, centered */}
                    <div className={cn('flex', 'items-center', 'justify-center', 'gap-1', 'pt-1', 'border-t', 'border-border')} onClick={(e) => e.stopPropagation()}>
                      {booking.recordStatus === "draft" ? (
                        <>
                          {/* Draft: Lanjutkan tile */}
                          <button
                            type="button"
                            className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                            onClick={() => openBookingDrawer({ resumeMode: true, initialDraftId: booking.id, onSuccess: () => { void refetch(); } })}
                            aria-label={`Lanjutkan draft booking ${booking.snapCustomer?.name ?? ""}`}
                          >
                            <AddCircle weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-primary')} />
                            <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>Lanjutkan</span>
                          </button>
                          {/* Draft: More tile */}
                          {can("booking", "delete") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                                  aria-label="Aksi lainnya"
                                >
                                  <EllipsisVertical weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-muted-foreground')} />
                                  <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>More</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className={cn('cursor-pointer', 'text-destructive', 'focus:text-destructive')}
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(booking); }}
                                >
                                  <Trash2 weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-destructive')} /> Hapus Draft
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      ) : (() => {
                        const { hasPending, internalApproved } = getBookingApprovalState(booking);
                        return (
                          <>
                            {/* 1. Detail tile — always */}
                            <button
                              type="button"
                              className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                              onClick={() => setDetailTarget(booking.id)}
                              onMouseEnter={() => prefetchDetail(booking.id)}
                              onFocus={() => prefetchDetail(booking.id)}
                              aria-label={`Lihat detail booking ${booking.snapCustomer?.name ?? ""}`}
                            >
                              <Eye weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-primary')} />
                              <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>Detail</span>
                            </button>

                            {/* 2. Edit tile — if permitted */}
                            {can("booking", "edit") && (
                              <button
                                type="button"
                                className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                                onClick={(e) => { e.stopPropagation(); setEditTarget(booking); }}
                                aria-label={`Edit booking ${booking.snapCustomer?.name ?? ""}`}
                              >
                                <Pencil weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-primary')} />
                                <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>Edit</span>
                              </button>
                            )}

                            {/* 3. Slot status — Approval OR Client Agreement OR nothing */}
                            {hasPending && approvalMap.has(booking.id) ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                                    aria-label="Approval"
                                  >
                                    <ClipboardCheck weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-primary')} />
                                    <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>Approval</span>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {renderApprovalItems(booking)}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (internalApproved && can("booking", "client-agreement") && booking.clientAgreement?.status !== "Signed") ? (
                              <button
                                type="button"
                                className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                                onClick={(e) => { e.stopPropagation(); setAgreementModal({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Client" }); }}
                                aria-label="Client Agreement"
                              >
                                <FileSignature weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-primary')} />
                                <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>Agreement</span>
                              </button>
                            ) : null}

                            {/* 4. Chat tile — PermissionGate comment */}
                            <PermissionGate module="booking" action="comment">
                              <button
                                type="button"
                                className={cn('relative', 'flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                                onClick={(e) => { e.stopPropagation(); setCommentTarget(booking); }}
                                onMouseEnter={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }}
                                onFocus={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }}
                                aria-label="Komentar"
                              >
                                <span className="relative inline-flex">
                                  <MessageSquare weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-muted-foreground')} />
                                  {/* Badge merah — unread biasa */}
                                  {(unreadCounts[booking.id] ?? 0) > 0 && (
                                    <span className={cn('absolute', '-top-0.5', '-right-0.5', 'min-w-4', 'h-4', 'rounded-full', 'bg-destructive', 'text-destructive-foreground', 'text-[9px]', 'font-bold', 'flex', 'items-center', 'justify-center', 'px-0.5')}>
                                      {unreadCounts[booking.id] > 9 ? "9+" : unreadCounts[booking.id]}
                                    </span>
                                  )}
                                  {/* Badge @ emas — unread mentions */}
                                  {(mentionCounts[booking.id] ?? 0) > 0 && (
                                    <span
                                      className={cn(
                                        'absolute', 'min-w-4', 'h-4', 'rounded-full',
                                        'text-[9px]', 'font-bold', 'flex', 'items-center', 'justify-center', 'px-0.5', 'text-white',
                                        (unreadCounts[booking.id] ?? 0) > 0 ? '-bottom-0.5 -right-0.5' : '-top-0.5 -right-0.5'
                                      )}
                                      style={{ backgroundColor: "var(--brand-gold)" }}
                                    >
                                      @
                                    </span>
                                  )}
                                </span>
                                <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>Chat</span>
                              </button>
                            </PermissionGate>

                            {/* 5. PO tile — dropdown Live + revisi */}
                            <DropdownMenu onOpenChange={(open) => { if (open) fetchRevisions(booking.id); }}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                                  aria-label="Preview PO"
                                >
                                  <Printer weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-primary')} />
                                  <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>PO</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {renderPoItems(booking)}
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* 6. More tile — dropdown More existing */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-0.5', 'w-14', 'rounded-xl', 'py-1.5', 'px-1', 'cursor-pointer', 'transition-colors', 'hover:bg-accent')}
                                  aria-label="Aksi lainnya"
                                >
                                  <EllipsisVertical weight="BoldDuotone" aria-hidden="true" className={cn('h-5', 'w-5', 'text-muted-foreground')} />
                                  <span className={cn('text-[10px]', 'font-medium', 'text-muted-foreground', 'leading-none', 'text-center')}>More</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {renderMoreItems(booking)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        );
                      })()}
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
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ArrowLeft weight="BoldDuotone" className={cn('w-4', 'h-4', 'sm:mr-2')} /> <span className={cn('hidden', 'sm:inline')}>Previous</span>
              </Button>
              {/* Mobile: page X/Y */}
              <span className={cn('text-sm', 'text-muted-foreground', 'sm:hidden')}>{currentPage} / {totalPages}</span>
              {/* Desktop: page numbers with ellipsis truncation */}
              <div className={cn('hidden', 'sm:flex', 'items-center', 'gap-1')}>
                {buildPageRange(currentPage, totalPages).map((item, idx) =>
                  item === "..." ? (
                    <span key={`ellipsis-${idx}`} className={cn('px-2', 'py-1', 'text-sm', 'text-muted-foreground', 'select-none')}>...</span>
                  ) : (
                    <button key={item} onClick={() => setCurrentPage(item as number)}
                      className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === item ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
                      {item}
                    </button>
                  )
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                <span className={cn('hidden', 'sm:inline')}>Next</span> <ArrowRight weight="BoldDuotone" className={cn('w-4', 'h-4', 'sm:ml-2')} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <EditBookingDrawer key={editTarget?.id ?? ""} booking={editTarget} open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }} />

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Booking</AlertDialogTitle>
            <AlertDialogDescription>Apakah Anda yakin ingin menghapus booking <strong>{deleteTarget?.snapCustomer?.name ?? "ini"}</strong>? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject */}
      <RejectBookingModal
        open={!!rejectTarget}
        booking={rejectTarget}
        onClose={() => { if (rejectTarget) invalidateDetail(rejectTarget.id); setRejectTarget(null); }}
      />

      <MarkLostDialog
        open={!!lostTarget}
        booking={lostTarget}
        onClose={() => { if (lostTarget) invalidateDetail(lostTarget.id); setLostTarget(null); }}
      />

      {/* Restore Booking Modal */}
      <RestoreBookingDialog
        open={!!restoreTarget}
        booking={restoreTarget}
        onClose={() => { if (restoreTarget) invalidateDetail(restoreTarget.id); setRestoreTarget(null); }}
      />

      {/* Transfer Booking Modal */}
      <TransferBookingModal
        open={!!transferTarget}
        booking={transferTarget}
        salesProfiles={salesProfiles}
        onClose={() => { if (transferTarget) invalidateDetail(transferTarget.id); setTransferTarget(null); }}
      />

      {/* Transfer Manager Modal */}
      <TransferManagerModal
        open={!!managerTarget}
        booking={managerTarget}
        onClose={() => { if (managerTarget) invalidateDetail(managerTarget.id); setManagerTarget(null); }}
      />
      {/* Activity Log Modal */}
      <ActivityLogModal
        open={!!activityLogTarget}
        onClose={() => setActivityLogTarget(null)}
        bookingId={activityLogTarget?.id ?? ""}
        customerName={activityLogTarget?.snapCustomer?.name}
      />

      {/* Booking Detail Modal */}
      <BookingDetailModal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        bookingId={detailTarget}
      />

      {agreementModal && (
        <AgreementModal
          bookingId={agreementModal.bookingId}
          customerName={agreementModal.customerName}
          onClose={() => { invalidateDetail(agreementModal.bookingId); setAgreementModal(null); }}
        />
      )}

      <BookingCommentPanel
        open={!!commentTarget}
        onClose={() => {
          setCommentTarget(null);
          setHighlightCommentId(null);
          qc.invalidateQueries({ queryKey: ["unread-comments"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }}
        bookingId={commentTarget?.id ?? null}
        customerName={commentTarget?.snapCustomer?.name ?? ""}
        highlightCommentId={highlightCommentId ?? undefined}
      />

      {/* Upload Document Modal */}
      {uploadDocTarget && (
        <UploadDocumentModal
          open={!!uploadDocTarget}
          onClose={() => { setUploadDocTarget(null); refetch(); }}
          bookingId={uploadDocTarget.id}
          bookingName={uploadDocTarget.snapCustomer?.name ?? ""}
        />
      )}


      {/* Term & Condition Drawer */}
      {tcTarget && (
        <BookingTCDrawer
          open={!!tcTarget}
          onClose={() => setTcTarget(null)}
          bookingId={tcTarget.bookingId}
          customerName={tcTarget.customerName}
          initialTC={tcTarget.initialTC}
        />
      )}

      {/* Edit Package Drawer — key forces remount on booking change, resetting all local state cleanly */}
      <EditPackageDrawer
        key={`pkg-${editPackageTarget?.bookingId ?? "none"}`}
        target={editPackageTarget}
        onClose={() => { if (editPackageTarget) invalidateDetail(editPackageTarget.bookingId); setEditPackageTarget(null); }}
      />

      {/* Edit Complimentary Drawer — key forces remount per booking so lazy-initializer picks up correct data */}
      <EditComplimentaryDrawer
        key={`comp-${editComplimentaryTarget?.bookingId ?? "none"}`}
        target={editComplimentaryTarget}
        onClose={() => { if (editComplimentaryTarget) invalidateDetail(editComplimentaryTarget.bookingId); setEditComplimentaryTarget(null); }}
      />

      {/* Edit Takeout Drawer */}
      <EditTakeoutDrawer
        key={`takeout-${editTakeoutTarget?.bookingId ?? "none"}`}
        isOpen={!!editTakeoutTarget}
        onClose={() => setEditTakeoutTarget(null)}
        bookingId={editTakeoutTarget?.bookingId ?? ""}
        customerName={editTakeoutTarget?.customerName ?? ""}
      />

      {/* Edit TOP Drawer */}
      <EditTopDrawerById
        key={`top-${editTopTarget?.bookingId ?? "none"}`}
        isOpen={!!editTopTarget}
        onClose={() => setEditTopTarget(null)}
        bookingId={editTopTarget?.bookingId ?? ""}
        customerName={editTopTarget?.customerName ?? ""}
      />

      {/* Set Harga Booking Drawer */}
      {setHargaTarget && (
        <SetHargaBookingDrawer
          key={setHargaTarget.bookingId}
          isOpen={!!setHargaTarget}
          onClose={() => { invalidateDetail(setHargaTarget.bookingId); setSetHargaTarget(null); }}
          bookingId={setHargaTarget.bookingId}
          customerName={setHargaTarget.customerName}
          packageName={setHargaTarget.packageName}
          pax={setHargaTarget.pax}
          venueName={setHargaTarget.venueName}
        />
      )}

      {/* PO Preview (modal — works before approval, no new tab) */}
      <BookingPOPreviewModal
        open={!!poPreviewTarget}
        onOpenChange={(open) => { if (!open) setPoPreviewTarget(null); }}
        target={poPreviewTarget}
      />

      {/* Booking Approval Dialog (from chip) */}
      {approvalDialogTarget && user && (
        <ApprovalDialog
          open={!!approvalDialogTarget}
          onClose={() => { invalidateDetail(approvalDialogTarget.id); setApprovalDialogTarget(null); qc.invalidateQueries({ queryKey: ["bookings"] }); }}
          packageId={approvalDialogTarget.id}
          packageName={approvalDialogTarget.snapCustomer?.name ?? "Booking"}
          userProfileId={user.profileId}
          userRoleId={user.roleId}
          module="booking"
        />
      )}

      {/* Booking Approval Modal */}
      {approveModal && (
        <ApproveModal
          open={!!approveModal}
          onClose={() => {
            setApproveModal(null);
            qc.invalidateQueries({ queryKey: ["bookings"] });
            // approveModal carries no bookingId — broadly invalidate detail caches.
            qc.invalidateQueries({ queryKey: ["booking-detail"] });
          }}
          stepId={approveModal.stepId}
          stepLabel={approveModal.stepLabel}
          packageName={approveModal.bookingName}
        />
      )}

    </>
  );
}

