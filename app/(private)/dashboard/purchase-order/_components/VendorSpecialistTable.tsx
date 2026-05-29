"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Magnifer, ArrowLeft, ArrowRight, Shop, ChefHat, Palette, Calendar,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Drawer } from "@/components/shared/drawer";
import { useBookings } from "@/hooks/use-bookings";
import { SetVendorDrawer } from "./SetVendorDrawer";
import { CateringSelectionDrawer } from "./CateringSelectionDrawer";
import { DecorationSelectionDrawer } from "./DecorationSelectionDrawer";
import { BookingDetailModal } from "@/app/(private)/dashboard/booking-weddings/_components/booking-detail-modal";
import type { BookingsResult, BookingListItem, BookingDetail } from "@/lib/queries/bookings";

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

function fmtRp(n: unknown): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(n))}`;
}

const ROWS_PER_PAGE = 10;

export function VendorSpecialistTable({
  initialData,
}: {
  initialData: BookingsResult;
}) {
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
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: result = initialData, refetch } = useBookings(
    { page: currentPage, pageSize: ROWS_PER_PAGE, search: debouncedSearch, venueId: venueFilter || undefined },
    initialData,
  );
  const bookings = result.data;
  const totalBookings = result.total;
  const totalPages = Math.ceil(totalBookings / ROWS_PER_PAGE);

  const { data: bookingApprovals = [] } = useQuery<{ id: string; entityId: string; status: string; steps: { id: string; stepOrder: number; approverType: string; status: string }[] }[]>({
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

  const [detailTarget, setDetailTarget]         = useState<string | null>(null);
  const [vendorTarget, setVendorTarget]         = useState<BookingListItem | null>(null);
  const [cateringTarget, setCateringTarget]     = useState<string | null>(null);
  const [decorationTarget, setDecorationTarget] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("flex", "flex-col", "sm:flex-row", "sm:items-center", "justify-between", "px-4", "sm:px-6", "pb-4", "gap-3")}>
            <div className={cn("flex", "items-center", "gap-3")}>
              <h2 className={cn("text-base", "font-bold", "text-foreground")}>Vendor Specialist</h2>
              <span className={cn("text-foreground", "text-sm", "rounded-full", "border", "border-border", "bg-muted", "px-3", "py-1")}>
                {totalBookings} Bookings
              </span>
            </div>
            <div className={cn("flex", "flex-wrap", "items-center", "gap-2")}>
              <div className={cn("relative", "flex-1", "sm:flex-none")}>
                <Magnifer weight="BoldDuotone" className={cn("absolute", "left-3", "top-1/2", "-translate-y-1/2", "h-4", "w-4", "text-muted-foreground")} />
                <Input placeholder="Cari booking..." value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-9", "w-full", "sm:w-55")} />
              </div>
              <SearchableSelect
                options={[{ id: "", name: "Semua Venue" }, ...venues.map((v) => ({ id: v.id, name: v.name }))]}
                value={venueFilter}
                onChange={(val) => { setVenueFilter(val); setCurrentPage(1); }}
                placeholder="Filter venue..."
                searchPlaceholder="Cari venue..."
                className="w-40"
              />
            </div>
          </div>

          {/* Table */}
          {bookings.length === 0 ? (
            <div className={cn("flex", "flex-col", "items-center", "justify-center", "py-16", "text-muted-foreground")}>
              <Calendar weight="BoldDuotone" className={cn("h-10", "w-10", "mb-3", "opacity-40")} />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada booking."}</p>
            </div>
          ) : (
            <div className={cn("w-full", "overflow-x-auto")}>
              <Table className={cn("w-full", "text-sm")}>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className={cn("px-2", "py-2", "text-muted-foreground", "text-center", "w-[3%]", "hidden", "sm:table-cell")}>No</TableHead>
                    <TableHead className={cn("px-2", "py-2", "text-muted-foreground")}>Customer</TableHead>
                    <TableHead className={cn("px-2", "py-2", "text-muted-foreground", "hidden", "sm:table-cell", "w-[15%]")}>Venue & PO</TableHead>
                    <TableHead className={cn("px-2", "py-2", "text-muted-foreground", "hidden", "sm:table-cell", "w-[14%]")}>Package</TableHead>
                    <TableHead className={cn("px-2", "py-2", "text-muted-foreground", "hidden", "sm:table-cell", "w-[10%]")}>Event Date</TableHead>
                    <TableHead className={cn("px-2", "py-2", "text-muted-foreground", "hidden", "sm:table-cell", "w-[8%]")}>Approval</TableHead>
                    <TableHead className={cn("px-1", "py-2", "text-muted-foreground", "text-right", "pr-5", "w-[15%]")}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking: BookingListItem, idx: number) => (
                    <TableRow
                      key={booking.id}
                      className={cn("hover:bg-muted", "cursor-pointer")}
                      onClick={() => setDetailTarget(booking.id)}
                    >
                      <TableCell className={cn("px-2", "py-2", "text-center", "hidden", "sm:table-cell")}>
                        {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2")}>
                        <div className="overflow-hidden max-w-0 min-w-full">
                          <p className={cn("text-sm", "font-medium", "text-foreground", "truncate")}>{booking.snapCustomer?.name ?? "—"}</p>
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
                          <p className={cn("text-xs", "text-muted-foreground", "mt-0.5", "sm:hidden")}>{format(new Date(booking.bookingDate), "dd MMM yyyy")}</p>
                          <div className={cn("flex", "flex-wrap", "items-center", "gap-1", "mt-1")}>
                            <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium bg-background", STATUS_TEXT[booking.bookingStatus] ?? "text-muted-foreground border-border")}>
                              <span className={cn("w-1 h-1 rounded-full mr-1", STATUS_DOT[booking.bookingStatus] ?? "bg-muted-foreground")} />
                              {booking.bookingStatus}
                            </span>
                            <span className={cn("inline-flex", "items-center", "px-1.5", "py-0.5", "rounded-full", "border", "border-border", "bg-muted", "text-muted-foreground", "text-[10px]", "font-medium")}>
                              {booking.paymentMethod?.bankName ?? "N/A"}
                            </span>
                            {booking.weddingSession && (
                              <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium", SESSION_STYLE[booking.weddingSession] ?? "bg-muted text-muted-foreground")}>
                                {SESSION_LABEL[booking.weddingSession] ?? booking.weddingSession}
                              </span>
                            )}
                            {booking.sourceOfInformation?.name && (
                              <span className={cn("inline-flex", "items-center", "px-1.5", "py-0.5", "rounded-full", "text-[10px]", "font-medium", "bg-muted", "text-muted-foreground")}>
                                {booking.sourceOfInformation.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell")}>
                        <div className="leading-tight">
                          <span className={cn("block", "truncate", "text-sm", "font-medium")}>{booking.snapVenue?.venueName ?? "—"}</span>
                          {booking.poNumber ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(booking.poNumber!); toast.success("PO Number copied!", { duration: 1500 }); }}
                              className={cn("inline-flex", "items-center", "max-w-full", "px-1.5", "py-0.5", "rounded", "bg-muted", "text-[10px]", "font-mono", "text-muted-foreground", "hover:bg-accent", "transition-colors", "cursor-pointer", "truncate", "mt-0.5")}
                            >
                              <span className="truncate">{booking.poNumber}</span>
                            </button>
                          ) : (
                            <span className={cn("text-muted-foreground", "text-[10px]", "block", "mt-0.5")}>No PO</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell")}>
                        <div className="leading-tight">
                          <span className={cn("truncate", "block")}>{booking.snapPackage?.packageName ?? "—"}</span>
                          {booking.snapPackageVariant && (
                            <>
                              <span className={cn("text-xs", "text-muted-foreground", "block")}>{booking.snapPackageVariant.variantName}</span>
                              <span className={cn("text-xs", "text-muted-foreground", "block")}>{booking.snapPackageVariant.pax} PAX · {fmtRp(Math.max(0, Number(booking.snapPackageVariant.price) - (booking.discountAmount ?? 0)))}</span>
                            </>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell", "whitespace-nowrap", "text-sm")}>
                        {format(new Date(booking.bookingDate), "dd MMM yyyy")}
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell")}>
                        {(() => {
                          const record = approvalMap.get(booking.id);
                          if (!record) return <span className={cn("text-xs", "text-muted-foreground")}>—</span>;
                          return (
                            <span
                              className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                                record.status === "approved" && "bg-primary text-primary-foreground",
                                record.status === "pending" && "bg-muted text-muted-foreground",
                                record.status === "rejected" && "bg-destructive/10 text-destructive",
                              )}
                            >
                              {record.status === "approved" ? "Approved" : record.status === "pending" ? "Pending" : "Rejected"}
                            </span>
                          );
                        })()}
                      </TableCell>

                      <TableCell className={cn("px-1", "py-2", "text-right", "pr-3")} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("cursor-pointer", "hidden", "sm:inline-flex")}
                                  onClick={(e) => { e.stopPropagation(); setVendorTarget(booking); }}
                                />
                              }>
                                <Shop weight="BoldDuotone" className={cn("h-4", "w-4")} />
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Set Vendor</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("cursor-pointer", "hidden", "sm:inline-flex")}
                                  onClick={(e) => { e.stopPropagation(); setCateringTarget(booking.id); }}
                                />
                              }>
                                <ChefHat weight="BoldDuotone" className={cn("h-4", "w-4")} />
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Catering PO</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("cursor-pointer", "hidden", "sm:inline-flex")}
                                  onClick={(e) => { e.stopPropagation(); setDecorationTarget(booking.id); }}
                                />
                              }>
                                <Palette weight="BoldDuotone" className={cn("h-4", "w-4")} />
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Dekorasi PO</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
            <div className={cn("flex", "items-center", "justify-between", "px-4", "sm:px-6", "py-3", "border-t", "border-border")}>
              <p className="text-xs text-muted-foreground">
                {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, totalBookings)} dari {totalBookings}
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ArrowLeft weight="BoldDuotone" className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ArrowRight weight="BoldDuotone" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BookingDetailModal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        bookingId={detailTarget}
      />

      <SetVendorDrawer
        open={!!vendorTarget}
        onClose={() => setVendorTarget(null)}
        booking={vendorTarget}
        onSaved={() => { void refetch(); }}
      />

      {cateringTarget && (
        <CateringDrawerWrapper
          bookingId={cateringTarget}
          onClose={() => setCateringTarget(null)}
          onUpdated={() => { void refetch(); }}
        />
      )}

      {decorationTarget && (
        <DecorationDrawerWrapper
          bookingId={decorationTarget}
          onClose={() => setDecorationTarget(null)}
          onUpdated={() => { void refetch(); }}
        />
      )}
    </>
  );
}

function CateringDrawerWrapper({
  bookingId,
  onClose,
  onUpdated,
}: {
  bookingId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((d: BookingDetail) => { if (!cancelled) setBooking(d); })
      .catch(() => { if (!cancelled) setBooking(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading || !booking) {
    return (
      <Drawer isOpen onClose={onClose} title="Catering" maxWidth="sm:max-w-full">
        <div className="p-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Drawer>
    );
  }

  return (
    <CateringSelectionDrawer
      isOpen
      onClose={onClose}
      booking={booking}
      onUpdated={onUpdated}
    />
  );
}

function DecorationDrawerWrapper({
  bookingId,
  onClose,
  onUpdated,
}: {
  bookingId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((d: BookingDetail) => { if (!cancelled) setBooking(d); })
      .catch(() => { if (!cancelled) setBooking(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading || !booking) {
    return (
      <Drawer isOpen onClose={onClose} title="Dekorasi">
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </Drawer>
    );
  }

  return (
    <DecorationSelectionDrawer
      isOpen
      onClose={onClose}
      booking={booking}
      onUpdated={onUpdated}
    />
  );
}
