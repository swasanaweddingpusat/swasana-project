"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PencilIcon,
  Plus,
  ArrowLeft,
  ArrowRight,
  Search,
  FileText,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuotationDrawer } from "./quotation-drawer";

export interface QuotationItem {
  id: string;
  leadName: string;
  leadPhone: string;
  venue: string;
  category: "weddings" | "mice";
  eventType: string;
  eventDate: string;
  packageName: string;
  variantName: string;
  pax: number;
  price: number;
  discount: number;
  totalPrice: number;
  status: "draft" | "sent" | "revised" | "accepted" | "rejected";
  validUntil: string;
  salesName: string;
  createdAt: string;
  notes: string;
}

const DUMMY_QUOTATIONS: QuotationItem[] = [
  {
    id: "1",
    leadName: "Ahmad Fauzi",
    leadPhone: "081234567890",
    venue: "Bringhall",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-08-15",
    packageName: "Gold",
    variantName: "500 Pax",
    pax: 500,
    price: 165000000,
    discount: 10000000,
    totalPrice: 155000000,
    status: "sent",
    validUntil: "2026-06-30",
    salesName: "Rina",
    createdAt: "2026-05-15",
    notes: "",
  },
  {
    id: "2",
    leadName: "Ahmad Fauzi",
    leadPhone: "081234567890",
    venue: "Bringhall",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-08-15",
    packageName: "Platinum",
    variantName: "500 Pax",
    pax: 500,
    price: 220000000,
    discount: 15000000,
    totalPrice: 205000000,
    status: "revised",
    validUntil: "2026-06-30",
    salesName: "Rina",
    createdAt: "2026-05-17",
    notes: "Revisi dari quotation sebelumnya",
  },
  {
    id: "3",
    leadName: "Citra Dewi",
    leadPhone: "081355667788",
    venue: "De Rivier Mansion",
    category: "weddings",
    eventType: "Tea Pai & Resepsi",
    eventDate: "2026-10-05",
    packageName: "Sapphire",
    variantName: "400 Pax",
    pax: 400,
    price: 185000000,
    discount: 0,
    totalPrice: 185000000,
    status: "accepted",
    validUntil: "2026-07-15",
    salesName: "Rina",
    createdAt: "2026-05-18",
    notes: "",
  },
  {
    id: "4",
    leadName: "PT Maju Jaya",
    leadPhone: "02112345678",
    venue: "Sasana Esthi Sopo",
    category: "mice",
    eventType: "Fullday Meeting 8hrs",
    eventDate: "2026-07-10",
    packageName: "Gold",
    variantName: "100 Pax",
    pax: 100,
    price: 45000000,
    discount: 5000000,
    totalPrice: 40000000,
    status: "draft",
    validUntil: "2026-06-20",
    salesName: "Deni",
    createdAt: "2026-05-19",
    notes: "Masih draft",
  },
  {
    id: "5",
    leadName: "Budi Santoso",
    leadPhone: "081298765432",
    venue: "Grand Puri 2",
    category: "weddings",
    eventType: "Resepsi",
    eventDate: "2026-09-20",
    packageName: "Gold",
    variantName: "300 Pax",
    pax: 300,
    price: 120000000,
    discount: 0,
    totalPrice: 120000000,
    status: "rejected",
    validUntil: "2026-06-10",
    salesName: "Rina",
    createdAt: "2026-05-20",
    notes: "Budget tidak sesuai",
  },
];

const ROWS_PER_PAGE = 10;

type QuotationStatus = QuotationItem["status"];

interface StatusMeta {
  label: string;
  dotColor: string;
}

const STATUS_META: Record<QuotationStatus, StatusMeta> = {
  draft: { label: "Draft", dotColor: "#9ca3af" },
  sent: { label: "Sent", dotColor: "#3b82f6" },
  revised: { label: "Revised", dotColor: "#f59e0b" },
  accepted: { label: "Accepted", dotColor: "#22c55e" },
  rejected: { label: "Rejected", dotColor: "#ef4444" },
};

const ALL_STATUSES: QuotationStatus[] = [
  "draft",
  "sent",
  "revised",
  "accepted",
  "rejected",
];

function formatRupiah(amount: number): string {
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function StatusBadge({ status }: { status: QuotationStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge
      variant="outline"
      className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-700 border-gray-200"
    >
      <StatusDot color={meta.dotColor} />
      {meta.label}
    </Badge>
  );
}

export function QuotationsTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "all">(
    "all"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editQuotation, setEditQuotation] = useState<QuotationItem | null>(
    null
  );

  const filtered = DUMMY_QUOTATIONS.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search.trim()) {
      const query = search.toLowerCase();
      const matches =
        q.leadName.toLowerCase().includes(query) ||
        q.leadPhone.includes(query) ||
        q.venue.toLowerCase().includes(query) ||
        q.eventType.toLowerCase().includes(query) ||
        q.packageName.toLowerCase().includes(query) ||
        q.variantName.toLowerCase().includes(query) ||
        q.salesName.toLowerCase().includes(query);
      if (!matches) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  function handleAdd() {
    setEditQuotation(null);
    setDrawerOpen(true);
  }

  function handleEdit(q: QuotationItem) {
    setEditQuotation(q);
    setDrawerOpen(true);
  }

  function handleConvertToBooking(q: QuotationItem) {
    toast.info(`Convert ke Booking untuk ${q.leadName} — coming soon.`);
  }

  function handleStatusBadgeClick(status: QuotationStatus) {
    setStatusFilter((prev) => (prev === status ? "all" : status));
    setCurrentPage(1);
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as QuotationStatus | "all");
    setCurrentPage(1);
  }

  const statusCounts = ALL_STATUSES.map((s) => ({
    status: s,
    label: STATUS_META[s].label,
    dotColor: STATUS_META[s].dotColor,
    count: DUMMY_QUOTATIONS.filter((q) => q.status === s).length,
  }));

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-foreground">
                List Quotations
              </h2>
              <span className="text-xs font-medium bg-gray-50 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
                {filtered.length}
                {search || statusFilter !== "all"
                  ? ` dari ${DUMMY_QUOTATIONS.length}`
                  : " quotations"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter */}
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="h-9 w-40 text-sm">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <StatusDot color={STATUS_META[s].dotColor} />
                        {STATUS_META[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari quotation..."
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
                onClick={handleAdd}
                className="bg-gray-900 hover:bg-gray-800 text-white cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Quotation
              </Button>
            </div>
          </div>

          {/* Status summary badges */}
          <div className="flex items-center gap-2 px-6 py-3 border-b flex-wrap">
            {statusCounts.map((s) => (
              <button
                key={s.status}
                type="button"
                onClick={() => handleStatusBadgeClick(s.status)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer",
                  statusFilter === s.status
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                )}
              >
                <StatusDot
                  color={statusFilter === s.status ? "#ffffff" : s.dotColor}
                />
                {s.label}
                <span
                  className={cn(
                    "ml-0.5 font-bold",
                    statusFilter === s.status ? "text-white" : "text-gray-500"
                  )}
                >
                  ({s.count})
                </span>
              </button>
            ))}
            {statusFilter !== "all" && (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer ml-1"
              >
                Reset
              </button>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">
                {search
                  ? `Tidak ada hasil untuk "${search}"`
                  : "Belum ada quotation."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1400px] text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="px-4 whitespace-nowrap">
                      Lead
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Venue
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Kategori
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Event
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Tanggal
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Paket / Varian
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap text-right">
                      Harga
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap text-right">
                      Diskon
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap text-right">
                      Total
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Status
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Valid Sampai
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap">
                      Sales
                    </TableHead>
                    <TableHead className="px-4 whitespace-nowrap w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((q) => (
                    <TableRow key={q.id} className="hover:bg-gray-50">
                      {/* Lead */}
                      <TableCell className="px-4 font-medium">
                        <div className="truncate max-w-40" title={q.leadName}>
                          {q.leadName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {q.leadPhone}
                        </div>
                      </TableCell>

                      {/* Venue */}
                      <TableCell className="px-4 whitespace-nowrap text-gray-700">
                        {q.venue}
                      </TableCell>

                      {/* Kategori */}
                      <TableCell className="px-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize",
                            q.category === "weddings"
                              ? "border-gray-300 text-gray-700"
                              : "border-gray-400 bg-gray-100 text-gray-800"
                          )}
                        >
                          {q.category === "weddings" ? "Weddings" : "MICE"}
                        </Badge>
                      </TableCell>

                      {/* Event */}
                      <TableCell className="px-4 whitespace-nowrap text-gray-700">
                        {q.eventType}
                      </TableCell>

                      {/* Tanggal */}
                      <TableCell className="px-4 whitespace-nowrap text-gray-700">
                        {formatDate(q.eventDate)}
                      </TableCell>

                      {/* Paket / Varian */}
                      <TableCell className="px-4 whitespace-nowrap">
                        <div className="font-medium text-gray-800">
                          {q.packageName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {q.variantName}
                        </div>
                      </TableCell>

                      {/* Harga */}
                      <TableCell className="px-4 text-right whitespace-nowrap text-gray-700">
                        {formatRupiah(q.price)}
                      </TableCell>

                      {/* Diskon */}
                      <TableCell className="px-4 text-right whitespace-nowrap text-gray-700">
                        {q.discount > 0 ? (
                          <span className="text-destructive">
                            -{formatRupiah(q.discount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Total */}
                      <TableCell className="px-4 text-right whitespace-nowrap font-semibold text-gray-900">
                        {formatRupiah(q.totalPrice)}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="px-4">
                        <StatusBadge status={q.status} />
                      </TableCell>

                      {/* Valid Sampai */}
                      <TableCell className="px-4 whitespace-nowrap text-gray-700">
                        {formatDate(q.validUntil)}
                      </TableCell>

                      {/* Sales */}
                      <TableCell className="px-4 text-gray-600 whitespace-nowrap">
                        {q.salesName}
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(q)}
                            title="Edit quotation"
                            className="cursor-pointer"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          {q.status === "accepted" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleConvertToBooking(q)}
                              title="Convert ke Booking"
                              className="text-gray-700 hover:text-gray-900 cursor-pointer"
                            >
                              <CalendarCheck className="h-4 w-4" />
                            </Button>
                          )}
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
            <div className="flex justify-between items-center px-6 py-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
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
                  )
                )}
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <QuotationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editQuotation={editQuotation}
      />
    </>
  );
}
