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
  Search, ArrowLeft, ArrowRight, Wrench, UtensilsCrossed, Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { useBookings } from "@/hooks/use-bookings";
import { SetVendorDrawer } from "./SetVendorDrawer";
import { CateringSelectionDrawer } from "./CateringSelectionDrawer";
import { DecorationSelectionDrawer } from "./DecorationSelectionDrawer";
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

  const [vendorTarget, setVendorTarget]         = useState<BookingListItem | null>(null);
  const [cateringTarget, setCateringTarget]     = useState<string | null>(null);
  const [decorationTarget, setDecorationTarget] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-foreground">Vendor Specialist</h2>
              <span className="text-sm rounded-full border border-border bg-secondary px-3 py-1">
                {totalBookings} Bookings
              </span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari customer, PO, venue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border bg-secondary">
                  <TableHead className="px-4 py-2.5 w-12 font-semibold text-muted-foreground text-xs">No</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Customer</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Venue &amp; PO</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Package</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Booking Date</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="px-2 py-2.5 w-32 font-semibold text-muted-foreground text-xs">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching && bookings.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j} className="px-2 py-3">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada booking ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking: BookingListItem, idx: number) => (
                    <TableRow
                      key={booking.id}
                      className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                    >
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div>
                          <p className="text-sm font-medium">{booking.snapCustomer?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{booking.snapCustomer?.mobileNumber ?? ""}</p>
                        </div>
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div>
                          <p className="text-sm">{booking.snapVenue?.venueName ?? "—"}</p>
                          {booking.poNumber && (
                            <p className="text-xs text-muted-foreground font-mono">{booking.poNumber}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div>
                          <p className="text-sm">{booking.snapPackage?.packageName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{booking.snapPackageVariant?.variantName ?? ""}</p>
                        </div>
                      </TableCell>

                      <TableCell className="px-2 py-3 text-sm whitespace-nowrap">
                        {format(new Date(booking.bookingDate), "dd MMM yyyy")}
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <span className={cn(
                          "text-xs font-medium border rounded-full px-2 py-0.5",
                          STATUS_CLASSES[booking.bookingStatus] ?? "text-muted-foreground border-border",
                        )}>
                          {booking.bookingStatus}
                        </span>
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div className="flex items-center gap-1">
                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setVendorTarget(booking); }}
                                />
                              }>
                                <Wrench className="h-3.5 w-3.5" />
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
                                  className="h-7 w-7 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setCateringTarget(booking.id); }}
                                />
                              }>
                                <UtensilsCrossed className="h-3.5 w-3.5" />
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
                                  className="h-7 w-7 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setDecorationTarget(booking.id); }}
                                />
                              }>
                                <Palette className="h-3.5 w-3.5" />
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Dekorasi PO</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, totalBookings)} dari {totalBookings}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
