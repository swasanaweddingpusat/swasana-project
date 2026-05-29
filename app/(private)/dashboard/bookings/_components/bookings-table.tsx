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
import { CalendarDays, ArrowLeft, ArrowRight, Search, Eye, RefreshCw, EllipsisVertical, Trash2, SquareX, RotateCcw, Pencil, ArrowLeftRight, X, FileSignature, Copy, Printer, FileUp, MessageSquare, ClipboardCheck, WalletMinimal, Settings2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { useBookings, useDeleteBooking, useUpdateBooking, useTransferBooking } from "@/hooks/use-bookings";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateAgreementToken } from "@/actions/client-agreement";
import { UploadDocumentModal } from "./upload-document-modal";
import { ActivityLogModal } from "./activity-log-modal";
import { BookingDetailModal } from "./booking-detail-modal";
import { EditTopDrawer } from "./edit-top-drawer";
import { EditPackagePricesDrawer } from "./edit-package-prices-drawer";
import { EditBookingDrawer } from "./edit-booking-drawer";
import { BookingCommentPanel } from "./booking-comment-panel";
import { useUnreadCommentCounts } from "@/hooks/use-unread-comment-counts";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ApproveModal } from "@/app/(private)/dashboard/packages/_components/approve-modal";
import { ApprovalDialog } from "@/app/(private)/dashboard/packages/_components/approval-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { BookingsResult, BookingListItem, SalesProfile } from "@/lib/queries/bookings";

const STATUS_DOT: Record<string, string> = {
  Confirmed: "bg-green-500",
  Uploaded: "bg-blue-500",
  Pending: "bg-orange-400",
  Rejected: "bg-destructive",
  Canceled: "bg-muted-foreground",
  Lost: "bg-muted-foreground",
};

const STATUS_TEXT: Record<string, string> = {
  Confirmed: "text-green-600 border-border",
  Uploaded: "text-blue-600 border-border",
  Pending: "text-orange-500 border-border",
  Rejected: "text-destructive border-destructive/30",
  Canceled: "text-muted-foreground border-border",
  Lost: "text-muted-foreground border-border",
};

const SESSION_STYLE: Record<string, string> = {
  morning: "bg-muted text-amber-600",
  evening: "bg-muted text-indigo-600",
  fullday: "bg-muted text-emerald-600",
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


const ROWS_PER_PAGE = 10;

export function BookingsTable({ initialData, salesProfiles }: { initialData: BookingsResult; salesProfiles: SalesProfile[] }) {
  const qc = useQueryClient();
  const deleteMut = useDeleteBooking();
  const updateMut = useUpdateBooking();
  const transferMut = useTransferBooking();
  const { can, isAdmin } = usePermissions();
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
  const [restoreTarget, setRestoreTarget] = useState<BookingListItem | null>(null);
  const [activityLogTarget, setActivityLogTarget] = useState<BookingListItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<BookingListItem | null>(null);
  const [isGeneratingPO, setIsGeneratingPO] = useState<string | null>(null);
  const [revisionCache, setRevisionCache] = useState<Record<string, { id: string; revisionNumber: number; reason: string | null; packageName: string; variantName: string | null; createdAt: string }[]>>({});
  const [agreementModal, setAgreementModal] = useState<{ bookingId: string; customerName: string } | null>(null);
  const [topTarget, setTopTarget] = useState<BookingListItem | null>(null);
  const [pkgPricesTarget, setPkgPricesTarget] = useState<BookingListItem | null>(null);

  const { data: bookingApprovals = [] } = useQuery<{ id: string; entityId: string; status: string; steps: { id: string; stepOrder: number; approverType: string; approverRoleId: string | null; approverUserId: string | null; status: string; signature: string | null; decidedAt: string | null; notes: string | null; approverRole: { id: string; name: string } | null; approverUser: { id: string; fullName: string | null } | null; decidedBy: { id: string; fullName: string | null } | null }[] }[]>({
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

  async function generatePO(bookingId: string, revisionId?: string) {
    setIsGeneratingPO(bookingId);
    const t = toast.loading("Membuat PDF...");
    try {
      const res = await fetch("/api/render-po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, revisionId }) });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      toast.success("PDF siap!", { id: t });
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error("Gagal membuat PDF", { id: t });
    } finally {
      setIsGeneratingPO(null);
    }
  }

  function fetchRevisions(bookingId: string) {
    fetch(`/api/bookings/${bookingId}/revisions`).then((r) => r.json()).then((res) => {
      const items = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setRevisionCache((p) => ({ ...p, [bookingId]: items }));
    }).catch(() => {});
  }


  const { data: unreadCounts = {} } = useUnreadCommentCounts(bookings.map((b: BookingListItem) => b.id));

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteMut.mutateAsync(deleteTarget.id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Booking dihapus."); refetch(); }
    setDeleteTarget(null);
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'sm:items-center', 'justify-between', 'px-4', 'sm:px-6', 'pb-4', 'gap-3')}>
            <div className={cn('flex', 'items-center', 'gap-3')}>
              <h2 className={cn('text-base', 'font-bold', 'text-[#1D1D1D]')}>Wedding Bookings</h2>
              <span className={cn('text-gray-700', 'text-sm', 'rounded-full', 'border', 'border-gray-200', 'bg-gray-50', 'px-3', 'py-1')}>
                {totalBookings} Bookings
              </span>
              <Button variant="ghost" size="sm" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["booking-approvals"] }); }} disabled={isFetching} className={cn('cursor-pointer', 'hidden', 'sm:flex', 'items-center', 'gap-1.5')}>
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                <span className="text-xs">Refresh</span>
              </Button>
            </div>
            <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2')}>
              <div className={cn('relative', 'flex-1', 'sm:flex-none')}>
                <Search className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'h-4', 'w-4', 'text-gray-400')} />
                <Input placeholder="Cari booking..." value={search} onChange={(e) => setSearch(e.target.value)} className={cn('pl-9', 'w-full', 'sm:w-55')} />
              </div>
              <SearchableSelect
                options={[{ id: "", name: "Semua Venue" }, ...venues.map((v) => ({ id: v.id, name: v.name }))]}
                value={venueFilter}
                onChange={(val) => { setVenueFilter(val); setCurrentPage(1); }}
                placeholder="Filter venue..."
                searchPlaceholder="Cari venue..."
                className="w-40"
              />
              <Button variant="ghost" size="icon" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["booking-approvals"] }); }} disabled={isFetching} className={cn('cursor-pointer', 'sm:hidden', 'shrink-0')}>
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Table */}
          {bookings.length === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-gray-400')}>
              <CalendarDays className={cn('h-10', 'w-10', 'mb-3', 'opacity-40')} />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada booking."}</p>
            </div>
          ) : (
            <div className={cn('w-full', 'overflow-x-auto')}>
              <Table className={cn('w-full', 'text-sm')}>
                <TableHeader className="bg-[#F9FAFB]">
                  <TableRow>
                    <TableHead className={cn('px-2', 'py-2', 'text-[#475467]', 'text-center', 'w-[3%]', 'hidden', 'sm:table-cell')}>No</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-[#475467]')}>Customer</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-[#475467]', 'hidden', 'sm:table-cell', 'w-[15%]')}>Venue & PO</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-[#475467]', 'hidden', 'sm:table-cell', 'w-[14%]')}>Package</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-[#475467]', 'hidden', 'sm:table-cell', 'w-[10%]')}>Event Date</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-[#475467]', 'hidden', 'lg:table-cell', 'w-[8%]')}>Activity</TableHead>
                    <TableHead className={cn('px-2', 'py-2', 'text-[#475467]', 'hidden', 'sm:table-cell', 'w-[8%]')}>Approval</TableHead>
                    <TableHead className={cn('px-1', 'py-2', 'text-[#475467]', 'text-right', 'pr-5', 'w-[15%]')}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking: BookingListItem, idx: number) => (
                    <TableRow key={booking.id} className={cn('hover:bg-gray-50', 'cursor-pointer')} onClick={() => setDetailTarget(booking.id)}>
                      <TableCell className={cn('px-2', 'py-2', 'text-center', 'hidden', 'sm:table-cell')}>{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>

                      {/* Customer cell */}
                      <TableCell className={cn('px-2', 'py-2')}>
                        <div className="overflow-hidden max-w-0 min-w-full">
                          <p className={cn('text-sm', 'font-medium', 'text-gray-900', 'truncate')}>{booking.snapCustomer?.name ?? "—"}</p>
                          <Tooltip>
                            <TooltipTrigger className="block truncate w-full text-left text-xs text-gray-400 mt-0.5">
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
                          {/* Event date — mobile only */}
                          <p className={cn('text-xs', 'text-gray-500', 'mt-0.5', 'sm:hidden')}>{format(new Date(booking.bookingDate), "dd MMM yyyy")}</p>
                          <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-1', 'mt-1')}>
                            {/* Status badge */}
                            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-white", STATUS_TEXT[booking.bookingStatus] ?? "text-gray-600 border-gray-200")}>
                              <span className={cn("w-1 h-1 rounded-full mr-1", STATUS_DOT[booking.bookingStatus] ?? "bg-gray-400")} />
                              {booking.bookingStatus}
                            </span>
                            {/* Payment method badge */}
                            <span className={cn('inline-flex', 'items-center', 'px-1.5', 'py-0.5', 'rounded-full', 'border', 'border-gray-200', 'bg-gray-50', 'text-gray-600', 'text-[10px]', 'font-medium')}>
                              {booking.paymentMethod?.bankName ?? "N/A"}
                            </span>
                            {/* Session badge */}
                            {booking.weddingSession && (
                              <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium", SESSION_STYLE[booking.weddingSession] ?? "bg-gray-100 text-gray-600")}>
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
                              className={cn('inline-flex', 'items-center', 'max-w-full', 'px-1.5', 'py-0.5', 'rounded', 'bg-gray-100', 'text-[10px]', 'font-mono', 'text-gray-500', 'hover:bg-gray-200', 'transition-colors', 'cursor-pointer', 'truncate', 'mt-0.5')}
                            >
                              <span className="truncate">{booking.poNumber}</span>
                            </button>
                          ) : (
                            <span className={cn('text-gray-300', 'text-[10px]', 'block', 'mt-0.5')}>No PO</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Package cell */}
                      <TableCell className={cn('px-2', 'py-2', 'hidden', 'sm:table-cell')}>
                        <div className="leading-tight">
                          <span className={cn('truncate', 'block')}>{booking.snapPackage?.packageName ?? "—"}</span>
                          {booking.snapPackageVariant && (
                            <>
                              <span className={cn('text-xs', 'text-gray-400', 'block')}>{booking.snapPackageVariant.variantName}</span>
                              <span className={cn('text-xs', 'text-gray-400', 'block')}>{booking.snapPackageVariant.pax} PAX · {fmtRp(Math.max(0, Number(booking.snapPackageVariant.price) - (booking.discountAmount ?? 0)))}</span>
                            </>
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
                      <TableCell className={cn('px-2', 'py-2', 'hidden', 'sm:table-cell')} onClick={(e) => e.stopPropagation()}>
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
                          {/* Agreement modal trigger — hidden on mobile */}
                          {can("booking", "client-agreement") && (booking.clientAgreement?.status !== "Signed" || (approvalMap.get(booking.id)?.steps.some((s) => s.approverType === "client" && s.status === "pending"))) && (
                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger render={<Button variant="ghost" size="icon" className={cn('cursor-pointer', 'hidden', 'sm:inline-flex')} onClick={(e) => { e.stopPropagation(); setAgreementModal({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Client" }); }} />}>
                                <FileSignature className={cn('h-4', 'w-4')} />
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Client Agreement</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          )}

                          {/* Comment button */}
                          <PermissionGate module="booking" action="comment">
                            <Button variant="ghost" size="icon" className={cn('cursor-pointer', 'relative')} onClick={() => setCommentTarget(booking)}>
                              <MessageSquare className={cn('h-4', 'w-4')} />
                              {(unreadCounts[booking.id] ?? 0) > 0 && (
                                <span className={cn('absolute', '-top-0.5', '-right-0.5', 'min-w-4', 'h-4', 'rounded-full', 'bg-destructive', 'text-destructive-foreground', 'text-[9px]', 'font-bold', 'flex', 'items-center', 'justify-center', 'px-0.5')}>
                                  {unreadCounts[booking.id] > 9 ? "9+" : unreadCounts[booking.id]}
                                </span>
                              )}
                            </Button>
                          </PermissionGate>

                          {/* Booking Approval dropdown */}
                          {approvalMap.has(booking.id) && (() => {
                            const record = approvalMap.get(booking.id)!;
                            const allSteps = record.steps;
                            // Show only latest round: detect round size from first repeated approver pattern
                            const firstStep = allSteps[0];
                            let roundSize = allSteps.length;
                            for (let i = 1; i < allSteps.length; i++) {
                              if (allSteps[i].approverType === firstStep?.approverType && allSteps[i].approverRoleId === firstStep?.approverRoleId && allSteps[i].approverUserId === firstStep?.approverUserId) {
                                roundSize = i;
                                break;
                              }
                            }
                            const steps = allSteps.slice(-roundSize);
                            const nonClientSteps = steps.filter((s) => s.approverType !== "client");
                            if (nonClientSteps.every((s) => s.status === "approved")) return null;
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} title="Approval">
                                    <ClipboardCheck className={cn('h-4', 'w-4', 'text-muted-foreground')} />
                                  </button>
                                </DropdownMenuTrigger>
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

                          {/* More actions dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="cursor-pointer">
                                <EllipsisVertical className={cn('h-4', 'w-4')} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setDetailTarget(booking.id)}>
                                <Eye className={cn('mr-2', 'h-4', 'w-4')} /> Lihat Detail
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {can("booking", "edit") && (
                              <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditTarget(booking); }}>
                                <Pencil className={cn('mr-2', 'h-4', 'w-4')} /> Edit Booking
                              </DropdownMenuItem>
                              )}
                              {booking.bookingStatus === "Confirmed" && can("booking", "print") && (
                                <DropdownMenuSub onOpenChange={(open) => { if (open) fetchRevisions(booking.id); }}>
                                  <DropdownMenuSubTrigger className="cursor-pointer">
                                    <Printer className={cn('mr-2', 'h-4', 'w-4')} /> {isGeneratingPO === booking.id ? "Generating..." : "Cetak PO Booking"}
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    <DropdownMenuItem className="cursor-pointer" disabled={isGeneratingPO === booking.id} onClick={() => generatePO(booking.id)}>
                                      Cetak Terbaru (Live)
                                    </DropdownMenuItem>
                                    {(revisionCache[booking.id] ?? []).length > 0 && <DropdownMenuSeparator />}
                                    {(revisionCache[booking.id] ?? []).map((rev) => (
                                      <DropdownMenuItem key={rev.id} className="cursor-pointer" disabled={isGeneratingPO === booking.id} onClick={() => generatePO(booking.id, rev.id)}>
                                        <span className="truncate">Rev {rev.revisionNumber} — {rev.packageName}{rev.variantName ? ` (${rev.variantName})` : ""}</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              )}
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setUploadDocTarget(booking)}>
                                <FileUp className={cn('mr-2', 'h-4', 'w-4')} /> Upload Dokumen
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setTopTarget(booking)}>
                                <WalletMinimal className={cn('mr-2', 'h-4', 'w-4')} /> Edit TOP
                              </DropdownMenuItem>
                              {can("booking", "edit") &&
                                booking.snapPackageCategoryPrices &&
                                booking.snapPackageCategoryPrices.length > 0 && (
                                <DropdownMenuItem className="cursor-pointer" onClick={() => setPkgPricesTarget(booking)}>
                                  <Settings2 className={cn('mr-2', 'h-4', 'w-4')} /> Edit Set Harga
                                </DropdownMenuItem>
                              )}
                              {can("booking", "transfer") && (
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setTransferTarget(booking)}>
                                <ArrowLeftRight className={cn('mr-2', 'h-4', 'w-4')} /> Transfer Booking
                              </DropdownMenuItem>
                              )}
                              {((can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost") || (can("booking", "mark-lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed") || (can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed"))) && <DropdownMenuSeparator />}
                              {can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost" && (
                                <DropdownMenuItem className="cursor-pointer" onClick={() => setRejectTarget(booking)}>
                                  <SquareX className={cn('mr-2', 'h-4', 'w-4', 'text-red-500')} /> Reject Booking
                                </DropdownMenuItem>
                              )}
                              {can("booking", "mark-lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed" && (
                                <DropdownMenuItem className={cn('cursor-pointer', 'text-muted-foreground', 'focus:text-foreground')} onClick={() => setLostTarget(booking)}>
                                  <SquareX className={cn('mr-2', 'h-4', 'w-4')} /> Lost Booking
                                </DropdownMenuItem>
                              )}
                              {can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed") && (
                                <DropdownMenuItem className={cn('cursor-pointer', 'text-muted-foreground', 'focus:text-foreground')} onClick={() => setRestoreTarget(booking)}>
                                  <RotateCcw className={cn('mr-2', 'h-4', 'w-4')} /> Restore Booking
                                </DropdownMenuItem>
                              )}
                              {can("booking", "delete") && <DropdownMenuSeparator />}
                              {can("booking", "delete") && (
                              <DropdownMenuItem className={cn('cursor-pointer', 'text-red-600', 'focus:text-red-600')} onClick={() => setDeleteTarget(booking)}>
                                <Trash2 className={cn('mr-2', 'h-4', 'w-4')} /> Hapus
                              </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={cn('flex', 'justify-between', 'items-center', 'px-4', 'sm:px-6', 'py-4', 'border-t')}>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ArrowLeft className={cn('w-4', 'h-4', 'sm:mr-2')} /> <span className={cn('hidden', 'sm:inline')}>Previous</span>
              </Button>
              {/* Mobile: page X/Y */}
              <span className={cn('text-sm', 'text-muted-foreground', 'sm:hidden')}>{currentPage} / {totalPages}</span>
              {/* Desktop: page numbers */}
              <div className={cn('hidden', 'sm:flex', 'items-center', 'gap-1')}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === page ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100")}>
                    {page}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                <span className={cn('hidden', 'sm:inline')}>Next</span> <ArrowRight className={cn('w-4', 'h-4', 'sm:ml-2')} />
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
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/40')}>
          <div className={cn('bg-white', 'rounded-2xl', 'shadow-xl', 'w-full', 'max-w-md', 'p-6', 'relative')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-4', 'mb-4')}>
              <div>
                <h2 className={cn('text-lg', 'font-bold', 'text-[#19202C]')}>Reject Booking</h2>
                <p className={cn('text-sm', 'text-gray-500', 'mt-1')}>
                  Reject booking <span className={cn('font-semibold', 'text-gray-800')}>{rejectTarget.snapCustomer?.name}</span>?
                </p>
              </div>
              <button
                type="button"
                className={cn('rounded-full', 'bg-red-100', 'hover:bg-red-200', 'p-1.5', 'shrink-0')}
                onClick={() => { setRejectTarget(null); setRejectNotes(""); }}
                aria-label="Tutup"
              >
                <svg className={cn('h-5', 'w-5', 'text-red-500')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mb-4">
              <label className={cn('text-sm', 'font-medium', 'text-gray-700', 'mb-2', 'block')}>Alasan Penolakan</label>
              <Input placeholder="Alasan penolakan (opsional)..." value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
            </div>

            <div className={cn('flex', 'gap-3')}>
              <button
                type="button"
                className={cn('flex-1', 'bg-red-600', 'text-white', 'rounded-lg', 'py-2', 'font-medium', 'text-sm', 'hover:bg-red-700', 'transition', 'disabled:opacity-50', 'disabled:cursor-not-allowed')}
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
                className={cn('flex-1', 'border', 'border-gray-300', 'rounded-lg', 'py-2', 'font-medium', 'text-sm', 'hover:bg-gray-100', 'transition')}
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
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/40')}>
          <div className={cn('bg-white', 'rounded-2xl', 'shadow-xl', 'w-full', 'max-w-md', 'p-6', 'relative')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-4', 'mb-4')}>
              <div>
                <h2 className={cn('text-lg', 'font-bold', 'text-[#19202C]')}>Restore Booking</h2>
                <p className={cn('text-sm', 'text-gray-500', 'mt-1')}>
                  Restore booking <span className={cn('font-semibold', 'text-gray-800')}>{restoreTarget.snapCustomer?.name}</span> ke status Pending?
                </p>
              </div>
              <button type="button" className={cn('rounded-full', 'hover:bg-muted', 'p-1.5', 'shrink-0')} onClick={() => setRestoreTarget(null)} aria-label="Tutup">
                <svg className={cn('h-5', 'w-5', 'text-muted-foreground')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
        <div className={cn('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'bg-black/40')}>
          <div className={cn('bg-white', 'rounded-2xl', 'shadow-xl', 'w-full', 'max-w-md', 'p-6', 'relative')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-4', 'mb-6')}>
              <div>
                <h2 className={cn('text-lg', 'font-bold', 'text-[#19202C]')}>Transfer Booking</h2>
                <p className={cn('text-sm', 'text-gray-500', 'mt-1')}>
                  Memindahkan kepemilikan data booking dari sales sebelumnya ke sales yang dipilih.
                </p>
              </div>
              <button
                className={cn('rounded-full', 'bg-red-100', 'hover:bg-red-200', 'p-1.5', 'shrink-0')}
                onClick={() => { setTransferTarget(null); setTransferSalesId(""); }}
                type="button"
                aria-label="Tutup"
              >
                <X className={cn('h-5', 'w-5', 'text-red-500')} />
              </button>
            </div>

            <div className="mb-4">
              <p className={cn('text-xs', 'text-gray-400', 'mb-1')}>Sales saat ini</p>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <span className={cn('text-sm', 'font-medium', 'text-gray-800')}>
                  {transferTarget.sales?.fullName ?? <span className={cn('text-gray-400', 'italic')}>Tidak ada</span>}
                </span>
                {transferTarget.sales?.fullName && (
                  <span className={cn('text-xs', 'px-2', 'py-0.5', 'rounded-full', 'border', 'border-gray-200', 'bg-gray-50', 'text-gray-500')}>sales</span>
                )}
              </div>
            </div>

            <div>
              <p className={cn('text-xs', 'text-gray-400', 'mb-1')}>Pilih Sales</p>
              <SearchableSelect
                options={salesProfiles
                  .filter((s) => s.id !== transferTarget.salesId)
                  .map((s) => ({ id: s.id, name: s.fullName ?? s.id, badge: "sales" }))}
                value={transferSalesId}
                onChange={setTransferSalesId}
                placeholder="Pilih sales tujuan..."
                searchPlaceholder="Cari nama sales..."
                emptyText="Sales tidak ditemukan"
              />
            </div>

            <div className={cn('flex', 'gap-3', 'mt-6')}>
              <button
                className={cn('flex-1', 'border', 'border-gray-300', 'rounded-lg', 'py-2', 'font-medium', 'hover:bg-gray-100', 'transition', 'text-sm')}
                onClick={() => { setTransferTarget(null); setTransferSalesId(""); }}
                disabled={transferMut.isPending}
                type="button"
              >
                Batal
              </button>
              <button
                className={cn('flex-1', 'bg-black', 'text-white', 'rounded-lg', 'py-2', 'font-medium', 'hover:bg-gray-900', 'transition', 'text-sm', 'disabled:opacity-50', 'disabled:cursor-not-allowed')}
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


      {/* Edit TOP Drawer */}
      {topTarget && (
        <EditTopDrawer
          isOpen={!!topTarget}
          onClose={() => { setTopTarget(null); refetch(); }}
          bookingId={topTarget.id}
          customerName={topTarget.snapCustomer?.name ?? ""}
          initialTerms={(topTarget.termOfPayments ?? []).map((t) => ({
            id: t.id, name: t.name, amount: Number(t.amount),
            dueDate: new Date(t.dueDate).toISOString(), sortOrder: t.sortOrder,
            paymentStatus: t.paymentStatus as "unpaid" | "paid" | "partial",
            paymentEvidence: t.paymentEvidence ?? null, notes: t.notes,
            partialPayments: "partialPayments" in t ? (t as { partialPayments?: { id: string; amount: number; paidAt: Date; evidence: string | null; notes: string | null }[] }).partialPayments : undefined,
          }))}
          packagePrice={Number(topTarget.snapPackageVariant?.price ?? 0)}
          discountName={topTarget.discountName ?? null}
          discountAmount={topTarget.discountAmount ?? 0}
        />
      )}

      {pkgPricesTarget && (
        <EditPackagePricesDrawer
          isOpen={!!pkgPricesTarget}
          onClose={() => setPkgPricesTarget(null)}
          bookingId={pkgPricesTarget.id}
          customerName={pkgPricesTarget.snapCustomer?.name ?? ""}
          initialCategories={(pkgPricesTarget.snapPackageCategoryPrices ?? []).map((c) => ({
            id: c.id,
            categoryName: c.categoryName,
            basePrice: Number(c.basePrice),
            sortOrder: c.sortOrder,
            isShow: c.isShow,
            isTakeout: c.isTakeout,
          }))}
          margin={pkgPricesTarget.snapPackageVariant?.margin ?? 0}
        />
      )}

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
            <RefreshCw className={cn('h-4', 'w-4', 'animate-spin')} /> Loading...
          </div>
        ) : !agreement ? (
          <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-8', 'gap-3', 'text-center')}>
            <p className={cn('text-sm', 'text-muted-foreground')}>Belum ada link agreement untuk booking ini.</p>
            <Button size="sm" onClick={generate} disabled={isPending}>Generate Link</Button>
          </div>
        ) : (
          <div className={cn('space-y-3', 'py-1')}>
            {agreement.status === "Pending" && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                <p className="text-xs text-orange-700 font-medium">⚠️ Booking telah diubah. Silakan regenerate link agar client dapat menandatangani ulang PO terbaru.</p>
              </div>
            )}
            <div className="space-y-1">
              <p className={cn('text-xs', 'text-muted-foreground', 'font-medium')}>Link Agreement</p>
              <div className={cn('flex', 'items-center', 'gap-2', 'overflow-hidden')}>
                <code className={cn('min-w-0', 'flex-1', 'text-xs', 'bg-muted', 'rounded', 'px-2', 'py-1.5', 'block', 'break-all')}>{agreementUrl}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreementUrl!); toast.success("Link disalin"); }}>
                  <Copy className={cn('h-3.5', 'w-3.5')} />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className={cn('text-xs', 'text-muted-foreground', 'font-medium')}>Kode Akses</p>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <code className={cn('flex-1', 'text-lg', 'font-mono', 'font-bold', 'tracking-widest', 'bg-muted', 'rounded', 'px-2', 'py-1.5')}>{agreement.accessCode}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreement.accessCode); toast.success("Kode disalin"); }}>
                  <Copy className={cn('h-3.5', 'w-3.5')} />
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          {agreement?.status === "Signed" && bookingStatus === "Confirmed" ? (
            <p className={cn('text-xs', 'text-muted-foreground', 'mr-auto')}>✓ Sudah ditandatangani</p>
          ) : agreement ? (
            <Button variant="outline" size="default" disabled={isPending} onClick={generate}>
              <RefreshCw className={cn('h-3.5', 'w-3.5', 'mr-1')} /> Regenerate
            </Button>
          ) : null}
          <AlertDialogCancel onClick={onClose}>Tutup</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
