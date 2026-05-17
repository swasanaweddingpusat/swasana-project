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
  Search, ArrowLeft, ArrowRight, Store, UtensilsCrossed, Palette, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { useBookings } from "@/hooks/use-bookings";
import { SetVendorDrawer } from "./SetVendorDrawer";
import { CateringSelectionDrawer } from "./CateringSelectionDrawer";
import { DecorationSelectionDrawer } from "./DecorationSelectionDrawer";
import { BookingDetailModal } from "@/app/(private)/dashboard/bookings/_components/booking-detail-modal";
import type { BookingsResult, BookingListItem, BookingDetail } from "@/lib/queries/bookings";

// Monochrome-only status styling — no hardcoded color classes
const STATUS_CLASSES: Record<string, string> = {
  Confirmed: "text-foreground border-border",
  Uploaded:  "text-foreground border-border",
  Pending:   "text-muted-foreground border-border",
  Rejected:  "text-destructive border-destructive/30",
  Canceled:  "text-muted-foreground border-border",
  Lost:      "text-muted-foreground border-border",
};

const ROWS_PER_PAGE = 10;

export function VendorSpecialistTable({
  initialData,
}: {
  initialData: BookingsResult;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: result = initialData, refetch, isFetching } = useBookings(
    { page: currentPage, pageSize: ROWS_PER_PAGE, search: debouncedSearch },
    initialData,
  );
  const bookings = result.data;
  const totalBookings = result.total;
  const totalPages = Math.ceil(totalBookings / ROWS_PER_PAGE);

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
                <Search className={cn("absolute", "left-3", "top-1/2", "-translate-y-1/2", "h-4", "w-4", "text-muted-foreground")} />
                <Input placeholder="Cari booking..." value={search} onChange={(e) => setSearch(e.target.value)} className={cn("pl-9", "w-full", "sm:w-55")} />
              </div>
            </div>
          </div>

          {/* Table */}
          {bookings.length === 0 ? (
            <div className={cn("flex", "flex-col", "items-center", "justify-center", "py-16", "text-muted-foreground")}>
              <CalendarDays className={cn("h-10", "w-10", "mb-3", "opacity-40")} />
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
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{booking.snapCustomer?.mobileNumber ?? ""}</p>
                          <p className={cn("text-xs", "text-muted-foreground", "mt-0.5", "sm:hidden")}>{format(new Date(booking.bookingDate), "dd MMM yyyy")}</p>
                        </div>
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell")}>
                        <p className="text-sm">{booking.snapVenue?.venueName ?? "—"}</p>
                        {booking.poNumber && (
                          <p className="text-xs text-muted-foreground font-mono">{booking.poNumber}</p>
                        )}
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell")}>
                        <p className="text-sm">{booking.snapPackage?.packageName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{booking.snapPackageVariant?.variantName ?? ""}</p>
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell", "whitespace-nowrap", "text-sm")}>
                        {format(new Date(booking.bookingDate), "dd MMM yyyy")}
                      </TableCell>

                      <TableCell className={cn("px-2", "py-2", "hidden", "sm:table-cell")}>
                        <span className={cn(
                          "text-xs font-medium border rounded-full px-2 py-0.5",
                          STATUS_CLASSES[booking.bookingStatus] ?? "text-muted-foreground border-border",
                        )}>
                          {booking.bookingStatus}
                        </span>
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
                                <Store className={cn("h-4", "w-4")} />
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
                                <UtensilsCrossed className={cn("h-4", "w-4")} />
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
                                <Palette className={cn("h-4", "w-4")} />
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
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ArrowRight className="h-3.5 w-3.5" />
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
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((d: BookingDetail) => setBooking(d))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
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
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((d: BookingDetail) => setBooking(d))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
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
