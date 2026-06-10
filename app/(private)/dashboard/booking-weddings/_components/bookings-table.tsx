"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar as CalendarDays, ArrowLeft, ArrowRight, Magnifer as Search, Eye, Refresh, MenuDots as EllipsisVertical, TrashBinTrash as Trash2, CloseSquare as SquareX, Pen as Pencil, TransferHorizontal as ArrowLeftRight, CloseCircle as X, FileText as FileSignature, Copy, Printer, FileSend as FileUp, ChatRound as MessageSquare, ClipboardCheck, Wallet as WalletMinimal, SettingsMinimalistic as Settings2, AddCircle, UsersGroupRounded, Filter } from "@solar-icons/react";
const RefreshCw = Refresh;
const RotateCcw = Refresh;
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBookings, useDeleteBooking, useUpdateBooking, useTransferBooking, useTransferBookingManager } from "@/hooks/use-bookings";
import { useManagers } from "@/hooks/use-managers";
import { usePermissions } from "@/hooks/use-permissions";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateAgreementToken } from "@/actions/client-agreement";
import { UploadDocumentModal } from "./upload-document-modal";
import { ActivityLogModal } from "./activity-log-modal";
import { BookingDetailModal } from "./booking-detail-modal";
import { EditTopDrawer } from "./edit-top-drawer";
import { EditTakeoutDrawer } from "./edit-takeout-drawer";
import { EditBookingDrawer } from "./edit-booking-drawer";
import { BookingPOPreviewModal, type BookingPOPreviewTarget } from "./booking-po-preview-modal";
import { BookingCommentPanel } from "./booking-comment-panel";
import { useUnreadCommentCounts } from "@/hooks/use-unread-comment-counts";
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

function copyText(text: string) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

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
  const updateMut = useUpdateBooking();
  const transferMut = useTransferBooking();
  const transferManagerMut = useTransferBookingManager();
  const { managers } = useManagers();
  const { can, isAdmin } = usePermissions();
  const { openBookingDrawer } = useBookingDrawer();
  const { user } = useCurrentUser();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState("");

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

  const { data: result = initialData, refetch, isFetching } = useBookings(
    { page: currentPage, pageSize: ROWS_PER_PAGE, search: debouncedSearch, venueId: venueFilter || undefined },
    initialData,
  );
  const bookings = result.data;
  const totalBookings = result.total;
  const totalPages = Math.ceil(totalBookings / ROWS_PER_PAGE);
  const [approveModal, setApproveModal] = useState<{ stepId: string; stepLabel: string; bookingName: string } | null>(null);
  const [approvalDialogTarget, setApprovalDialogTarget] = useState<BookingListItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null);
  const [editTarget, setEditTarget] = useState<BookingListItem | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BookingListItem | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [lostTarget, setLostTarget] = useState<BookingListItem | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [transferTarget, setTransferTarget] = useState<BookingListItem | null>(null);
  const [uploadDocTarget, setUploadDocTarget] = useState<BookingListItem | null>(null);
  const [transferSalesId, setTransferSalesId] = useState("");
  const [managerTarget, setManagerTarget] = useState<BookingListItem | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<BookingListItem | null>(null);
  const [activityLogTarget, setActivityLogTarget] = useState<BookingListItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<BookingListItem | null>(null);
  const [poPreviewTarget, setPoPreviewTarget] = useState<BookingPOPreviewTarget | null>(null);
  const [revisionCache, setRevisionCache] = useState<Record<string, { id: string; revisionNumber: number; reason: string | null; packageName: string; pax: number | null; price: number | null; createdAt: string }[]>>({});
  const [agreementModal, setAgreementModal] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [topTarget, setTopTarget] = useState<BookingListItem | null>(null);
  const [takeoutTarget, setTakeoutTarget] = useState<BookingListItem | null>(null);

  const { data: bookingApprovals = [] } = useQuery<{ id: string; entityId: string; status: string; steps: { id: string; stepOrder: number; approverType: string; approverRoleId: string | null; approverUserId: string | null; status: string; signature: string | null; decidedAt: string | null; notes: string | null; revisionId: string | null; approverRole: { id: string; name: string } | null; approverUser: { id: string; fullName: string | null } | null; decidedBy: { id: string; fullName: string | null } | null }[] }[]>({
    queryKey: ["booking-approvals"],
    queryFn: async () => {
      const res = await fetch("/api/approval-records?module=booking");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? json;
    },
    staleTime: 5 * 60 * 1000,
  });
  const approvalMap = new Map((Array.isArray(bookingApprovals) ? bookingApprovals : []).map((r) => [r.entityId, r]));

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


  const { data: unreadCounts = {} } = useUnreadCommentCounts(bookings.map((b: BookingListItem) => b.id));

  function renderBookingActions(booking: BookingListItem) {
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
        {approvalMap.has(booking.id) && (() => {
          const record = approvalMap.get(booking.id)!;
          const allSteps = record.steps;
          // Show only steps for the active revision (snapshot approach).
          // Backward compat: if no currentRevisionId or no steps have revisionId → show all steps.
          const bCurrentRevisionId = booking.currentRevisionId;
          const bHasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);
          const steps = (bCurrentRevisionId && bHasRevisionedSteps)
            ? allSteps.filter((s) => s.revisionId === bCurrentRevisionId)
            : allSteps;
          const nonClientSteps = steps.filter((s) => s.approverType !== "client");
          if (nonClientSteps.every((s) => s.status === "approved")) return null;
          return (
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
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}

        {/* Comment button — placed last, right before the More actions menu */}
        <PermissionGate module="booking" action="comment">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon" className={cn('cursor-pointer', 'relative')} onClick={() => setCommentTarget(booking)} />}>
              <MessageSquare weight="BoldDuotone" className={cn('h-4', 'w-4')} />
              {(unreadCounts[booking.id] ?? 0) > 0 && (
                <span className={cn('absolute', '-top-0.5', '-right-0.5', 'min-w-4', 'h-4', 'rounded-full', 'bg-destructive', 'text-destructive-foreground', 'text-[9px]', 'font-bold', 'flex', 'items-center', 'justify-center', 'px-0.5')}>
                  {unreadCounts[booking.id] > 9 ? "9+" : unreadCounts[booking.id]}
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent side="top"><p className="text-xs">Komentar</p></TooltipContent>
          </Tooltip>
        </PermissionGate>

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
            <DropdownMenuItem className="cursor-pointer" onClick={() => setDetailTarget(booking.id)}>
              <Eye weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Lihat Detail
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {can("booking", "edit") && (
            <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditTarget(booking); }}>
              <Pencil weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Edit Booking
            </DropdownMenuItem>
            )}
            {/* PO preview is available regardless of approval/Confirmed status —
                it opens in a modal (no new tab). */}
            <DropdownMenuSub onOpenChange={(open) => { if (open) fetchRevisions(booking.id); }}>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Printer weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Preview PO Booking
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => previewPO(booking)}>
                    Lihat Terbaru (Live)
                  </DropdownMenuItem>
                  {(revisionCache[booking.id] ?? []).length > 0 && <DropdownMenuSeparator />}
                  {(revisionCache[booking.id] ?? []).map((rev) => (
                    <DropdownMenuItem key={rev.id} className="cursor-pointer" onClick={() => previewPO(booking, rev.id, `Rev ${rev.revisionNumber}`)}>
                      <span className="truncate">Rev {rev.revisionNumber} — {rev.packageName}{rev.pax ? ` · ${rev.pax} PAX` : ""}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            <DropdownMenuItem className="cursor-pointer" onClick={() => setUploadDocTarget(booking)}>
              <FileUp weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Upload Dokumen
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => setTopTarget(booking)}>
              <WalletMinimal weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Term of Payment
            </DropdownMenuItem>
            {can("booking", "edit") &&
              booking.snapPackageCategoryPrices &&
              booking.snapPackageCategoryPrices.length > 0 && (
              <DropdownMenuItem className="cursor-pointer" onClick={() => setTakeoutTarget(booking)}>
                <Settings2 weight="BoldDuotone" className={cn('mr-2', 'h-4', 'w-4', 'text-primary')} /> Takeout
              </DropdownMenuItem>
            )}
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

  const VenueFilterPopoverContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filter</p>
        {hasVenueFilter && (
          <button
            type="button"
            onClick={() => { setVenueFilter(""); setCurrentPage(1); }}
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
                      className={cn("shrink-0 relative", hasVenueFilter && "border-primary/50")}
                      aria-label="Filter booking"
                    >
                      <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                      {hasVenueFilter && (
                        <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                          1
                        </span>
                      )}
                    </Button>
                  }
                />
                <PopoverContent align="end" className="w-72 p-3">
                  {VenueFilterPopoverContent}
                </PopoverContent>
              </Popover>
              {/* Refresh */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["booking-approvals"] }); }}
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
                    className={cn("h-9 gap-1.5 shrink-0", hasVenueFilter && "border-primary/50")}
                    aria-label="Filter booking"
                  >
                    <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                    Filter
                    {hasVenueFilter && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        1
                      </span>
                    )}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-72 p-3">
                {VenueFilterPopoverContent}
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
          {bookings.length === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-muted-foreground')}>
              <CalendarDays weight="BoldDuotone" className={cn('h-10', 'w-10', 'mb-3', 'opacity-40')} />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada booking."}</p>
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
                    <TableRow key={booking.id} className={cn('hover:bg-muted/40', 'cursor-pointer')} onClick={() => setDetailTarget(booking.id)}>
                      <TableCell className={cn('px-2', 'py-2', 'text-center', 'hidden', 'sm:table-cell')}>{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>

                      {/* Customer cell */}
                      <TableCell className={cn('px-2', 'py-2')}>
                        <div className="overflow-hidden max-w-0 min-w-full">
                          <p className={cn('text-sm', 'font-medium', 'text-foreground', 'truncate')}>{booking.snapCustomer?.name ?? "—"}</p>
                          <Tooltip>
                            <TooltipTrigger className="block truncate w-full text-left text-xs text-muted-foreground mt-0.5">
                              {(() => {
                                const raw = booking.snapCustomer?.mobileNumber ?? "";
                                try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr.map((e: { name?: string; number: string }) => e.name ? `${e.name}: ${e.number}` : e.number).join(", "); } catch { /* not JSON */ }
                                return raw;
                              })()}
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="max-w-72">
                              <ul className="space-y-1">
                                {(() => {
                                  const raw = booking.snapCustomer?.mobileNumber ?? "";
                                  let nums: { name?: string; number: string }[] = [];
                                  try { const arr = JSON.parse(raw); if (Array.isArray(arr)) nums = arr; } catch { nums = raw.split(/[,\n]+/).map((s: string) => ({ number: s.trim() })).filter((e) => e.number); }
                                  return nums.map((e, i) => <li key={i} className="text-sm">{e.name ? <><span className="text-muted-foreground">{e.name}:</span> {e.number}</> : e.number}</li>);
                                })()}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                          {/* Event date — tablet only (date col shown at sm) */}
                          <p className={cn('text-xs', 'text-muted-foreground', 'mt-0.5', 'sm:hidden')}>{format(new Date(booking.bookingDate), "dd MMM yyyy")}</p>
                          <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-1', 'mt-1')}>
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
                          {booking.poNumber ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(booking.poNumber!); toast.success("PO Number copied!", { duration: 1500 }); }}
                              className={cn('inline-flex', 'items-center', 'max-w-full', 'px-1.5', 'py-0.5', 'rounded', 'bg-muted', 'text-[10px]', 'font-mono', 'text-muted-foreground', 'hover:bg-muted/80', 'transition-colors', 'cursor-pointer', 'truncate', 'mt-0.5')}
                            >
                              <span className="truncate">{booking.poNumber}</span>
                            </button>
                          ) : (
                            <span className={cn('text-muted-foreground', 'text-[10px]', 'block', 'mt-0.5')}>No PO</span>
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
                        {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
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
                    onClick={() => setDetailTarget(booking.id)}
                  >
                    {/* Row 1: customer name + status badge */}
                    <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
                      <span className={cn('font-medium', 'text-foreground', 'truncate')}>
                        {rowNumber}. {booking.snapCustomer?.name ?? "—"}
                      </span>
                      <span className={cn("inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-background", STATUS_TEXT[booking.bookingStatus] ?? "text-muted-foreground border-border")}>
                        <span className={cn("w-1 h-1 rounded-full mr-1", STATUS_DOT[booking.bookingStatus] ?? "bg-muted-foreground")} />
                        {booking.bookingStatus}
                      </span>
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
                        {format(new Date(booking.bookingDate), "dd MMM yyyy")}
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

                    {/* Footer: action buttons */}
                    <div className={cn('flex', 'items-center', 'gap-1', 'pt-1', 'border-t', 'border-border')} onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        className={cn('h-9', 'flex-1', 'text-xs')}
                        onClick={() => setDetailTarget(booking.id)}
                        aria-label={`Lihat detail booking ${booking.snapCustomer?.name ?? ""}`}
                      >
                        <Eye weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Detail
                      </Button>
                      {can("booking", "edit") && (
                        <Button
                          variant="outline"
                          className={cn('h-9', 'flex-1', 'text-xs')}
                          onClick={() => setEditTarget(booking)}
                          aria-label={`Edit booking ${booking.snapCustomer?.name ?? ""}`}
                        >
                          <Pencil weight="BoldDuotone" aria-hidden="true" className={cn('h-3.5', 'w-3.5', 'mr-1', 'text-muted-foreground')} /> Edit
                        </Button>
                      )}
                      <div className={cn('flex', 'items-center', 'gap-1', 'shrink-0')}>
                        {renderBookingActions(booking)}
                      </div>
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
      {rejectTarget && (
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/40', 'p-4')}>
          <div className={cn('bg-card', 'rounded-2xl', 'shadow-xl', 'w-full', 'max-w-md', 'p-4', 'sm:p-6', 'relative')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-4', 'mb-4')}>
              <div>
                <h2 className={cn('text-lg', 'font-bold', 'text-foreground')}>Reject Booking</h2>
                <p className={cn('text-sm', 'text-muted-foreground', 'mt-1')}>
                  Reject booking <span className={cn('font-semibold', 'text-foreground')}>{rejectTarget.snapCustomer?.name}</span>?
                </p>
              </div>
              <button
                type="button"
                className={cn('rounded-full', 'bg-muted', 'hover:bg-muted/80', 'p-1.5', 'shrink-0')}
                onClick={() => { setRejectTarget(null); setRejectNotes(""); }}
                aria-label="Tutup"
              >
                <X weight="BoldDuotone" className={cn('h-5', 'w-5', 'text-foreground')} />
              </button>
            </div>

            <div className="mb-4">
              <label className={cn('text-sm', 'font-medium', 'text-foreground', 'mb-2', 'block')}>Alasan Penolakan</label>
              <Input placeholder="Alasan penolakan (opsional)..." value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
            </div>

            <div className={cn('flex', 'gap-3')}>
              <button
                type="button"
                className={cn('flex-1', 'bg-destructive', 'text-destructive-foreground', 'rounded-lg', 'py-2', 'font-medium', 'text-sm', 'hover:bg-destructive/90', 'transition', 'disabled:opacity-50', 'disabled:cursor-not-allowed')}
                disabled={updateMut.isPending}
                onClick={async () => {
                  const r = await updateMut.mutateAsync({ id: rejectTarget.id, bookingStatus: "Rejected", rejectionNotes: rejectNotes || null });
                  if (!r.success) toast.error(r.error); else { toast.success("Booking di-reject."); refetch(); }
                  setRejectTarget(null); setRejectNotes("");
                }}
              >
                {updateMut.isPending ? "Memproses..." : "Reject"}
              </button>
              <button
                type="button"
                className={cn('flex-1', 'border', 'border-border', 'rounded-lg', 'py-2', 'font-medium', 'text-sm', 'hover:bg-accent', 'transition')}
                onClick={() => { setRejectTarget(null); setRejectNotes(""); }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!lostTarget} onOpenChange={(open) => { if (!open) { setLostTarget(null); setLostReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lost Booking</AlertDialogTitle>
            <AlertDialogDescription>Tandai booking <strong>{lostTarget?.snapCustomer?.name}</strong> sebagai Lost?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className={cn('px-6', 'pb-2')}>
            <Input placeholder="Alasan lost (opsional)..." value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!lostTarget) return;
              const r = await updateMut.mutateAsync({ id: lostTarget.id, bookingStatus: "Lost", lostReason: lostReason || null });
              if (!r.success) toast.error(r.error); else { toast.success("Booking ditandai Lost."); refetch(); }
              setLostTarget(null); setLostReason("");
            }} className={cn('bg-primary', 'text-primary-foreground', 'hover:bg-primary/90')}>Lost Booking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Booking Modal */}
      {restoreTarget && (
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/40', 'p-4')}>
          <div className={cn('bg-card', 'rounded-2xl', 'shadow-xl', 'w-full', 'max-w-md', 'p-4', 'sm:p-6', 'relative')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-4', 'mb-4')}>
              <div>
                <h2 className={cn('text-lg', 'font-bold', 'text-foreground')}>Restore Booking</h2>
                <p className={cn('text-sm', 'text-muted-foreground', 'mt-1')}>
                  Restore booking <span className={cn('font-semibold', 'text-foreground')}>{restoreTarget.snapCustomer?.name}</span> ke status Pending?
                </p>
              </div>
              <button type="button" className={cn('rounded-full', 'bg-muted', 'hover:bg-muted/80', 'p-1.5', 'shrink-0')} onClick={() => setRestoreTarget(null)} aria-label="Tutup">
                <X weight="BoldDuotone" className={cn('h-5', 'w-5', 'text-foreground')} />
              </button>
            </div>
            <div className={cn('flex', 'gap-3')}>
              <button
                type="button"
                className={cn('flex-1', 'bg-primary', 'text-primary-foreground', 'rounded-lg', 'py-2', 'font-medium', 'text-sm', 'hover:bg-primary/90', 'transition', 'disabled:opacity-50', 'disabled:cursor-not-allowed')}
                disabled={updateMut.isPending}
                onClick={async () => {
                  const r = await updateMut.mutateAsync({ id: restoreTarget.id, bookingStatus: "Pending" });
                  if (!r.success) toast.error(r.error); else { toast.success("Booking di-restore ke Pending."); refetch(); }
                  setRestoreTarget(null);
                }}
              >
                {updateMut.isPending ? "Memproses..." : "Restore"}
              </button>
              <button type="button" className={cn('flex-1', 'border', 'border-border', 'rounded-lg', 'py-2', 'font-medium', 'text-sm', 'hover:bg-accent', 'transition')} onClick={() => setRestoreTarget(null)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Booking Modal */}
      {transferTarget && (
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/40', 'p-4')}>
          <div className={cn('bg-card', 'rounded-2xl', 'shadow-xl', 'w-full', 'max-w-md', 'p-4', 'sm:p-6', 'relative')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-4', 'mb-6')}>
              <div>
                <h2 className={cn('text-lg', 'font-bold', 'text-foreground')}>Transfer Booking</h2>
                <p className={cn('text-sm', 'text-muted-foreground', 'mt-1')}>
                  Memindahkan kepemilikan data booking dari sales sebelumnya ke sales yang dipilih.
                </p>
              </div>
              <button
                className={cn('rounded-full', 'bg-muted', 'hover:bg-muted/80', 'p-1.5', 'shrink-0')}
                onClick={() => { setTransferTarget(null); setTransferSalesId(""); }}
                type="button"
                aria-label="Tutup"
              >
                <X weight="BoldDuotone" className={cn('h-5', 'w-5', 'text-foreground')} />
              </button>
            </div>

            <div className="mb-4">
              <p className={cn('text-xs', 'text-muted-foreground', 'mb-1')}>Sales saat ini</p>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <span className={cn('text-sm', 'font-medium', 'text-foreground')}>
                  {transferTarget.sales?.fullName ?? <span className={cn('text-muted-foreground', 'italic')}>Tidak ada</span>}
                </span>
                {transferTarget.sales?.fullName && (
                  <span className={cn('text-xs', 'px-2', 'py-0.5', 'rounded-full', 'border', 'border-border', 'bg-muted', 'text-muted-foreground')}>sales</span>
                )}
              </div>
            </div>

            <div>
              <p className={cn('text-xs', 'text-muted-foreground', 'mb-1')}>Pilih Sales</p>
              <SearchableSelect
                options={salesProfiles
                  .filter((s) => s.id !== transferTarget.salesId)
                  .map((s) => ({ id: s.id, name: s.fullName ?? s.id, badge: "sales" }))}
                value={transferSalesId}
                onChange={setTransferSalesId}
                placeholder="Pilih sales tujuan..."
                searchPlaceholder="Cari nama sales..."
                emptyText="Sales tidak ditemukan"
                className="w-full"
              />
            </div>

            <div className={cn('flex', 'gap-3', 'mt-6')}>
              <button
                className={cn('flex-1', 'border', 'border-border', 'rounded-lg', 'py-2', 'font-medium', 'hover:bg-accent', 'transition', 'text-sm')}
                onClick={() => { setTransferTarget(null); setTransferSalesId(""); }}
                disabled={transferMut.isPending}
                type="button"
              >
                Batal
              </button>
              <button
                className={cn('flex-1', 'bg-primary', 'text-primary-foreground', 'rounded-lg', 'py-2', 'font-medium', 'hover:bg-primary/90', 'transition', 'text-sm', 'disabled:opacity-50', 'disabled:cursor-not-allowed')}
                disabled={!transferSalesId || transferMut.isPending}
                type="button"
                onClick={async () => {
                  const result = await transferMut.mutateAsync({ bookingId: transferTarget.id, targetSalesId: transferSalesId });
                  if (!result.success) toast.error(result.error);
                  else {
                    toast.success("Booking berhasil ditransfer");
                    refetch();
                    setTransferTarget(null);
                    setTransferSalesId("");
                  }
                }}
              >
                {transferMut.isPending ? "Mentransfer..." : "Transfer Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Manager Modal */}
      {managerTarget && (
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/40', 'p-4')}>
          <div className={cn('bg-card', 'rounded-2xl', 'shadow-xl', 'w-full', 'max-w-md', 'p-4', 'sm:p-6', 'relative')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-4', 'mb-6')}>
              <div>
                <h2 className={cn('text-lg', 'font-bold', 'text-foreground')}>Transfer Manager</h2>
                <p className={cn('text-sm', 'text-muted-foreground', 'mt-1')}>
                  Memindahkan penugasan manager pada booking ini ke manager yang dipilih.
                </p>
              </div>
              <button
                className={cn('rounded-full', 'bg-muted', 'hover:bg-muted/80', 'p-1.5', 'shrink-0')}
                onClick={() => { setManagerTarget(null); setSelectedManagerId(""); }}
                type="button"
                aria-label="Tutup"
              >
                <X weight="BoldDuotone" className={cn('h-5', 'w-5', 'text-foreground')} />
              </button>
            </div>

            <div className="mb-4">
              <p className={cn('text-xs', 'text-muted-foreground', 'mb-1')}>Manager saat ini</p>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <span className={cn('text-sm', 'font-medium', 'text-foreground')}>
                  {managerTarget.manager?.fullName ?? <span className={cn('text-muted-foreground', 'italic')}>Belum ada</span>}
                </span>
                {managerTarget.manager?.fullName && (
                  <span className={cn('text-xs', 'px-2', 'py-0.5', 'rounded-full', 'border', 'border-border', 'bg-muted', 'text-muted-foreground')}>manager</span>
                )}
              </div>
            </div>

            <div>
              <p className={cn('text-xs', 'text-muted-foreground', 'mb-1')}>Pilih Manager</p>
              <SearchableSelect
                options={managers
                  .filter((m) => m.role?.name === "manager" && m.id !== managerTarget.manager?.id)
                  .map((m) => ({ id: m.id, name: m.fullName ?? m.id, badge: "manager" }))}
                value={selectedManagerId}
                onChange={setSelectedManagerId}
                placeholder="Pilih manager tujuan..."
                searchPlaceholder="Cari nama manager..."
                emptyText="Manager tidak ditemukan"
                className="w-full"
              />
            </div>

            <div className={cn('flex', 'gap-3', 'mt-6')}>
              <button
                className={cn('flex-1', 'border', 'border-border', 'rounded-lg', 'py-2', 'font-medium', 'hover:bg-accent', 'transition', 'text-sm')}
                onClick={() => { setManagerTarget(null); setSelectedManagerId(""); }}
                disabled={transferManagerMut.isPending}
                type="button"
              >
                Batal
              </button>
              <button
                className={cn('flex-1', 'bg-primary', 'text-primary-foreground', 'rounded-lg', 'py-2', 'font-medium', 'hover:bg-primary/90', 'transition', 'text-sm', 'disabled:opacity-50', 'disabled:cursor-not-allowed')}
                disabled={!selectedManagerId || transferManagerMut.isPending}
                type="button"
                onClick={async () => {
                  const result = await transferManagerMut.mutateAsync({ bookingId: managerTarget.id, targetManagerId: selectedManagerId });
                  if (!result.success) {
                    toast.error(result.error);
                  } else {
                    toast.success("Manager berhasil ditransfer");
                    refetch();
                    setManagerTarget(null);
                    setSelectedManagerId("");
                  }
                }}
              >
                {transferManagerMut.isPending ? "Mentransfer..." : "Transfer Manager"}
              </button>
            </div>
          </div>
        </div>
      )}
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
          onClose={() => setAgreementModal(null)}
        />
      )}

      {commentTarget && (
        <BookingCommentPanel
          open={!!commentTarget}
          onClose={() => { setCommentTarget(null); qc.invalidateQueries({ queryKey: ["unread-comments"] }); }}
          bookingId={commentTarget.id}
          customerName={commentTarget.snapCustomer?.name ?? ""}
        />
      )}

      {/* Upload Document Modal */}
      {uploadDocTarget && (
        <UploadDocumentModal
          open={!!uploadDocTarget}
          onClose={() => { setUploadDocTarget(null); refetch(); }}
          bookingId={uploadDocTarget.id}
          bookingName={uploadDocTarget.snapCustomer?.name ?? ""}
        />
      )}


      {/* Edit Term of Payment */}
      {topTarget && (
        <EditTopDrawer
          isOpen={!!topTarget}
          onClose={() => { setTopTarget(null); refetch(); }}
          bookingId={topTarget.id}
          customerName={topTarget.snapCustomer?.name ?? ""}
          initialTerms={(topTarget.termOfPayments ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            amount: Number(t.amount),
            dueDate: new Date(t.dueDate).toISOString(),
            sortOrder: t.sortOrder,
            paymentStatus: t.paymentStatus as "unpaid" | "paid" | "partial" | "refund",
            ackStatus: ("ackStatus" in t ? (t as { ackStatus?: string | null }).ackStatus : null) ?? null,
            paymentEvidence: t.paymentEvidence ?? null,
            notes: t.notes,
            partialPayments: "partialPayments" in t
              ? (t as { partialPayments?: { id: string; amount: number; paidAt: Date; evidence: string | null; notes: string | null }[] }).partialPayments
              : undefined,
          }))}
          packagePrice={Number(topTarget.snapPackagePricing?.price ?? 0)}
          discountName={topTarget.discountName ?? null}
          discountAmount={topTarget.discountAmount ?? 0}
        />
      )}

      {/* Edit Set Takeout */}
      {takeoutTarget && (
        <EditTakeoutDrawer
          isOpen={!!takeoutTarget}
          onClose={() => { setTakeoutTarget(null); refetch(); }}
          bookingId={takeoutTarget.id}
          customerName={takeoutTarget.snapCustomer?.name ?? ""}
          initialCategories={(takeoutTarget.snapPackageCategoryPrices ?? []).map((c) => ({
            id: c.id,
            categoryName: c.categoryName,
            basePrice: Number(c.basePrice),
            sortOrder: c.sortOrder,
            isShow: c.isShow,
            isTakeout: c.isTakeout,
            takeoutNominal: Number(c.takeoutNominal ?? 0),
          }))}
          initialTerms={(takeoutTarget.termOfPayments ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            amount: Number(t.amount),
            dueDate: new Date(t.dueDate).toISOString(),
            sortOrder: t.sortOrder,
            paymentStatus: t.paymentStatus as "unpaid" | "paid" | "partial" | "refund",
            ackStatus: ("ackStatus" in t ? (t as { ackStatus?: string | null }).ackStatus : null) ?? null,
            paymentEvidence: t.paymentEvidence ?? null,
            notes: t.notes,
          }))}
          fullPrice={Number(takeoutTarget.snapPackagePricing?.fullPrice ?? 0)}
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
          onClose={() => { setApprovalDialogTarget(null); qc.invalidateQueries({ queryKey: ["bookings"] }); qc.invalidateQueries({ queryKey: ["booking-approvals"] }); }}
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
            qc.invalidateQueries({ queryKey: ["booking-approvals"] });
          }}
          stepId={approveModal.stepId}
          stepLabel={approveModal.stepLabel}
          packageName={approveModal.bookingName}
        />
      )}

    </>
  );
}

/* ─── AgreementModal ──────────────────────────────────────────────────────── */

interface AgreementModalProps {
  bookingId: string;
  customerName: string;
  onClose: () => void;
}

function AgreementModal({ bookingId, customerName, onClose }: AgreementModalProps) {
  const [agreement, setAgreement] = React.useState<{ token: string; accessCode: string; status?: string } | null>(null);
  const [bookingStatus, setBookingStatus] = React.useState<string>("");
  const [isPending, startTransition] = React.useTransition();

  const agreementUrl = agreement ? `${window.location.origin}/client-agreement?token=${agreement.token}` : null;

  const generate = React.useCallback(() => {
    startTransition(async () => {
      const result = await generateAgreementToken(bookingId);
      if (!result.success) { toast.error(result.error); return; }
      setAgreement({ token: result.agreement.token, accessCode: result.agreement.accessCode, status: result.agreement.status });
    });
  }, [bookingId]);

  React.useEffect(() => {
    startTransition(async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) return;
      const data = await res.json() as { bookingStatus?: string; clientAgreement?: { token: string; accessCode: string; status: string } | null };
      if (data.bookingStatus) setBookingStatus(data.bookingStatus);
      // Only show existing agreement if booking is Confirmed or agreement is genuinely pending/sent
      if (data.clientAgreement && (data.bookingStatus === "Confirmed" || data.clientAgreement.status !== "Signed")) {
        setAgreement({ token: data.clientAgreement.token, accessCode: data.clientAgreement.accessCode, status: data.clientAgreement.status });
      }
    });
   
  }, [bookingId]);

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="sm:max-w-md!" style={{ width: "min(calc(100vw - 2rem), 28rem)" }} onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Client Agreement</AlertDialogTitle>
          <AlertDialogDescription>{customerName}</AlertDialogDescription>
        </AlertDialogHeader>

        {isPending ? (
          <div className={cn('flex', 'items-center', 'justify-center', 'py-8', 'gap-2', 'text-sm', 'text-muted-foreground')}>
            <RefreshCw weight="BoldDuotone" className={cn('h-4', 'w-4', 'animate-spin')} /> Loading...
          </div>
        ) : !agreement ? (
          <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-8', 'gap-3', 'text-center')}>
            <p className={cn('text-sm', 'text-muted-foreground')}>Belum ada link agreement untuk booking ini.</p>
            <Button size="sm" onClick={generate} disabled={isPending}>Generate Link</Button>
          </div>
        ) : (
          <div className={cn('space-y-3', 'py-1')}>
            {agreement.status === "Pending" && (
              <div className="rounded-lg border border-border bg-muted/50 p-2.5">
                <p className="text-xs text-muted-foreground font-medium">Link dan kode akses baru sudah otomatis di-generate. Silakan kirimkan ke client untuk menandatangani ulang PO terbaru.</p>
              </div>
            )}
            <div className="space-y-1">
              <p className={cn('text-xs', 'text-muted-foreground', 'font-medium')}>Link Agreement</p>
              <div className={cn('flex', 'items-center', 'gap-2', 'overflow-hidden')}>
                <code className={cn('min-w-0', 'flex-1', 'text-xs', 'bg-muted', 'rounded', 'px-2', 'py-1.5', 'block', 'break-all')}>{agreementUrl}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreementUrl!); toast.success("Link disalin"); }}>
                  <Copy weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className={cn('text-xs', 'text-muted-foreground', 'font-medium')}>Kode Akses</p>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <code className={cn('flex-1', 'text-lg', 'font-mono', 'font-bold', 'tracking-widest', 'bg-muted', 'rounded', 'px-2', 'py-1.5')}>{agreement.accessCode}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreement.accessCode); toast.success("Kode disalin"); }}>
                  <Copy weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          {agreement?.status === "Signed" && bookingStatus === "Confirmed" ? (
            <p className={cn('text-xs', 'text-muted-foreground', 'mr-auto')}>✓ Sudah ditandatangani</p>
          ) : null}
          <AlertDialogCancel onClick={onClose}>Tutup</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
