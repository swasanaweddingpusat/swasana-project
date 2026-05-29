"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ArrowLeft,
  ArrowRight,
  Search,
  FileText,
  CalendarCheck,
  MoreHorizontal,
  PencilIcon,
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
    venue: "Menara Bripens",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-08-15",
    packageName: "MENARA BRIPENS PACKAGE",
    variantName: "ALFA",
    pax: 800,
    price: 135000000,
    discount: 5000000,
    totalPrice: 130000000,
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
    venue: "Menara Bripens",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-08-15",
    packageName: "MENARA BRIPENS PACKAGE",
    variantName: "SIGNATURE",
    pax: 800,
    price: 240000000,
    discount: 15000000,
    totalPrice: 225000000,
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
    venue: "BRIN Thamrin",
    category: "weddings",
    eventType: "Teapai & Resepsi",
    eventDate: "2026-10-05",
    packageName: "BRIN THAMRIN PACKAGE",
    variantName: "SAPPHIRE",
    pax: 800,
    price: 180000000,
    discount: 0,
    totalPrice: 180000000,
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
    venue: "Grand Slipi",
    category: "mice",
    eventType: "Fullday Meeting 8hrs",
    eventDate: "2026-07-10",
    packageName: "GRAND SLIPI PACKAGE",
    variantName: "GOLD",
    pax: 800,
    price: 145000000,
    discount: 10000000,
    totalPrice: 135000000,
    status: "draft",
    validUntil: "2026-06-20",
    salesName: "Deni",
    createdAt: "2026-05-19",
    notes: "Masih menunggu konfirmasi anggaran",
  },
  {
    id: "5",
    leadName: "Budi Santoso",
    leadPhone: "081298765432",
    venue: "Paramita",
    category: "weddings",
    eventType: "Resepsi",
    eventDate: "2026-09-20",
    packageName: "PARAMITA PACKAGE",
    variantName: "CLASSIC",
    pax: 800,
    price: 140000000,
    discount: 0,
    totalPrice: 140000000,
    status: "rejected",
    validUntil: "2026-06-10",
    salesName: "Sari",
    createdAt: "2026-05-20",
    notes: "Budget tidak sesuai",
  },
  {
    id: "6",
    leadName: "Dwi Prasetyo",
    leadPhone: "081277889900",
    venue: "Lippo Kuningan",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-11-22",
    packageName: "LIPPO KUNINGAN PACKAGE",
    variantName: "PLATINUM",
    pax: 800,
    price: 250000000,
    discount: 10000000,
    totalPrice: 240000000,
    status: "sent",
    validUntil: "2026-07-31",
    salesName: "Tono",
    createdAt: "2026-05-21",
    notes: "",
  },
  {
    id: "7",
    leadName: "PT Global Teknologi",
    leadPhone: "02198765432",
    venue: "Samisara Sopodel",
    category: "mice",
    eventType: "Halfday Meeting 6hrs",
    eventDate: "2026-06-25",
    packageName: "SAMISARA SOPODEL PACKAGE",
    variantName: "PRIORITY",
    pax: 800,
    price: 230000000,
    discount: 5000000,
    totalPrice: 225000000,
    status: "draft",
    validUntil: "2026-06-15",
    salesName: "Deni",
    createdAt: "2026-05-22",
    notes: "",
  },
  {
    id: "8",
    leadName: "Eka Wulandari",
    leadPhone: "081312345678",
    venue: "Seskoad",
    category: "weddings",
    eventType: "Pemberkatan Resepsi",
    eventDate: "2026-12-06",
    packageName: "SESKOAD PACKAGE",
    variantName: "GOLD",
    pax: 800,
    price: 133000000,
    discount: 0,
    totalPrice: 133000000,
    status: "accepted",
    validUntil: "2026-08-01",
    salesName: "Rina",
    createdAt: "2026-05-23",
    notes: "Sudah deal, tunggu tanda tangan",
  },
  {
    id: "9",
    leadName: "PT Telkom Indonesia",
    leadPhone: "02145678901",
    venue: "BRIN Gatot Subroto",
    category: "mice",
    eventType: "Gala Dinner",
    eventDate: "2026-09-18",
    packageName: "BRIN GATOT SUBROTO PACKAGE",
    variantName: "SAPPHIRE",
    pax: 800,
    price: 195000000,
    discount: 15000000,
    totalPrice: 180000000,
    status: "sent",
    validUntil: "2026-07-20",
    salesName: "Sari",
    createdAt: "2026-05-24",
    notes: "",
  },
  {
    id: "10",
    leadName: "Fajar Nugroho",
    leadPhone: "081356789012",
    venue: "Dharmagati",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-07-26",
    packageName: "DHARMAGATI PACKAGE",
    variantName: "PLATINUM",
    pax: 800,
    price: 265000000,
    discount: 0,
    totalPrice: 265000000,
    status: "revised",
    validUntil: "2026-06-25",
    salesName: "Tono",
    createdAt: "2026-05-25",
    notes: "Revisi paket dan harga",
  },
  {
    id: "11",
    leadName: "PT Astra Internasional",
    leadPhone: "02167890123",
    venue: "Patrajasa",
    category: "mice",
    eventType: "Corporate Event",
    eventDate: "2026-08-07",
    packageName: "PATRAJASA PACKAGE",
    variantName: "GOLD",
    pax: 800,
    price: 160000000,
    discount: 10000000,
    totalPrice: 150000000,
    status: "draft",
    validUntil: "2026-07-01",
    salesName: "Deni",
    createdAt: "2026-05-26",
    notes: "",
  },
  {
    id: "12",
    leadName: "Budi Santoso",
    leadPhone: "081298765432",
    venue: "Paramita",
    category: "weddings",
    eventType: "Resepsi",
    eventDate: "2026-09-20",
    packageName: "PARAMITA PACKAGE",
    variantName: "ROYAL",
    pax: 800,
    price: 275000000,
    discount: 5000000,
    totalPrice: 270000000,
    status: "sent",
    validUntil: "2026-07-10",
    salesName: "Sari",
    createdAt: "2026-05-27",
    notes: "Revisi naik tier dari CLASSIC",
  },
];

const ROWS_PER_PAGE = 10;

type QuotationStatus = QuotationItem["status"];

interface StatusMeta {
  label: string;
  dotClass: string;
  badgeVariant: "outline" | "secondary" | "default" | "destructive";
}

const STATUS_META: Record<QuotationStatus, StatusMeta> = {
  draft: {
    label: "Draft",
    dotClass: "bg-transparent border border-muted-foreground/60",
    badgeVariant: "outline",
  },
  sent: {
    label: "Sent",
    dotClass: "bg-muted-foreground/60 border border-muted-foreground/60",
    badgeVariant: "outline",
  },
  revised: {
    label: "Revised",
    dotClass: "bg-foreground/50 border border-foreground/50",
    badgeVariant: "secondary",
  },
  accepted: {
    label: "Accepted",
    dotClass: "bg-foreground border border-foreground",
    badgeVariant: "default",
  },
  rejected: {
    label: "Rejected",
    dotClass: "bg-destructive border border-destructive",
    badgeVariant: "destructive",
  },
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
  return format(new Date(dateStr), "d MMM yyyy");
}

function StatusDot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", className)}
    />
  );
}

function StatusBadge({ status }: { status: QuotationStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge
      variant={meta.badgeVariant}
      className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium"
    >
      <StatusDot
        className={
          meta.badgeVariant === "default"
            ? "bg-primary-foreground border border-primary-foreground"
            : meta.badgeVariant === "destructive"
              ? "bg-destructive-foreground border border-destructive-foreground"
              : meta.dotClass
        }
      />
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

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as QuotationStatus | "all");
    setCurrentPage(1);
  }

  const statusCounts = ALL_STATUSES.map((s) => ({
    status: s,
    label: STATUS_META[s].label,
    dotClass: STATUS_META[s].dotClass,
    count: DUMMY_QUOTATIONS.filter((q) => q.status === s).length,
  }));

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex flex-col gap-3 px-4 sm:px-6 pb-4 border-b sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-foreground">
                List Quotations
              </h2>
              <span className="text-sm font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full">
                {filtered.length}
                {search || statusFilter !== "all"
                  ? ` dari ${DUMMY_QUOTATIONS.length}`
                  : " quotations"}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
              {/* Status filter */}
              <Select
                value={statusFilter}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger
                  className="h-9 w-full sm:w-40 text-sm"
                  aria-label="Filter status quotation"
                >
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Semua Status ({DUMMY_QUOTATIONS.length})
                  </SelectItem>
                  {statusCounts.map((s) => (
                    <SelectItem key={s.status} value={s.status}>
                      <span className="flex items-center gap-2">
                        <StatusDot className={s.dotClass} />
                        {s.label} ({s.count})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                />
                <Input
                  type="search"
                  aria-label="Cari quotation"
                  placeholder="Cari quotation..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 pl-9 w-full sm:w-52"
                />
              </div>

              {/* Add button */}
              <Button className="h-9" onClick={handleAdd}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah Quotation
              </Button>
            </div>
          </div>

          {/* Table */}
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                {/* # — 4% — always visible */}
                <TableHead className="w-[4%] text-center">#</TableHead>
                {/* Customer — 18% — always visible */}
                <TableHead className="w-[18%]">Customer</TableHead>
                {/* Venue — 14% — always visible */}
                <TableHead className="w-[14%]">Venue</TableHead>
                {/* Paket / Varian — 22% — hidden on xs, visible sm+ */}
                <TableHead className="w-[22%] hidden sm:table-cell">
                  Paket / Varian
                </TableHead>
                {/* Event — 14% — hidden until lg */}
                <TableHead className="w-[14%] hidden lg:table-cell">
                  Event
                </TableHead>
                {/* Total — 14% — always visible, right-aligned */}
                <TableHead className="w-[14%] text-right">Total</TableHead>
                {/* Status — 9% — always visible */}
                <TableHead className="w-[9%]">Status</TableHead>
                {/* Actions — 5% — always visible */}
                <TableHead className="w-[5%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-16 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <FileText
                        aria-hidden="true"
                        className="h-10 w-10 opacity-40"
                      />
                      <p className="text-sm">
                        {search
                          ? `Tidak ada hasil untuk "${search}"`
                          : "Belum ada quotation."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((q, idx) => (
                  <TableRow
                    key={q.id}
                    onClick={() => handleEdit(q)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleEdit(q);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit quotation ${q.leadName}`}
                    className="cursor-pointer hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    {/* # */}
                    <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                      {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                    </TableCell>
                    {/* Customer */}
                    <TableCell className="min-w-0">
                      <div className="min-w-0">
                        <span
                          title={q.leadName}
                          className="block truncate font-medium text-sm text-foreground"
                        >
                          {q.leadName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {q.leadPhone}
                        </span>
                      </div>
                    </TableCell>

                    {/* Venue */}
                    <TableCell className="min-w-0">
                      <span
                        title={q.venue}
                        className="block truncate text-sm"
                      >
                        {q.venue}
                      </span>
                    </TableCell>

                    {/* Paket / Varian — hidden xs */}
                    <TableCell className="min-w-0 hidden sm:table-cell">
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-medium uppercase tracking-wide text-foreground">
                          {q.variantName}
                        </span>
                        <span
                          title={q.packageName}
                          className="block truncate text-xs text-muted-foreground"
                        >
                          {q.packageName}
                        </span>
                      </div>
                    </TableCell>

                    {/* Event — hidden until lg */}
                    <TableCell className="min-w-0 hidden lg:table-cell">
                      <div className="min-w-0">
                        <span className="block truncate text-sm">
                          {formatDate(q.eventDate)}
                        </span>
                        <span
                          title={q.eventType}
                          className="block truncate text-xs text-muted-foreground"
                        >
                          {q.eventType}
                        </span>
                      </div>
                    </TableCell>

                    {/* Total */}
                    <TableCell className="text-right tabular-nums font-semibold text-sm">
                      {formatRupiah(q.totalPrice)}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <StatusBadge status={q.status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="text-right"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Aksi untuk quotation ${q.leadName}`}
                          >
                            <MoreHorizontal
                              aria-hidden="true"
                              className="h-4 w-4"
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEdit(q)}
                          >
                            <PencilIcon
                              aria-hidden="true"
                              className="h-4 w-4 mr-2"
                            />
                            Edit
                          </DropdownMenuItem>
                          {q.status === "accepted" && (
                            <DropdownMenuItem
                              onClick={() => handleConvertToBooking(q)}
                            >
                              <CalendarCheck
                                aria-hidden="true"
                                className="h-4 w-4 mr-2"
                              />
                              Convert ke Booking
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Navigasi halaman quotation"
              className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-t sm:flex-row sm:justify-between sm:items-center"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                aria-label="Halaman sebelumnya"
              >
                <ArrowLeft aria-hidden="true" className="w-4 h-4" /> Previous
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
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                aria-label="Halaman berikutnya"
              >
                Next <ArrowRight aria-hidden="true" className="w-4 h-4" />
              </Button>
            </nav>
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
