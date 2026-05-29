"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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

const CARDS_PER_PAGE = 8;

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

function formatCurrencyShort(n: number): string {
  if (n >= 1_000_000_000) {
    const val = n / 1_000_000_000;
    const rounded = Math.round(val * 10) / 10;
    return `Rp ${rounded % 1 === 0 ? rounded.toFixed(0) : rounded}M`;
  }
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    const rounded = Math.round(val * 10) / 10;
    return `Rp ${rounded % 1 === 0 ? rounded.toFixed(0) : rounded}jt`;
  }
  return formatRupiah(n);
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

interface QuotationCardProps {
  q: QuotationItem;
  onEdit: (q: QuotationItem) => void;
  onConvert: (q: QuotationItem) => void;
}

function QuotationCard({ q, onEdit, onConvert }: QuotationCardProps) {
  return (
    <Card className="group transition-colors hover:border-foreground/20 hover:bg-accent/30">
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Row 1: name + status + action menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="font-semibold text-foreground truncate leading-tight"
              title={q.leadName}
            >
              {q.leadName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {q.leadPhone}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={q.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Aksi untuk quotation ${q.leadName}`}
                >
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(q)}>
                  <PencilIcon aria-hidden="true" className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                {q.status === "accepted" && (
                  <DropdownMenuItem onClick={() => onConvert(q)}>
                    <CalendarCheck
                      aria-hidden="true"
                      className="h-3.5 w-3.5 mr-2"
                    />
                    Convert ke Booking
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: total price */}
        <div>
          <p className="text-xl font-bold text-foreground leading-tight">
            {formatRupiah(q.totalPrice)}
          </p>
          {q.discount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              was {formatCurrencyShort(q.price)}, hemat{" "}
              {formatCurrencyShort(q.discount)}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Row 3: venue · package · variant */}
        <p className="text-sm text-foreground/80 truncate" title={`${q.venue} · ${q.packageName} ${q.variantName}`}>
          {q.venue} &middot; {q.packageName} {q.variantName}
        </p>

        {/* Row 4: event date */}
        <div className="flex items-center gap-1.5 text-sm text-foreground/80">
          <CalendarCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>Event: {formatDate(q.eventDate)}</span>
        </div>

        {/* Row 5: sales · valid until */}
        <p className="text-xs text-muted-foreground">
          Sales: {q.salesName}
          <span className="mx-1.5 text-border">|</span>
          Exp: {formatDate(q.validUntil)}
        </p>
      </CardContent>
    </Card>
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / CARDS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * CARDS_PER_PAGE,
    currentPage * CARDS_PER_PAGE
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
    if (statusFilter === status) {
      setStatusFilter("all");
    } else {
      setStatusFilter(status);
    }
    setCurrentPage(1);
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
          <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-b sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-foreground">
                List Quotations
              </h2>
              <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full">
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
                  <SelectItem value="all">Semua Status</SelectItem>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <StatusDot className={STATUS_META[s].dotClass} />
                        {STATUS_META[s].label}
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
                  className="pl-9 w-full sm:w-52"
                />
              </div>

              {/* Add button */}
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah Quotation
              </Button>
            </div>
          </div>

          {/* Status summary badges */}
          <div
            role="group"
            aria-label="Filter quotation berdasarkan status"
            className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b overflow-x-auto sm:flex-wrap"
          >
            {statusCounts.map((s) => {
              const selected = statusFilter === s.status;
              return (
                <button
                  key={s.status}
                  type="button"
                  onClick={() => handleStatusBadgeClick(s.status)}
                  aria-pressed={selected}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  )}
                >
                  <StatusDot
                    className={
                      selected
                        ? "bg-primary-foreground border border-primary-foreground"
                        : s.dotClass
                    }
                  />
                  {s.label}
                  <span
                    className={cn(
                      "ml-0.5 font-bold",
                      selected
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    ({s.count})
                  </span>
                </button>
              );
            })}
            {statusFilter !== "all" && (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground ml-1 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Reset
              </button>
            )}
          </div>

          {/* Card grid / empty state */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText
                aria-hidden="true"
                className="h-10 w-10 mb-3 opacity-40"
              />
              <p className="text-sm">
                {search
                  ? `Tidak ada hasil untuk "${search}"`
                  : "Belum ada quotation."}
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginated.map((q) => (
                  <QuotationCard
                    key={q.id}
                    q={q}
                    onEdit={handleEdit}
                    onConvert={handleConvertToBooking}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Navigasi halaman quotation"
              className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-t sm:flex-row sm:justify-between sm:items-center"
            >
              <Button
                variant="outline"
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
