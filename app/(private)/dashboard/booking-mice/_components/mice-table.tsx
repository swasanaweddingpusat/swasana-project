"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AddCircle,
  Magnifer,
  ArrowLeft,
  ArrowRight,
  MenuDots,
  Pen,
  Eye,
  Calendar,
  FileText,
  TrashBinTrash,
  DangerTriangle,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { usePoll } from "@/hooks/use-poll";
import {
  useMiceBookings,
  useDeleteMiceBooking,
  useMarkMiceLost,
} from "@/hooks/use-mice-bookings";
import { MiceBookingDrawer } from "./MiceBookingDrawer";
import { MiceDetailModal } from "./MiceDetailModal";
import type { MiceBookingItem, MiceBookingStatus } from "./types";

export type { MiceBookingItem };

export const STATUS_DOT_CLASS: Record<MiceBookingStatus, string> = {
  Confirmed: "bg-foreground border border-foreground",
  Pending: "bg-muted-foreground/60 border border-muted-foreground/60",
  Uploaded: "bg-muted-foreground/40 border border-muted-foreground",
  Rejected: "bg-destructive border border-destructive",
  Canceled: "bg-muted-foreground/30 border border-muted-foreground/30",
  Lost: "bg-transparent border border-muted-foreground/60",
};

const ALL_STATUSES: MiceBookingStatus[] = [
  "Pending",
  "Uploaded",
  "Confirmed",
  "Rejected",
  "Canceled",
  "Lost",
];

function fmtRp(n: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
}

const ROWS_PER_PAGE = 10;

export function StatusDot({ status }: { status: MiceBookingStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block w-2 h-2 rounded-full shrink-0",
        STATUS_DOT_CLASS[status]
      )}
    />
  );
}

export function MiceStatusBadge({ status }: { status: MiceBookingStatus }) {
  return (
    <Badge
      variant="outline"
      className="text-xs gap-1.5 font-medium whitespace-nowrap"
    >
      <StatusDot status={status} />
      {status}
    </Badge>
  );
}

export function MiceTable() {
  usePoll();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MiceBookingStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<MiceBookingItem | null>(null);

  // Debounce search input ~300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useMiceBookings({
    page: currentPage,
    pageSize: ROWS_PER_PAGE,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));

  const { mutateAsync: deleteMice } = useDeleteMiceBooking();
  const { mutateAsync: markLost } = useMarkMiceLost();

  function handleRowClick(item: MiceBookingItem) {
    setSelectedBooking(item);
    setDetailOpen(true);
  }

  async function handleDelete(item: MiceBookingItem) {
    if (!confirm(`Hapus booking "${item.customer.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    const result = await deleteMice(item.id);
    if (result.success) {
      toast.success("Booking berhasil dihapus.");
    } else {
      toast.error(result.error ?? "Gagal menghapus booking.");
    }
  }

  async function handleMarkLost(item: MiceBookingItem) {
    if (!confirm(`Tandai booking "${item.customer.name}" sebagai Lost?`)) {
      return;
    }
    const result = await markLost({ id: item.id });
    if (result.success) {
      toast.success("Booking ditandai sebagai Lost.");
    } else {
      toast.error(result.error ?? "Gagal menandai sebagai Lost.");
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header + Filters */}
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-b sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full">
              {total} bookings
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as MiceBookingStatus | "all");
                setCurrentPage(1);
              }}
            >
              <SelectTrigger
                className="h-9 w-full sm:w-38 text-sm"
                aria-label="Filter status booking MICE"
              >
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <StatusDot status={s} />
                      {s}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Magnifer
                weight="BoldDuotone"
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label="Cari booking MICE"
                placeholder="Cari booking MICE..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                className="pl-9 w-full sm:w-52"
              />
            </div>

            <Button
              onClick={() => {
                setSelectedBooking(null);
                setDrawerOpen(true);
              }}
            >
              <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
              Tambah Booking
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar
              weight="BoldDuotone"
              aria-hidden="true"
              className="h-10 w-10 mb-3 opacity-40"
            />
            <p className="text-sm">
              {debouncedSearch
                ? `Tidak ada hasil untuk "${debouncedSearch}"`
                : "Belum ada booking MICE."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-250 text-sm">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-4 whitespace-nowrap w-[3%] text-center">
                    No
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    Client
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    Booking Date
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    No. Purchase Order
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    Quotation
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    Kediaman Venue
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    Status
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    Event Date
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap text-right">
                    Full Payment
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap text-right">
                    Booking Fee
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap">
                    Sales
                  </TableHead>
                  <TableHead className="px-4 whitespace-nowrap w-12">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item, idx) => {
                  const bookingFee =
                    item.terms.find((t) => t.name === "Booking Fee")?.amount ?? 0;
                  const finalPayment =
                    item.terms.find((t) => t.name === "Final Payment")?.amount ?? 0;

                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="px-4 text-center text-muted-foreground">
                        {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                      </TableCell>

                      <TableCell className="px-4">
                        <div className="min-w-0">
                          <p
                            className="font-medium truncate text-foreground"
                            title={item.customer.name}
                          >
                            {item.customer.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.customer.phone}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="px-4 whitespace-nowrap text-foreground/80">
                        {format(new Date(item.bookingDate), "dd MMM yyyy")}
                      </TableCell>

                      <TableCell className="px-4">
                        {item.poNumber ? (
                          <span className="font-mono text-xs">
                            {item.poNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>

                      {/* Quotation — always deferred */}
                      <TableCell className="px-4 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText
                            weight="BoldDuotone"
                            aria-hidden="true"
                            className="w-3 h-3 opacity-40"
                          />
                          —
                        </span>
                      </TableCell>

                      <TableCell className="px-4 whitespace-nowrap text-foreground/80">
                        {item.venue.name}
                      </TableCell>

                      <TableCell className="px-4">
                        <MiceStatusBadge status={item.status} />
                      </TableCell>

                      <TableCell className="px-4 whitespace-nowrap text-foreground/80">
                        {item.eventDate
                          ? format(new Date(item.eventDate), "dd MMM yyyy")
                          : "—"}
                      </TableCell>

                      <TableCell className="px-4 text-right whitespace-nowrap font-medium text-foreground">
                        {fmtRp(finalPayment)}
                      </TableCell>

                      <TableCell className="px-4 text-right whitespace-nowrap font-medium text-foreground">
                        {fmtRp(bookingFee)}
                      </TableCell>

                      <TableCell className="px-4 whitespace-nowrap text-muted-foreground">
                        {item.sales?.fullName ?? "—"}
                      </TableCell>

                      <TableCell
                        className="px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Aksi untuk booking ${item.customer.name}`}
                            >
                              <MenuDots
                                weight="BoldDuotone"
                                aria-hidden="true"
                                className="w-4 h-4 text-muted-foreground"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => {
                                setSelectedBooking(item);
                                setDetailOpen(true);
                              }}
                            >
                              <Eye weight="BoldDuotone" aria-hidden="true" className="w-4 h-4 text-primary" />
                              View Detail
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => {
                                setSelectedBooking(item);
                                setDrawerOpen(true);
                              }}
                            >
                              <Pen weight="BoldDuotone" aria-hidden="true" className="w-4 h-4 text-primary" />
                              Edit
                            </DropdownMenuItem>
                            {item.status !== "Lost" && item.status !== "Canceled" && item.status !== "Rejected" && (
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => { void handleMarkLost(item); }}
                              >
                                <DangerTriangle weight="BoldDuotone" aria-hidden="true" className="w-4 h-4 text-muted-foreground" />
                                Mark Lost
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive"
                              onClick={() => { void handleDelete(item); }}
                            >
                              <TrashBinTrash weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav
            aria-label="Navigasi halaman booking MICE"
            className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-t sm:flex-row sm:justify-between sm:items-center"
          >
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              aria-label="Halaman sebelumnya"
            >
              <ArrowLeft weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" /> Previous
            </Button>
            <div className="flex items-center gap-1 overflow-x-auto justify-center">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => {
                  const isCurrent = currentPage === page;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Halaman ${page}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={cn(
                        "px-3 py-1 rounded-md text-sm font-medium shrink-0",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {page}
                    </button>
                  );
                }
              )}
            </div>
            <Button
              variant="outline"
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              aria-label="Halaman berikutnya"
            >
              Next <ArrowRight weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" />
            </Button>
          </nav>
        )}
      </CardContent>

      <MiceBookingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        booking={selectedBooking}
      />
      <MiceDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        booking={selectedBooking}
        onEdit={(b) => {
          setSelectedBooking(b);
          setDrawerOpen(true);
        }}
      />
    </Card>
  );
}
