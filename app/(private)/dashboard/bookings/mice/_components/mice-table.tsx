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
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
  EllipsisVertical,
  Pencil,
  Eye,
  Upload,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePoll } from "@/hooks/use-poll";
import { MiceBookingDrawer } from "./MiceBookingDrawer";
import { MiceDetailModal } from "./MiceDetailModal";
import type { MiceBookingItem } from "./types";

export type { MiceBookingItem };

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

const DUMMY_MICE: MiceBookingItem[] = [
  {
    id: "m1",
    clientName: "PT Maju Jaya",
    clientPhone: "02112345678",
    bookingDate: "2026-05-10",
    poNumber: "PO-MICE-001",
    hasQuotation: true,
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
    hasQuotation: false,
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
    hasQuotation: false,
    venueName: "Lippo Grand Ballroom",
    status: "Uploaded",
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
    hasQuotation: true,
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
    hasQuotation: true,
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

export function MiceTable() {
  usePoll();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<MiceBookingItem | null>(null);

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

  const statuses = ["Confirmed", "Uploaded", "Pending", "Rejected", "Canceled", "Lost"];

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header + Filters */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-gray-50 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
              {filtered.length}
              {search || statusFilter !== "all"
                ? ` dari ${DUMMY_MICE.length}`
                : " bookings"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-38 text-sm">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", STATUS_DOT[s])} />
                      {s}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari booking MICE..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 w-52"
              />
            </div>

            {/* Add button */}
            <Button
              className="bg-gray-900 hover:bg-gray-800 text-white cursor-pointer"
              onClick={() => { setSelectedBooking(null); setDrawerOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Booking
            </Button>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CalendarDays className="h-10 w-10 mb-3 opacity-40" />
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
                <TableRow className="bg-gray-50">
                  <TableHead className="px-4 whitespace-nowrap w-[3%] text-center">No</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Client</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Booking Date</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">No. Purchase Order</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Quotation</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Kediaman Venue</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Status</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Event Date</TableHead>
                  <TableHead className="px-4 whitespace-nowrap text-right">Full Payment</TableHead>
                  <TableHead className="px-4 whitespace-nowrap text-right">Booking Fee</TableHead>
                  <TableHead className="px-4 whitespace-nowrap">Sales</TableHead>
                  <TableHead className="px-4 whitespace-nowrap w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((item, idx) => (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    {/* No */}
                    <TableCell className="px-4 text-center text-muted-foreground">
                      {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                    </TableCell>

                    {/* Client */}
                    <TableCell className="px-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.clientName}</p>
                        <p className="text-xs text-muted-foreground">{item.clientPhone}</p>
                      </div>
                    </TableCell>

                    {/* Booking Date */}
                    <TableCell className="px-4 whitespace-nowrap text-gray-700">
                      {format(new Date(item.bookingDate), "dd MMM yyyy")}
                    </TableCell>

                    {/* PO Number */}
                    <TableCell className="px-4">
                      {item.poNumber ? (
                        <span className="font-mono text-xs">{item.poNumber}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Quotation */}
                    <TableCell className="px-4">
                      {item.hasQuotation ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Upload className="w-3 h-3" />
                          Uploaded
                        </Badge>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 cursor-pointer">
                          <Upload className="w-3 h-3" />
                          Upload
                        </Button>
                      )}
                    </TableCell>

                    {/* Kediaman Venue */}
                    <TableCell className="px-4 whitespace-nowrap text-gray-700">
                      {item.venueName}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs gap-1.5 font-medium",
                          STATUS_TEXT[item.status]
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[item.status])} />
                        {item.status}
                      </Badge>
                    </TableCell>

                    {/* Event Date */}
                    <TableCell className="px-4 whitespace-nowrap text-gray-700">
                      {format(new Date(item.eventDate), "dd MMM yyyy")}
                    </TableCell>

                    {/* Full Payment */}
                    <TableCell className="px-4 text-right whitespace-nowrap font-medium">
                      {fmtRp(item.fullPayment)}
                    </TableCell>

                    {/* Booking Fee */}
                    <TableCell className="px-4 text-right whitespace-nowrap font-medium">
                      {fmtRp(item.bookingFee)}
                    </TableCell>

                    {/* Sales */}
                    <TableCell className="px-4 whitespace-nowrap text-gray-600">
                      {item.salesName}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 rounded-md hover:bg-muted cursor-pointer">
                          <EllipsisVertical className="w-4 h-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => { setSelectedBooking(item); setDetailOpen(true); }}
                          >
                            <Eye className="w-4 h-4" />
                            View Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => { setSelectedBooking(item); setDrawerOpen(true); }}
                          >
                            <Pencil className="w-4 h-4" />
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
          <div className="flex justify-between items-center px-6 py-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "px-3 py-1 rounded-md text-sm font-medium cursor-pointer",
                    currentPage === page
                      ? "bg-gray-200 text-gray-900"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
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
        onEdit={(b) => { setSelectedBooking(b); setDrawerOpen(true); }}
      />
    </Card>
  );
}
