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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
} from "@solar-icons/react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useSalesBookings } from "@/hooks/use-sales-bookings";
import { useDeleteBooking } from "@/hooks/use-bookings";
import { usePermissions } from "@/hooks/use-permissions";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUnreadCommentCounts } from "@/hooks/use-unread-comment-counts";
import { fetchBookingComments } from "@/services/booking-comment-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AgreementModal } from "@/components/shared/booking/agreement-modal";
import { RejectBookingModal } from "@/components/shared/booking/reject-booking-modal";
import { MarkLostDialog } from "@/components/shared/booking/mark-lost-dialog";
import { RestoreBookingDialog } from "@/components/shared/booking/restore-booking-dialog";
import { TransferBookingModal } from "@/components/shared/booking/transfer-booking-modal";
import { TransferManagerModal } from "@/components/shared/booking/transfer-manager-modal";
import { BookingDetailModal } from "@/app/(private)/dashboard/booking-weddings/_components/booking-detail-modal";
import { EditBookingDrawer } from "@/app/(private)/dashboard/booking-weddings/_components/edit-booking-drawer";
import { BookingPOPreviewModal, type BookingPOPreviewTarget } from "@/app/(private)/dashboard/booking-weddings/_components/booking-po-preview-modal";
import { UploadDocumentModal } from "@/app/(private)/dashboard/booking-weddings/_components/upload-document-modal";
import { BookingCommentPanel } from "@/app/(private)/dashboard/booking-weddings/_components/booking-comment-panel";
import { ActivityLogModal } from "@/app/(private)/dashboard/booking-weddings/_components/activity-log-modal";
import { ApproveModal } from "@/app/(private)/dashboard/packages/_components/approve-modal";
import { ApprovalDialog } from "@/app/(private)/dashboard/packages/_components/approval-dialog";
import type { BookingListItem } from "@/lib/queries/bookings";
import type { AssignableSalesUser } from "@/lib/queries/users";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRoleId: string | null;
  approverUserId: string | null;
  status: string;
  signature: string | null;
  decidedAt: string | null;
  notes: string | null;
  revisionId: string | null;
  approverRole: { id: string; name: string } | null;
  approverUser: { id: string; fullName: string | null } | null;
  decidedBy: { id: string; fullName: string | null } | null;
}

interface ApprovalRecord {
  id: string;
  entityId: string;
  status: string;
  steps: ApprovalStep[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SalesBookingsTableProps {
  salesId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesBookingsTable({ salesId }: SalesBookingsTableProps): React.JSX.Element {
  const qc = useQueryClient();
  const deleteMut = useDeleteBooking();
  const { can, isAdmin } = usePermissions();
  const { openBookingDrawer } = useBookingDrawer();
  const { user } = useCurrentUser();

  // ── Filter & pagination state ──────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [venueId, setVenueId] = useState("");
  const [recordStatus, setRecordStatus] = useState<"saved" | "draft" | "all">("saved");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

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
  const [rejectTarget, setRejectTarget] = useState<BookingListItem | null>(null);
  const [lostTarget, setLostTarget] = useState<BookingListItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BookingListItem | null>(null);
  const [agreementModal, setAgreementModal] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null);
  const [commentTarget, setCommentTarget] = useState<BookingListItem | null>(null);
  const [activityLogTarget, setActivityLogTarget] = useState<BookingListItem | null>(null);
  const [approvalDialogTarget, setApprovalDialogTarget] = useState<BookingListItem | null>(null);
  const [approveModal, setApproveModal] = useState<{ stepId: string; stepLabel: string; bookingName: string } | null>(null);

  // Revision cache for PO preview sub-menu
  const [revisionCache, setRevisionCache] = useState<
    Record<string, { id: string; revisionNumber: number; reason: string | null; packageName: string; pax: number | null; price: number | null; createdAt: string }[]>
  >({});

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: result, isFetching, refetch } = useSalesBookings({
    salesId,
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    venueId: venueId || undefined,
    recordStatus,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const bookings: BookingListItem[] = result?.data ?? [];
  const totalBookings = result?.total ?? 0;
  const totalPages = Math.ceil(totalBookings / PAGE_SIZE);

  const { data: venues = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["venues-list"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      if (!res.ok) return [];
      const json = await res.json() as unknown;
      return Array.isArray(json) ? (json as { id: string; name: string }[]) : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // Sales users for TransferBookingModal — fetched from /api/users/sales
  const { data: salesUsers = [] } = useQuery<AssignableSalesUser[]>({
    queryKey: ["sales-profiles-list"],
    queryFn: async () => {
      const res = await fetch("/api/users/sales");
      if (!res.ok) return [];
      const json = await res.json() as unknown;
      return Array.isArray(json) ? (json as AssignableSalesUser[]) : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Booking approvals — fetched alongside bookings. We gate the first list render on
  // BOTH this and the bookings query so approval badges paint together with the rows
  // instead of flashing in a beat later.
  const { data: bookingApprovals = [], isLoading: approvalsLoading } = useQuery<ApprovalRecord[]>({
    queryKey: ["booking-approvals"],
    queryFn: async () => {
      const res = await fetch("/api/approval-records?module=booking");
      if (!res.ok) return [];
      const json = await res.json() as { data?: ApprovalRecord[] } | ApprovalRecord[];
      return Array.isArray(json) ? json : (json as { data?: ApprovalRecord[] }).data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const approvalMap = new Map(
    (Array.isArray(bookingApprovals) ? bookingApprovals : []).map((r) => [r.entityId, r])
  );

  // Unread comment counts
  const { data: countData } = useUnreadCommentCounts(bookings.map((b) => b.id));
  const unreadCounts = countData?.unreadCounts ?? {};

  // ── Helpers ────────────────────────────────────────────────────────────────
  function previewPO(booking: BookingListItem, revisionId?: string, revLabel?: string): void {
    const base = booking.snapCustomer?.name ?? "Booking";
    setPoPreviewTarget({
      bookingId: booking.id,
      revisionId,
      label: revLabel ? `${base} · ${revLabel}` : base,
    });
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
      .catch(() => {});
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
  const activeFilterCount = (hasVenueFilter ? 1 : 0) + (hasRecordStatusFilter ? 1 : 0) + (hasDateFilter ? 1 : 0);
  const hasActiveFilter = activeFilterCount > 0;

  function resetFilters(): void {
    setVenueId("");
    setRecordStatus("saved");
    setDateFrom("");
    setDateTo("");
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

    // Agreement gate: needs both manager + finance approved for current revision
    const allAgreementSteps = approvalMap.get(booking.id)?.steps ?? [];
    const currentRevisionId = booking.currentRevisionId;
    const hasRevisionedSteps = allAgreementSteps.some((s) => s.revisionId !== null);
    const currentRoundSteps =
      currentRevisionId && hasRevisionedSteps
        ? allAgreementSteps.filter((s) => s.revisionId === currentRevisionId)
        : allAgreementSteps;
    const isManagerApproved = currentRoundSteps.some((s) => s.approverRole?.name === "manager" && s.status === "approved");
    const isFinanceApproved = currentRoundSteps.some((s) => s.approverRole?.name === "finance" && s.status === "approved");
    const internalApproved = isManagerApproved && isFinanceApproved;

    // Approval steps (non-client)
    const allSteps = approvalMap.get(booking.id)?.steps ?? [];
    const bHasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
    const currentSteps =
      currentRevisionId && bHasRevisionedSteps
        ? allSteps.filter((s) => s.revisionId === currentRevisionId)
        : allSteps;
    const nonClientSteps = currentSteps.filter((s) => s.approverType !== "client");
    const allInternalApproved = nonClientSteps.length > 0 && nonClientSteps.every((s) => s.status === "approved");

    const showSeparatorStatus =
      (can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost") ||
      (can("booking", "mark-lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed") ||
      (can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed"));

    // Quick approve — pending non-client steps the current user can act on.
    const actableSteps = nonClientSteps.filter((step) => {
      const isPending = step.status === "pending";
      return isPending && (
        isAdmin ||
        (step.approverType === "role" && step.approverRoleId === user?.roleId) ||
        (step.approverType === "user" && step.approverUserId === user?.profileId)
      );
    });

    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        {/* Quick: Client Agreement — once manager + finance approved, before signing */}
        {can("booking", "client-agreement") && internalApproved && booking.clientAgreement?.status !== "Signed" && (
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
        {!allInternalApproved && approvalMap.has(booking.id) && nonClientSteps.length > 0 && (
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
              <TooltipTrigger render={<Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8 relative" onClick={(e) => { e.stopPropagation(); setCommentTarget(booking); }} onMouseEnter={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }} onFocus={() => { qc.prefetchQuery({ queryKey: ["booking-comments", booking.id], queryFn: () => fetchBookingComments(booking.id), staleTime: 30_000 }); }} />}>
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

        {/* More actions */}
        <DropdownMenu>
        <DropdownMenuTrigger className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")}>
          <EllipsisVertical weight="BoldDuotone" className={cn("h-4", "w-4", "text-muted-foreground")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Detail */}
          {can("booking", "view") && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setDetailTarget(booking.id); }}
            >
              <Eye weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
              Lihat Detail
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Edit */}
          {can("booking", "edit") && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setEditTarget(booking); }}
            >
              <Pencil weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
              Edit Booking
            </DropdownMenuItem>
          )}

          {/* Preview PO */}
          {can("booking", "print") && (
            <DropdownMenuSub
              onOpenChange={(open) => { if (open) fetchRevisions(booking.id); }}
            >
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Printer weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
                Preview PO Booking
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => previewPO(booking)}
                >
                  Lihat Terbaru (Live)
                </DropdownMenuItem>
                {(revisionCache[booking.id] ?? []).length > 0 && <DropdownMenuSeparator />}
                {(revisionCache[booking.id] ?? []).map((rev) => (
                  <DropdownMenuItem
                    key={rev.id}
                    className="cursor-pointer"
                    onClick={() => previewPO(booking, rev.id, `Rev ${rev.revisionNumber}`)}
                  >
                    <span className="truncate">
                      Rev {rev.revisionNumber} — {rev.packageName}
                      {rev.pax ? ` · ${rev.pax} PAX` : ""}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Upload Dokumen */}
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setUploadDocTarget(booking); }}
          >
            <FileUp weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
            Upload Dokumen
          </DropdownMenuItem>

          {/* Transfer Booking */}
          {can("booking", "transfer") && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setTransferTarget(booking); }}
            >
              <ArrowLeftRight weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
              Transfer Booking
            </DropdownMenuItem>
          )}

          {/* Transfer Manager */}
          {can("booking", "transfer-manager") && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setManagerTarget(booking); }}
            >
              <UsersGroupRounded weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
              Transfer Manager
            </DropdownMenuItem>
          )}

          {/* Activity Log */}
          {can("booking", "view") && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setActivityLogTarget(booking); }}
            >
              <ClipboardCheck weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
              Lihat Activity
            </DropdownMenuItem>
          )}

          {/* Approval dialog (read-only view of full timeline) */}
          {approvalMap.has(booking.id) && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setApprovalDialogTarget(booking); }}
            >
              <ClipboardCheck weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-primary")} />
              Lihat Approval
            </DropdownMenuItem>
          )}

          {showSeparatorStatus && <DropdownMenuSeparator />}

          {/* Reject */}
          {can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost" && (
            <DropdownMenuItem
              className={cn("cursor-pointer", "text-destructive", "focus:text-destructive")}
              onClick={(e) => { e.stopPropagation(); setRejectTarget(booking); }}
            >
              <SquareX weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-destructive")} />
              Reject Booking
            </DropdownMenuItem>
          )}

          {/* Mark Lost */}
          {can("booking", "mark-lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed" && (
            <DropdownMenuItem
              className={cn("cursor-pointer", "text-muted-foreground", "focus:text-foreground")}
              onClick={(e) => { e.stopPropagation(); setLostTarget(booking); }}
            >
              <SquareX weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4")} />
              Lost Booking
            </DropdownMenuItem>
          )}

          {/* Restore */}
          {can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed") && (
            <DropdownMenuItem
              className={cn("cursor-pointer", "text-muted-foreground", "focus:text-foreground")}
              onClick={(e) => { e.stopPropagation(); setRestoreTarget(booking); }}
            >
              <Refresh weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4")} />
              Restore Booking
            </DropdownMenuItem>
          )}

          {can("booking", "delete") && <DropdownMenuSeparator />}
          {can("booking", "delete") && (
            <DropdownMenuItem
              className={cn("cursor-pointer", "text-destructive", "focus:text-destructive")}
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(booking); }}
            >
              <Trash2 weight="BoldDuotone" className={cn("mr-2", "h-4", "w-4", "text-destructive")} />
              Hapus
            </DropdownMenuItem>
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

      {/* Status filter */}
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
          onClick={() => { void refetch(); qc.invalidateQueries({ queryKey: ["booking-approvals"] }).catch(() => {}); }}
          disabled={isFetching}
          aria-label="Muat ulang"
          className="shrink-0"
        >
          <Refresh weight="BoldDuotone" className={cn("h-4", "w-4", isFetching && "animate-spin")} />
        </Button>

        {/* Filter popover */}
        <Popover>
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
        {(isFetching && bookings.length === 0) || (approvalsLoading && bookings.length > 0) ? (
          // Hold the skeleton until BOTH bookings and approvals have resolved on first
          // load — otherwise rows paint first and approval badges pop in a frame later.
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

              const eventDate = new Date(booking.bookingDate);
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
                      {format(eventDate, "dd")}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">
                      {format(eventDate, "MMM")}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {format(eventDate, "yyyy")}
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
                              navigator.clipboard.writeText(booking.poNumber!).catch(() => {});
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-3 mt-1 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
          >
            <ArrowLeft weight="BoldDuotone" className="w-4 h-4 mr-1" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
          >
            Next
            <ArrowRight weight="BoldDuotone" className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

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

      {/* Reject */}
      <RejectBookingModal open={!!rejectTarget} booking={rejectTarget} onClose={() => setRejectTarget(null)} />

      {/* Mark Lost */}
      <MarkLostDialog open={!!lostTarget} booking={lostTarget} onClose={() => setLostTarget(null)} />

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
          onClose={() => setAgreementModal(null)}
        />
      )}

      {/* Comment Panel */}
      <BookingCommentPanel
        open={!!commentTarget}
        onClose={() => {
          setCommentTarget(null);
          qc.invalidateQueries({ queryKey: ["unread-comments"] }).catch(() => {});
        }}
        bookingId={commentTarget?.id ?? null}
        customerName={commentTarget?.snapCustomer?.name ?? ""}
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

      {/* Approval Dialog (from approval badge) */}
      {approvalDialogTarget && user && (
        <ApprovalDialog
          open={!!approvalDialogTarget}
          onClose={() => {
            setApprovalDialogTarget(null);
            qc.invalidateQueries({ queryKey: ["bookings"] }).catch(() => {});
            qc.invalidateQueries({ queryKey: ["booking-approvals"] }).catch(() => {});
          }}
          packageId={approvalDialogTarget.id}
          packageName={approvalDialogTarget.snapCustomer?.name ?? "Booking"}
          userProfileId={user.profileId}
          userRoleId={user.roleId}
          module="booking"
        />
      )}

      {/* Approve Step Modal */}
      {approveModal && (
        <ApproveModal
          open={!!approveModal}
          onClose={() => {
            setApproveModal(null);
            qc.invalidateQueries({ queryKey: ["bookings"] }).catch(() => {});
            qc.invalidateQueries({ queryKey: ["booking-approvals"] }).catch(() => {});
          }}
          stepId={approveModal.stepId}
          stepLabel={approveModal.stepLabel}
          packageName={approveModal.bookingName}
        />
      )}
    </>
  );
}
