"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, CalendarDays, ArrowLeft, ArrowRight, Search, Eye, RefreshCw, EllipsisVertical, Trash2, Store, SquareX, RotateCcw, Pencil, ArrowLeftRight, X, FileSignature, Copy, Printer, CircleFadingPlus, FileUp, ListChecks, Palette, MessageSquare } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { useBookings, useDeleteBooking, useUpdateBooking, useTransferBooking } from "@/hooks/use-bookings";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateAgreementToken } from "@/actions/client-agreement";
import { approveCategoryPO } from "@/actions/catering-approval";
import { BookingDrawer } from "./booking-drawer";
import { useBookingDrawer } from "@/components/providers/booking-drawer-provider";
import { UploadDocumentModal } from "./upload-document-modal";
import { EditTopDrawer } from "./edit-top-drawer";
import { ActivityLogModal } from "./activity-log-modal";
import { BookingDetailModal } from "./booking-detail-modal";
import { EditBookingDrawer } from "./edit-booking-drawer";
import { SetVendorDrawer } from "./set-vendor-drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { CateringSelectionDrawer } from "./catering-selection-drawer";
import { DecorationSelectionDrawer } from "./decoration-selection-drawer";
import { BookingCommentPanel } from "./booking-comment-panel";
import { useUnreadCommentCounts } from "@/hooks/use-unread-comment-counts";
import { PermissionGate } from "@/components/shared/permission-gate";
import { Drawer } from "@/components/shared/drawer";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import type { BookingsResult, BookingListItem, SalesProfile } from "@/lib/queries/bookings";

const ROWS_PER_PAGE = 10;

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

export function BookingsTable({ initialData, salesProfiles }: { initialData: BookingsResult; salesProfiles: SalesProfile[] }) {
  const { data: bookings = initialData, refetch, isFetching } = useBookings(initialData);
  const qc = useQueryClient();
  const deleteMut = useDeleteBooking();
  const updateMut = useUpdateBooking();
  const transferMut = useTransferBooking();
  const { can } = usePermissions();
  const { user } = useCurrentUser();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const { openBookingDrawer } = useBookingDrawer();

  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null);
  const [editTarget, setEditTarget] = useState<BookingListItem | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<BookingListItem | null>(null);
  const [approveModalData, setApproveModalData] = useState<{ stepId: string; stepLabel: string; bookingName: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BookingListItem | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [lostTarget, setLostTarget] = useState<BookingListItem | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [transferTarget, setTransferTarget] = useState<BookingListItem | null>(null);
  const [uploadDocTarget, setUploadDocTarget] = useState<BookingListItem | null>(null);
  const [topTarget, setTopTarget] = useState<BookingListItem | null>(null);
  const [transferSalesId, setTransferSalesId] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<BookingListItem | null>(null);
  const [activityLogTarget, setActivityLogTarget] = useState<BookingListItem | null>(null);
  const [vendorApproveModal, setVendorApproveModal] = useState<{ open: boolean; bookingId: string; role: "finance" | "dirops" | "oprations"; roleLabel: string; categoryType: "catering" | "decoration" }>({ open: false, bookingId: "", role: "finance", roleLabel: "", categoryType: "catering" });
  const [hasVendorSigned, setHasVendorSigned] = useState(false);
  const [isApprovingVendor, setIsApprovingVendor] = useState(false);
  const sigVendorRef = useRef<SignatureCanvas>(null);
  const [approvalCache, setApprovalCache] = useState<Record<string, Record<string, unknown>>>({});
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [vendorTarget, setVendorTarget] = useState<BookingListItem | null>(null);
  const [cateringTarget, setCateringTarget] = useState<string | null>(null);
  const [decorationTarget, setDecorationTarget] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<BookingListItem | null>(null);
  const [isGeneratingPO, setIsGeneratingPO] = useState<string | null>(null);
  const [agreementModal, setAgreementModal] = useState<{ bookingId: string; customerName: string } | null>(null);

  const { data: bookingApprovals = [] } = useQuery<{ id: string; entityId: string; status: string; steps: { id: string; stepOrder: number; approverType: string; approverRoleId: string | null; approverUserId: string | null; status: string; signature: string | null; decidedAt: string | null; notes: string | null; approverRole: { id: string; name: string } | null; approverUser: { id: string; fullName: string | null } | null; decidedBy: { id: string; fullName: string | null } | null }[] }[]>({
    queryKey: ["booking-approvals"],
    queryFn: async () => {
      const res = await fetch("/api/approval-records?module=booking");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const approvalMap = new Map(bookingApprovals.map((r) => [r.entityId, r]));

  const filtered = bookings.filter((b: BookingListItem) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.snapCustomer?.name ?? "").toLowerCase().includes(q) ||
      (b.snapCustomer?.mobileNumber ?? "").toLowerCase().includes(q) ||
      (b.snapVenue?.venueName ?? "").toLowerCase().includes(q) ||
      (b.snapPackage?.packageName ?? "").toLowerCase().includes(q) ||
      (b.sales?.fullName ?? "").toLowerCase().includes(q) ||
      (b.bookingStatus ?? "").toLowerCase().includes(q) ||
      (b.poNumber ?? "").toLowerCase().includes(q) ||
      (b.paymentMethod?.bankName ?? "").toLowerCase().includes(q) ||
      (b.sourceOfInformation?.name ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  const { data: unreadCounts = {} } = useUnreadCommentCounts(paginated.map((b: BookingListItem) => b.id));

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-[#1D1D1D]">Wedding Bookings</h2>
              <span className="text-gray-700 text-sm rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                {filtered.length} {search ? `dari ${bookings.length}` : "Bookings"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="cursor-pointer hidden sm:flex items-center gap-1.5">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                <span className="text-xs">Refresh</span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Cari booking..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9 w-full sm:w-55" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} className="cursor-pointer sm:hidden shrink-0">
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CalendarDays className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada booking."}</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-[#F9FAFB]">
                  <TableRow>
                    <TableHead className="px-2 py-2 text-[#475467] text-center w-[3%] hidden sm:table-cell">No</TableHead>
                    <TableHead className="px-2 py-2 text-[#475467]">Customer</TableHead>
                    <TableHead className="px-2 py-2 text-[#475467] hidden sm:table-cell w-[15%]">Venue & PO</TableHead>
                    <TableHead className="px-2 py-2 text-[#475467] hidden sm:table-cell w-[14%]">Package</TableHead>
                    <TableHead className="px-2 py-2 text-[#475467] hidden sm:table-cell w-[10%]">Event Date</TableHead>
                    <TableHead className="px-2 py-2 text-[#475467] hidden lg:table-cell w-[8%]">Activity</TableHead>
                    <TableHead className="px-2 py-2 text-[#475467] hidden sm:table-cell w-[8%]">Approval</TableHead>
                    <TableHead className="px-1 py-2 text-[#475467] text-right pr-5 w-[15%]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((booking: BookingListItem, idx: number) => (
                    <TableRow key={booking.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailTarget(booking.id)}>
                      <TableCell className="px-2 py-2 text-center hidden sm:table-cell">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>

                      {/* Customer cell */}
                      <TableCell className="px-2 py-2">
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium text-gray-900 truncate">{booking.snapCustomer?.name ?? "—"}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {(() => {
                              const raw = booking.snapCustomer?.mobileNumber ?? "";
                              try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr.map((e: { name?: string; number: string }) => e.name ? `${e.name}: ${e.number}` : e.number).join(", "); } catch { /* not JSON */ }
                              return raw;
                            })()}
                          </p>
                          {/* Event date — mobile only */}
                          <p className="text-xs text-gray-500 mt-0.5 sm:hidden">{format(new Date(booking.bookingDate), "dd MMM yyyy")}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {/* Status badge */}
                            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-white", STATUS_TEXT[booking.bookingStatus] ?? "text-gray-600 border-gray-200")}>
                              <span className={cn("w-1 h-1 rounded-full mr-1", STATUS_DOT[booking.bookingStatus] ?? "bg-gray-400")} />
                              {booking.bookingStatus}
                            </span>
                            {/* Payment method badge */}
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 text-[10px] font-medium">
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
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                {booking.sourceOfInformation.name}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActivityLogTarget(booking); }}
                            className="cursor-pointer mt-1 text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 text-left lg:hidden"
                          >
                            Lihat Activity
                          </button>
                        </div>
                      </TableCell>

                      {/* Venue cell */}
                      <TableCell className="px-2 py-2 hidden sm:table-cell">
                        <div className="leading-tight">
                          <span className="block truncate text-sm font-medium">{booking.snapVenue?.venueName ?? "—"}</span>
                          {booking.poNumber ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(booking.poNumber!); toast.success("PO Number copied!", { duration: 1500 }); }}
                              className="inline-flex items-center max-w-full px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-mono text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer truncate mt-0.5"
                            >
                              <span className="truncate">{booking.poNumber}</span>
                            </button>
                          ) : (
                            <span className="text-gray-300 text-[10px] block mt-0.5">No PO</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Package cell */}
                      <TableCell className="px-2 py-2 hidden sm:table-cell">
                        <div className="leading-tight">
                          <span className="truncate block">{booking.snapPackage?.packageName ?? "—"}</span>
                          {booking.snapPackageVariant && (
                            <>
                              <span className="text-xs text-gray-400 block">{booking.snapPackageVariant.variantName}</span>
                              <span className="text-xs text-gray-400 block">{booking.snapPackageVariant.pax} PAX · {fmtRp(booking.snapPackageVariant.price)}</span>
                            </>
                          )}
                        </div>
                      </TableCell>

                      {/* Event Date */}
                      <TableCell className="px-2 py-2 whitespace-nowrap text-sm hidden sm:table-cell">
                        {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
                      </TableCell>

                      {/* Activity */}
                      <TableCell className="px-2 py-2 hidden lg:table-cell">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActivityLogTarget(booking); }}
                          className="cursor-pointer text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        >
                          Lihat Activity
                        </button>
                      </TableCell>

                      {/* Approval */}
                      <TableCell className="px-2 py-2 hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const record = approvalMap.get(booking.id);
                          if (!record) return <span className="text-xs text-muted-foreground">—</span>;
                          return (
                            <button
                              type="button"
                              onClick={() => setApprovalTarget(booking)}
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
                      <TableCell className="px-1 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {/* Set Vendor Bawaan — hidden on mobile */}
                          {can("booking", "edit") && (
                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger render={<Button variant="ghost" size="icon" className="cursor-pointer hidden sm:inline-flex" onClick={(e) => { e.stopPropagation(); setVendorTarget(booking); }} />}>
                                <Store className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Set Vendor Bawaan</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          )}

                          {/* Agreement modal trigger — hidden on mobile */}
                          {can("client_agreement", "create") && booking.clientAgreement?.status !== "Signed" && (
                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger render={<Button variant="ghost" size="icon" className="cursor-pointer hidden sm:inline-flex" onClick={(e) => { e.stopPropagation(); setAgreementModal({ bookingId: booking.id, customerName: booking.snapCustomer?.name ?? "Client" }); }} />}>
                                <FileSignature className="h-4 w-4" />
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Client Agreement</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          )}

                          {/* Catering + Decoration — only for Confirmed bookings, hidden on mobile */}
                          {booking.bookingStatus === "Confirmed" && (
                            <div className="hidden sm:contents">
                              {/* Catering */}
                              <TooltipProvider delay={200}>
                                <Tooltip>
                                  <TooltipTrigger render={<span />}>
                                    <DropdownMenu onOpenChange={(open) => {
                                      if (open) fetch(`/api/bookings/${booking.id}/catering-approval?category=catering`).then((r) => r.json()).then((d) => setApprovalCache((p) => ({ ...p, [`${booking.id}_catering`]: d }))).catch(() => {});
                                    }}>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                          <CircleFadingPlus className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenuItem className="cursor-pointer" onClick={() => setCateringTarget(booking.id)}>
                                          <Pencil className="mr-2 h-4 w-4" /> Edit Catering
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {can("booking", "approve_finance") && (
                                        <DropdownMenuItem className="cursor-pointer" disabled={!!approvalCache[`${booking.id}_catering`]?.finance}
                                          onClick={() => !approvalCache[`${booking.id}_catering`]?.finance && setVendorApproveModal({ open: true, bookingId: booking.id, role: "finance", roleLabel: "Finance", categoryType: "catering" })}>
                                          {approvalCache[`${booking.id}_catering`]?.finance ? "Finance Approved ✓" : "Approve Finance"}
                                        </DropdownMenuItem>
                                        )}
                                        {can("booking", "approve_manager") && (
                                        <DropdownMenuItem className="cursor-pointer" disabled={!!approvalCache[`${booking.id}_catering`]?.dirops}
                                          onClick={() => !approvalCache[`${booking.id}_catering`]?.dirops && setVendorApproveModal({ open: true, bookingId: booking.id, role: "dirops", roleLabel: "Direktur Ops", categoryType: "catering" })}>
                                          {approvalCache[`${booking.id}_catering`]?.dirops ? "Direktur Ops Approved ✓" : "Approve Direktur Ops"}
                                        </DropdownMenuItem>
                                        )}
                                      {can("booking", "approve_operations") && (
                                      <DropdownMenuItem className="cursor-pointer" disabled={!!approvalCache[`${booking.id}_catering`]?.oprations}
                                        onClick={() => !approvalCache[`${booking.id}_catering`]?.oprations && setVendorApproveModal({ open: true, bookingId: booking.id, role: "oprations", roleLabel: "Oprations", categoryType: "catering" })}>
                                        {approvalCache[`${booking.id}_catering`]?.oprations ? "Oprations Approved ✓" : "Approve Oprations"}
                                      </DropdownMenuItem>
                                      )}
                                      {(can("booking", "approve_finance") || can("booking", "approve_manager") || can("booking", "approve_operations")) && <DropdownMenuSeparator />}
                                      {can("booking", "print") && (
                                      <DropdownMenuItem className="cursor-pointer" onClick={async () => {
                                        const t = toast.loading("Membuat PDF Catering...");
                                        try {
                                          const res = await fetch("/api/render-catering-po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id }) });
                                          if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
                                          const blob = await res.blob();
                                          const url = URL.createObjectURL(blob);
                                          toast.success("PDF siap!", { id: t });
                                          window.open(url, "_blank");
                                          setTimeout(() => URL.revokeObjectURL(url), 10000);
                                        } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal membuat PDF", { id: t }); }
                                      }}>
                                        <Printer className="mr-2 h-4 w-4" /> Cetak PO Catering
                                      </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p className="text-xs">Catering PO</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                              {/* Decoration */}
                              <TooltipProvider delay={200}>
                                <Tooltip>
                                  <TooltipTrigger render={<span />}>
                                    <Button variant="ghost" size="icon" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setDecorationTarget(booking.id); }}>
                                      <Palette className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top"><p className="text-xs">Dekorasi PO</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          )}

                          {/* Comment button */}
                          <PermissionGate module="booking" action="comment">
                            <Button variant="ghost" size="icon" className="cursor-pointer relative" onClick={() => setCommentTarget(booking)}>
                              <MessageSquare className="h-4 w-4" />
                              {(unreadCounts[booking.id] ?? 0) > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                                  {unreadCounts[booking.id] > 9 ? "9+" : unreadCounts[booking.id]}
                                </span>
                              )}
                            </Button>
                          </PermissionGate>

                          {/* More actions dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="cursor-pointer">
                                <EllipsisVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setDetailTarget(booking.id)}>
                                <Eye className="mr-2 h-4 w-4" /> Lihat Detail
                              </DropdownMenuItem>
                              {(() => {
                                const record = approvalMap.get(booking.id);
                                if (!record) return null;
                                return record.steps.map((step) => {
                                  const label = step.approverType === "client" ? "Client" : step.approverType === "role" ? step.approverRole?.name : step.approverUser?.fullName;
                                  const isApproved = step.status === "approved";
                                  const isRejected = step.status === "rejected";
                                  return (
                                    <DropdownMenuItem key={step.id} disabled className="cursor-default text-xs">
                                      {isApproved ? `✓ ${label}` : isRejected ? `✗ ${label}` : `⏳ ${label}`}
                                    </DropdownMenuItem>
                                  );
                                });
                              })()}
                              <DropdownMenuSeparator />
                              {can("booking", "edit") && (
                              <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditTarget(booking); }}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Booking
                              </DropdownMenuItem>
                              )}
                              {can("booking", "transfer") && (
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setTransferTarget(booking)}>
                                <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer Booking
                              </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setUploadDocTarget(booking)}>
                                <FileUp className="mr-2 h-4 w-4" /> Upload Dokumen
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer" onClick={() => setTopTarget(booking)}>
                                <ListChecks className="mr-2 h-4 w-4" /> Edit TOP
                              </DropdownMenuItem>
                              {booking.bookingStatus === "Confirmed" && can("booking", "print") && (
                                <DropdownMenuItem className="cursor-pointer" disabled={isGeneratingPO === booking.id} onClick={async () => {
                                  setIsGeneratingPO(booking.id);
                                  const t = toast.loading("Membuat PDF...");
                                  try {
                                    const res = await fetch("/api/render-po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: booking.id }) });
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
                                }}>
                                  <Printer className="mr-2 h-4 w-4" /> {isGeneratingPO === booking.id ? "Generating..." : "Cetak PO Booking"}
                                </DropdownMenuItem>
                              )}
                              {((can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost") || (can("booking", "mark_lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed") || (can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed"))) && <DropdownMenuSeparator />}
                              {can("booking", "reject") && booking.bookingStatus !== "Confirmed" && booking.bookingStatus !== "Lost" && (
                                <DropdownMenuItem className="cursor-pointer" onClick={() => setRejectTarget(booking)}>
                                  <SquareX className="mr-2 h-4 w-4 text-red-500" /> Reject Booking
                                </DropdownMenuItem>
                              )}
                              {can("booking", "mark_lost") && booking.bookingStatus !== "Lost" && booking.bookingStatus !== "Confirmed" && (
                                <DropdownMenuItem className="cursor-pointer text-muted-foreground focus:text-foreground" onClick={() => setLostTarget(booking)}>
                                  <SquareX className="mr-2 h-4 w-4" /> Lost Booking
                                </DropdownMenuItem>
                              )}
                              {can("booking", "restore") && (booking.bookingStatus === "Lost" || booking.bookingStatus === "Confirmed") && (
                                <DropdownMenuItem className="cursor-pointer text-muted-foreground focus:text-foreground" onClick={() => setRestoreTarget(booking)}>
                                  <RotateCcw className="mr-2 h-4 w-4" /> Restore Booking
                                </DropdownMenuItem>
                              )}
                              {can("booking", "delete") && <DropdownMenuSeparator />}
                              {can("booking", "delete") && (
                              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(booking)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Hapus
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
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ArrowLeft className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Previous</span>
              </Button>
              {/* Mobile: page X/Y */}
              <span className="text-sm text-muted-foreground sm:hidden">{currentPage} / {totalPages}</span>
              {/* Desktop: page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === page ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100")}>
                    {page}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                <span className="hidden sm:inline">Next</span> <ArrowRight className="w-4 h-4 sm:ml-2" />
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19202C]">Reject Booking</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Reject booking <span className="font-semibold text-gray-800">{rejectTarget.snapCustomer?.name}</span>?
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-red-100 hover:bg-red-200 p-1.5 shrink-0"
                onClick={() => { setRejectTarget(null); setRejectNotes(""); }}
                aria-label="Tutup"
              >
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Alasan Penolakan</label>
              <Input placeholder="Alasan penolakan (opsional)..." value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 bg-red-600 text-white rounded-lg py-2 font-medium text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex-1 border border-gray-300 rounded-lg py-2 font-medium text-sm hover:bg-gray-100 transition"
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
          <div className="px-6 pb-2">
            <Input placeholder="Alasan lost (opsional)..." value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!lostTarget) return;
              const r = await updateMut.mutateAsync({ id: lostTarget.id, bookingStatus: "Lost", lostReason: lostReason || null });
              if (!r.success) toast.error(r.error); else { toast.success("Booking ditandai Lost."); refetch(); }
              setLostTarget(null); setLostReason("");
            }} className="bg-primary text-primary-foreground hover:bg-primary/90">Lost Booking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Booking Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19202C]">Restore Booking</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Restore booking <span className="font-semibold text-gray-800">{restoreTarget.snapCustomer?.name}</span> ke status Pending?
                </p>
              </div>
              <button type="button" className="rounded-full hover:bg-muted p-1.5 shrink-0" onClick={() => setRestoreTarget(null)} aria-label="Tutup">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 font-medium text-sm hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={updateMut.isPending}
                onClick={async () => {
                  const r = await updateMut.mutateAsync({ id: restoreTarget.id, bookingStatus: "Pending" });
                  if (!r.success) toast.error(r.error); else { toast.success("Booking di-restore ke Pending."); refetch(); }
                  setRestoreTarget(null);
                }}
              >
                {updateMut.isPending ? "Memproses..." : "Restore"}
              </button>
              <button type="button" className="flex-1 border border-border rounded-lg py-2 font-medium text-sm hover:bg-accent transition" onClick={() => setRestoreTarget(null)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Booking Modal */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#19202C]">Transfer Booking</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Memindahkan kepemilikan data booking dari sales sebelumnya ke sales yang dipilih.
                </p>
              </div>
              <button
                className="rounded-full bg-red-100 hover:bg-red-200 p-1.5 shrink-0"
                onClick={() => { setTransferTarget(null); setTransferSalesId(""); }}
                type="button"
                aria-label="Tutup"
              >
                <X className="h-5 w-5 text-red-500" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">Sales saat ini</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {transferTarget.sales?.fullName ?? <span className="text-gray-400 italic">Tidak ada</span>}
                </span>
                {transferTarget.sales?.fullName && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500">sales</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1">Pilih Sales</p>
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

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 border border-gray-300 rounded-lg py-2 font-medium hover:bg-gray-100 transition text-sm"
                onClick={() => { setTransferTarget(null); setTransferSalesId(""); }}
                disabled={transferMut.isPending}
                type="button"
              >
                Batal
              </button>
              <button
                className="flex-1 bg-black text-white rounded-lg py-2 font-medium hover:bg-gray-900 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

      <SetVendorDrawer
        open={!!vendorTarget}
        onClose={() => setVendorTarget(null)}
        booking={vendorTarget}
        onSaved={() => refetch()}
      />

      {cateringTarget && (
        <CateringDrawerWrapper bookingId={cateringTarget} onClose={() => setCateringTarget(null)} onUpdated={() => refetch()} />
      )}

      {decorationTarget && (
        <DecorationDrawerWrapper bookingId={decorationTarget} onClose={() => setDecorationTarget(null)} onUpdated={() => refetch()} />
      )}

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
          }))}
          packagePrice={Number(topTarget.snapPackageVariant?.price ?? 0)}
        />
      )}

      {/* Vendor PO Approval Modal */}
      {vendorApproveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold">Approve {vendorApproveModal.roleLabel} — {vendorApproveModal.categoryType === "catering" ? "Catering" : "Dekorasi"}</h2>
                <p className="text-sm text-gray-500 mt-1">Tanda tangan {vendorApproveModal.roleLabel} diperlukan.</p>
              </div>
              <button type="button" className="rounded-full bg-red-100 hover:bg-red-200 p-1.5 shrink-0"
                onClick={() => { setVendorApproveModal((p) => ({ ...p, open: false })); sigVendorRef.current?.clear(); setHasVendorSigned(false); }}>
                <X className="h-5 w-5 text-red-500" />
              </button>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tanda Tangan {vendorApproveModal.roleLabel}</label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                <SignatureCanvas ref={sigVendorRef} penColor="black"
                  canvasProps={{ className: "w-full", style: { width: "100%", height: 180, touchAction: "none" } }}
                  onEnd={() => setHasVendorSigned(true)} />
              </div>
              <button type="button" className="mt-1.5 text-xs text-red-500 hover:text-red-700 underline"
                onClick={() => { sigVendorRef.current?.clear(); setHasVendorSigned(false); }}>Hapus tanda tangan</button>
            </div>
            <div className="flex gap-3">
              <button type="button" disabled={!hasVendorSigned || isApprovingVendor}
                className="flex-1 bg-black text-white rounded-lg py-2 font-medium text-sm hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={async () => {
                  if (!hasVendorSigned || sigVendorRef.current?.isEmpty()) { toast.error("Tanda tangan harus diisi"); return; }
                  setIsApprovingVendor(true);
                  const sig = sigVendorRef.current!.toDataURL("image/png");
                  const r = await approveCategoryPO(vendorApproveModal.bookingId, vendorApproveModal.categoryType, vendorApproveModal.role, sig);
                  if (!r.success) toast.error(r.error);
                  else {
                    toast.success(`Approval ${vendorApproveModal.roleLabel} berhasil`);
                    setApprovalCache((p) => ({
                      ...p,
                      [`${vendorApproveModal.bookingId}_${vendorApproveModal.categoryType}`]: {
                        ...(p[`${vendorApproveModal.bookingId}_${vendorApproveModal.categoryType}`] ?? {}),
                        [vendorApproveModal.role]: { signature: sig },
                      },
                    }));
                  }
                  setIsApprovingVendor(false);
                  setVendorApproveModal((p) => ({ ...p, open: false }));
                  sigVendorRef.current?.clear();
                  setHasVendorSigned(false);
                }}>
                {isApprovingVendor ? "Menyetujui..." : "Setujui"}
              </button>
              <button type="button" className="flex-1 border border-gray-300 rounded-lg py-2 font-medium text-sm hover:bg-gray-100 transition"
                onClick={() => { setVendorApproveModal((p) => ({ ...p, open: false })); sigVendorRef.current?.clear(); setHasVendorSigned(false); }}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CateringDrawerWrapper({ bookingId, onClose, onUpdated }: { bookingId: string; onClose: () => void; onUpdated: () => void }) {
  const [booking, setBooking] = useState<import("@/lib/queries/bookings").BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading || !booking) {
    return (
      <Drawer isOpen onClose={onClose} title="Catering" maxWidth="sm:max-w-full">
        <div className="p-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      </Drawer>
    );
  }

  return <CateringSelectionDrawer isOpen onClose={onClose} booking={booking} onUpdated={onUpdated} />;
}

function DecorationDrawerWrapper({ bookingId, onClose, onUpdated }: { bookingId: string; onClose: () => void; onUpdated: () => void }) {
  const [booking, setBooking] = useState<import("@/lib/queries/bookings").BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading || !booking) {
    return (
      <Drawer isOpen onClose={onClose} title="Dekorasi">
        <div className="flex items-center justify-center h-full"><p className="text-sm text-gray-400">Memuat...</p></div>
      </Drawer>
    );
  }

  return <DecorationSelectionDrawer isOpen onClose={onClose} booking={booking} onUpdated={onUpdated} />;
}

/* ─── AgreementModal ──────────────────────────────────────────────────────── */

interface AgreementModalProps {
  bookingId: string;
  customerName: string;
  onClose: () => void;
}

function AgreementModal({ bookingId, customerName, onClose }: AgreementModalProps) {
  const [agreement, setAgreement] = React.useState<{ token: string; accessCode: string; status?: string } | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const agreementUrl = agreement ? `${window.location.origin}/client-agreement?token=${agreement.token}` : null;

  const generate = React.useCallback(() => {
    startTransition(async () => {
      const result = await generateAgreementToken(bookingId);
      if (!result.success) { toast.error(result.error); return; }
      setAgreement({ token: result.agreement.token, accessCode: result.agreement.accessCode, status: result.agreement.status });
    });
  }, [bookingId]);

  React.useEffect(() => { generate(); }, [generate]);

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="sm:max-w-md!" style={{ width: "min(calc(100vw - 2rem), 28rem)" }} onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Client Agreement</AlertDialogTitle>
          <AlertDialogDescription>{customerName}</AlertDialogDescription>
        </AlertDialogHeader>

        {isPending || !agreement ? (
          <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Link Agreement</p>
              <div className="flex items-center gap-2 overflow-hidden">
                <code className="min-w-0 flex-1 text-xs bg-muted rounded px-2 py-1.5 block break-all">{agreementUrl}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreementUrl!); toast.success("Link disalin"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Kode Akses</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold tracking-widest bg-muted rounded px-2 py-1.5">{agreement.accessCode}</code>
                <Button variant="outline" size="icon-sm" onClick={() => { copyText(agreement.accessCode); toast.success("Kode disalin"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          {agreement?.status === "Signed" ? (
            <p className="text-xs text-muted-foreground mr-auto">✓ Sudah ditandatangani</p>
          ) : (
            <Button variant="outline" size="default" disabled={isPending} onClick={generate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
            </Button>
          )}
          <AlertDialogCancel onClick={onClose}>Tutup</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
