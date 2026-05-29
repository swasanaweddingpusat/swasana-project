"use client";

import { useState } from "react";
import { format } from "date-fns";
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
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { usePoll } from "@/hooks/use-poll";
import { MiceBookingDrawer } from "./MiceBookingDrawer";
import { MiceDetailModal } from "./MiceDetailModal";
import type { MiceBookingItem, MiceStatus } from "./types";

export type { MiceBookingItem };

export const STATUS_DOT_CLASS: Record<MiceStatus, string> = {
  Confirmed: "bg-foreground border border-foreground",
  Pending: "bg-muted-foreground/60 border border-muted-foreground/60",
  Rejected: "bg-destructive border border-destructive",
  Canceled: "bg-muted-foreground/30 border border-muted-foreground/30",
  Lost: "bg-transparent border border-muted-foreground/60",
};

const ALL_STATUSES: MiceStatus[] = [
  "Confirmed",
  "Pending",
  "Rejected",
  "Canceled",
  "Lost",
];

const DUMMY_MICE: MiceBookingItem[] = [
  {
    id: "m1",
    clientName: "PT Maju Jaya",
    clientPhone: "02112345678",
    bookingDate: "2026-05-10",
    poNumber: "PO-MICE-001",
    quotation: {
      id: "q-m1",
      leadName: "PT Maju Jaya",
      packageName: "Gold",
      variantName: "100 Pax",
      totalPrice: 40000000,
    },
    venueName: "Sasana Esthi Sopo",
    status: "Confirmed",
    eventDate: "2026-07-10",
    eventType: "Fullday Meeting 8hrs",
    fullPayment: 45000000,
    bookingFee: 15000000,
    salesName: "Deni",
  },
  {
    id: "m2",
    clientName: "PT Global Tech",
    clientPhone: "02198765432",
    bookingDate: "2026-05-12",
    poNumber: "PO-MICE-002",
    quotation: null,
    venueName: "Bripensiunan",
    status: "Pending",
    eventDate: "2026-06-25",
    eventType: "Halfday 6hrs",
    fullPayment: 25000000,
    bookingFee: 8000000,
    salesName: "Deni",
  },
  {
    id: "m3",
    clientName: "Bank Mandiri",
    clientPhone: "02155667788",
    bookingDate: "2026-05-15",
    poNumber: null,
    quotation: null,
    venueName: "Lippo Grand Ballroom",
    status: "Pending",
    eventDate: "2026-08-20",
    eventType: "Fullday Meeting 12hrs",
    fullPayment: 75000000,
    bookingFee: 25000000,
    salesName: "Rina",
  },
  {
    id: "m4",
    clientName: "Telkom Indonesia",
    clientPhone: "02133445566",
    bookingDate: "2026-05-18",
    poNumber: "PO-MICE-004",
    quotation: {
      id: "q-m4",
      leadName: "Telkom Indonesia",
      packageName: "Silver",
      variantName: "150 Pax",
      totalPrice: 28000000,
    },
    venueName: "Grand Puri 2",
    status: "Confirmed",
    eventDate: "2026-09-05",
    eventType: "Halfday 6hrs",
    fullPayment: 30000000,
    bookingFee: 10000000,
    salesName: "Rina",
  },
  {
    id: "m5",
    clientName: "Astra International",
    clientPhone: "02177889900",
    bookingDate: "2026-04-28",
    poNumber: "PO-MICE-005",
    quotation: {
      id: "q-m5",
      leadName: "Astra International",
      packageName: "Platinum",
      variantName: "200 Pax",
      totalPrice: 55000000,
    },
    venueName: "Bringhall",
    status: "Rejected",
    eventDate: "2026-06-15",
    eventType: "Fullday Meeting 8hrs",
    fullPayment: 55000000,
    bookingFee: 18000000,
    salesName: "Deni",
  },
];

function fmtRp(n: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
}

const ROWS_PER_PAGE = 10;

export function StatusDot({ status }: { status: MiceStatus }) {
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

export function MiceStatusBadge({ status }: { status: MiceStatus }) {
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
  const [statusFilter, setStatusFilter] = useState<MiceStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] =
    useState<MiceBookingItem | null>(null);

  const filtered = DUMMY_MICE.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches =
        item.clientName.toLowerCase().includes(q) ||
        item.clientPhone.includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.salesName.toLowerCase().includes(q) ||
        item.eventType.toLowerCase().includes(q) ||
        (item.poNumber?.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  function handleRowClick(item: MiceBookingItem) {
    setSelectedBooking(item);
    setDetailOpen(true);
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header + Filters */}
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-b sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full">
              {filtered.length}
              {search || statusFilter !== "all"
                ? ` dari ${DUMMY_MICE.length}`
                : " bookings"}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as MiceStatus | "all");
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
                  setCurrentPage(1);
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

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar
              weight="BoldDuotone"
              aria-hidden="true"
              className="h-10 w-10 mb-3 opacity-40"
            />
            <p className="text-sm">
              {search
                ? `Tidak ada hasil untuk "${search}"`
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
                {paginated.map((item, idx) => (
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
                          title={item.clientName}
                        >
                          {item.clientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.clientPhone}
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

                    <TableCell className="px-4 whitespace-nowrap">
                      {item.quotation ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <FileText
                            weight="BoldDuotone"
                            aria-hidden="true"
                            className="w-3 h-3"
                          />
                          {item.quotation.packageName}{" "}
                          {item.quotation.variantName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-4 whitespace-nowrap text-foreground/80">
                      {item.venueName}
                    </TableCell>

                    <TableCell className="px-4">
                      <MiceStatusBadge status={item.status} />
                    </TableCell>

                    <TableCell className="px-4 whitespace-nowrap text-foreground/80">
                      {format(new Date(item.eventDate), "dd MMM yyyy")}
                    </TableCell>

                    <TableCell className="px-4 text-right whitespace-nowrap font-medium text-foreground">
                      {fmtRp(item.fullPayment)}
                    </TableCell>

                    <TableCell className="px-4 text-right whitespace-nowrap font-medium text-foreground">
                      {fmtRp(item.bookingFee)}
                    </TableCell>

                    <TableCell className="px-4 whitespace-nowrap text-muted-foreground">
                      {item.salesName}
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
                            aria-label={`Aksi untuk booking ${item.clientName}`}
                          >
                            <MenuDots
                              weight="BoldDuotone"
                              aria-hidden="true"
                              className="w-4 h-4"
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
                            <Eye weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" />
                            View Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => {
                              setSelectedBooking(item);
                              setDrawerOpen(true);
                            }}
                          >
                            <Pen weight="BoldDuotone" aria-hidden="true" className="w-4 h-4" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
