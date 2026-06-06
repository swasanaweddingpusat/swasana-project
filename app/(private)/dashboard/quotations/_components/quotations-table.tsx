"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AddCircle,
  ArrowLeft,
  ArrowRight,
  Magnifer,
  FileText,
  CalendarMark,
  MenuDots,
  Pen,
  Eye,
  TrashBinTrash,
  Refresh,
  Filter,
} from "@solar-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useQuotations, useDeleteQuotation } from "@/hooks/use-quotations";
import type { QuotationListRow } from "@/lib/queries/quotations";
import { QuotationDrawer } from "./quotation-drawer";
import { QuotationPreview } from "./quotation-preview";

/** Satu baris penawaran (flat list). Total default = qty * price, tapi bisa di-override manual. */
export interface QuotationLineItem {
  id: string;
  description: string;
  /** Rich HTML description from TipTap (for edit prefill) */
  richDescription?: string;
  qty: number;
  price: number;
  total: number;
  /** true kalau total diisi manual (tidak mengikuti qty * price) */
  manualTotal?: boolean;
}

export interface QuotationItem {
  id: string;
  /** Nomor dokumen, mis. "#221-MICE". Optional — di-derive kalau kosong. */
  quotationNo?: string;
  purchaseOrderNo?: string;
  // ── Customer / PIC ─────────────────────────────────────────────
  leadName: string;
  leadPhone: string;
  /** Instansi / perusahaan (mis. "Al Azhar") */
  instansi?: string;
  // ── Sales ──────────────────────────────────────────────────────
  salesName: string;
  salesPhone?: string;
  // ── Event ──────────────────────────────────────────────────────
  venue: string;
  category: "weddings" | "mice";
  eventType: string;
  eventDate: string;
  /** mis. "Venue Only" */
  details?: string;
  /** mis. "Half Day 07.00 - 13.00" */
  time?: string;
  /** mis. "Ballroom" */
  place?: string;
  // ── Paket (ringkasan untuk list) ───────────────────────────────
  packageName: string;
  variantName: string;
  pax: number;
  // ── Line items (detail penawaran) ──────────────────────────────
  items?: QuotationLineItem[];
  // ── Pricing ────────────────────────────────────────────────────
  price: number;
  discount: number;
  totalPrice: number;
  // ── Term & Payment ─────────────────────────────────────────────
  bookingFee?: number;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  downPayment?: number;
  others?: number;
  // ── Meta ───────────────────────────────────────────────────────
  status: "draft" | "sent" | "revised" | "accepted" | "rejected";
  validUntil: string;
  createdAt: string;
  /** Tanggal dokumen diterbitkan (mis. "2026-02-04") */
  issuedAt?: string;
  notes: string;
  signingLocation?: string;
  signatureSales?: string;
  // ── Term of Payment (for edit prefill) ─────────────────────────
  termOfPayments?: Array<{
    id: string;
    name: string;
    amount: number;
    dueDate: string | null;
    sortOrder: number;
    paymentStatus: string;
  }>;
}

// ── DB row → display type mapper ─────────────────────────────────────────────

function mapRowToQuotationItem(row: QuotationListRow): QuotationItem {
  return {
    id: row.id,
    quotationNo: row.quotationNo ?? undefined,
    leadName: row.clientName,
    leadPhone: row.clientPhone,
    instansi: row.instansi ?? undefined,
    salesName: row.sales.fullName ?? "",
    salesPhone: row.sales.phoneNumber ?? undefined,
    venue: row.venueName ?? row.venue?.name ?? "",
    category: row.category.toLowerCase() as "weddings" | "mice",
    eventType: row.eventTypeName ?? row.eventType?.name ?? "",
    eventDate: row.eventDate ? format(new Date(row.eventDate), "yyyy-MM-dd") : "",
    time: row.time ?? undefined,
    details: row.details ?? undefined,
    // items from DB → QuotationLineItem[]
    items: row.items.map((it) => ({
      id: it.id,
      description: it.title,
      richDescription: it.description ?? undefined,
      qty: it.qty,
      price: it.price,
      total: it.total,
      manualTotal: it.manualTotal,
    })),
    price: row.subtotal,
    discount: row.discount,
    totalPrice: row.totalPrice,
    status: row.status as QuotationItem["status"],
    validUntil: row.validUntil ? format(new Date(row.validUntil), "yyyy-MM-dd") : "",
    createdAt: format(new Date(row.createdAt), "yyyy-MM-dd"),
    notes: row.notes ?? "",
    signingLocation: row.signingLocation ?? undefined,
    signatureSales: row.signatureSales ?? undefined,
    termOfPayments: row.terms.map((t) => ({
      id: t.id,
      name: t.name,
      amount: t.amount,
      dueDate: t.dueDate ? format(new Date(t.dueDate), "yyyy-MM-dd") : null,
      sortOrder: t.sortOrder,
      paymentStatus: t.paymentStatus,
    })),
    packageName: "",
    variantName: "",
    pax: 0,
  };
}

const ROWS_PER_PAGE = 10;

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  pages.add(current);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= total) pages.add(current + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
      result.push("...");
    }
  }
  return result;
}

function SkeletonMobileCards({ rows = ROWS_PER_PAGE }: { rows?: number }) {
  return (
    <div className="block sm:hidden p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
          {/* Row 1: number + name + status badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="h-4 w-5 rounded shrink-0" />
              <div className="space-y-1 min-w-0">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-4 rounded" style={{ width: `${100 + (i % 4) * 20}px` }} />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
          </div>
          {/* Row 2: venue + event type + date + total */}
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
          {/* Footer: buttons */}
          <div className="flex items-center gap-1 pt-1 border-t border-border">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-md shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

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

/** Nomor dokumen — pakai yang ada, atau derive dari id + kategori. */
function deriveQuotationNo(q: QuotationItem): string {
  if (q.quotationNo) return q.quotationNo;
  const suffix = q.category === "mice" ? "MICE" : "WED";
  return `#${q.id}-${suffix}`;
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
  const [statusFilter, setStatusFilter] = useState<QuotationStatus | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editQuotation, setEditQuotation] = useState<QuotationItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState<QuotationItem | null>(null);

  // ── Server-side data ──────────────────────────────────────────────────────
  const { data: quotationsResult, isLoading, isError, isFetching, refetch } = useQuotations({
    page: currentPage,
    pageSize: ROWS_PER_PAGE,
    search,
    status: statusFilter === "all" ? "" : statusFilter,
  });

  const deleteQuotation = useDeleteQuotation();

  const rawRows = quotationsResult?.data ?? [];
  const total = quotationsResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const paginated = rawRows.map(mapRowToQuotationItem);

  const handleAdd = useCallback(() => {
    setEditQuotation(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((q: QuotationItem) => {
    setEditQuotation(q);
    setDrawerOpen(true);
  }, []);

  const handlePreview = useCallback((q: QuotationItem) => {
    setPreviewQuotation(q);
    setPreviewOpen(true);
  }, []);

  function handleConvertToBooking(q: QuotationItem) {
    toast.info(`Convert ke Booking untuk ${q.leadName} — coming soon.`);
  }

  async function handleDelete(q: QuotationItem) {
    const confirmed = window.confirm(
      `Hapus quotation "${deriveQuotationNo(q)}" untuk ${q.leadName}? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) return;
    const result = await deleteQuotation.mutateAsync(q.id);
    if (result.success) {
      toast.success("Quotation berhasil dihapus.");
    } else {
      toast.error(result.error ?? "Gagal menghapus quotation.");
    }
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value as QuotationStatus | "all");
    setCurrentPage(1);
  }

  const statusCounts = ALL_STATUSES.map((s) => ({
    status: s,
    label: STATUS_META[s].label,
    dotClass: STATUS_META[s].dotClass,
    count: 0, // server doesn't return per-status counts in list query
  }));

  const hasActiveFilter = statusFilter !== "all";

  const FilterPopoverContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filter</p>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <SearchableSelect
          options={[
            { id: "all", name: "Semua Status" },
            ...statusCounts.map((s) => ({ id: s.status, name: s.label })),
          ]}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          placeholder="Semua Status"
          searchPlaceholder="Cari status..."
          emptyText="Status tidak ditemukan"
          className="h-9"
        />
      </div>
    </div>
  );

  const FilterTriggerIcon = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("shrink-0 relative", hasActiveFilter && "border-primary/50")}
      aria-label="Filter quotation"
    >
      <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
      {hasActiveFilter && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
          1
        </span>
      )}
    </Button>
  );

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* ════════════════════════════════════════════════════════════════
              MOBILE TOOLBAR  (visible < sm)
              Row 1: [count badge] ──── [filter icon] [refresh icon] [add button]
              Row 2: [search full-width]
          ════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-2 px-4 pb-3 border-b sm:hidden">
            {/* Row 1 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
                {isLoading ? "..." : total}
              </span>
              <div className="flex-1" />
              {/* Filter popover */}
              <Popover>
                <PopoverTrigger render={FilterTriggerIcon} />
                <PopoverContent align="end" className="w-64 p-3">
                  {FilterPopoverContent}
                </PopoverContent>
              </Popover>
              {/* Refresh */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh daftar quotation"
                className="shrink-0"
              >
                <Refresh
                  weight="BoldDuotone"
                  aria-hidden="true"
                  className={cn("h-4 w-4", isFetching && "animate-spin")}
                />
              </Button>
              {/* Add */}
              <Button size="icon" onClick={handleAdd} className="shrink-0" aria-label="Tambah quotation">
                <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
            {/* Row 2: Search full-width */}
            <div className="relative w-full">
              <Magnifer
                weight="BoldDuotone"
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label="Cari quotation"
                placeholder="Cari quotation..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 w-full"
              />
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              DESKTOP TOOLBAR  (visible sm+)
              Single row: [count] | [refresh] [filter] [search] →→ [add]
          ════════════════════════════════════════════════════════════════ */}
          <div className="hidden sm:flex items-center gap-2 px-6 pb-3 border-b">
            {/* Count badge */}
            <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full shrink-0">
              {isLoading ? "..." : total} quotations
            </span>

            {/* Divider */}
            <div className="w-px h-5 bg-border shrink-0 mx-1" aria-hidden="true" />

            {/* Refresh */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh daftar quotation"
              title="Muat ulang"
              className="shrink-0"
            >
              <Refresh
                weight="BoldDuotone"
                aria-hidden="true"
                className={cn("h-4 w-4", isFetching && "animate-spin")}
              />
            </Button>

            {/* Filter popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("h-9 gap-1.5 shrink-0", hasActiveFilter && "border-primary/50")}
                    aria-label="Filter quotation"
                  >
                    <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                    Filter
                    {hasActiveFilter && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        1
                      </span>
                    )}
                  </Button>
                }
              />
              <PopoverContent align="end" className="w-64 p-3">
                {FilterPopoverContent}
              </PopoverContent>
            </Popover>

            {/* Search */}
            <div className="relative">
              <Magnifer
                weight="BoldDuotone"
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label="Cari quotation"
                placeholder="Cari quotation..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9 w-48"
              />
            </div>

            {/* Add — pushed to far right */}
            <Button onClick={handleAdd} className="ml-auto shrink-0">
              <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
              Tambah Quotation
            </Button>
          </div>

          {/* Loading / Error / Empty — shared state for both layouts */}
          {isLoading ? (
            <>
              {/* Desktop skeleton: simple spinner in table-like wrapper */}
              <div className="hidden sm:flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Refresh weight="BoldDuotone" aria-hidden="true" className="h-8 w-8 opacity-40 animate-spin" />
                <p className="text-sm mt-3">Memuat data quotation...</p>
              </div>
              {/* Mobile skeleton: cards */}
              <SkeletonMobileCards rows={ROWS_PER_PAGE} />
            </>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText weight="BoldDuotone" aria-hidden="true" className="h-10 w-10 opacity-40" />
              <p className="text-sm mt-3">
                Gagal memuat data.{" "}
                <button onClick={() => refetch()} className="underline text-primary">
                  Coba lagi
                </button>
              </p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText weight="BoldDuotone" aria-hidden="true" className="h-10 w-10 opacity-40" />
              <p className="text-sm mt-3">
                {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada quotation."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table (sm+) */}
              <div className="hidden sm:block w-full overflow-x-auto">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      {/* # — 4% — always visible */}
                      <TableHead className="w-[4%] text-center">#</TableHead>
                      {/* Customer — 18% — always visible */}
                      <TableHead className="w-[18%]">Customer</TableHead>
                      {/* Venue — 18% — always visible */}
                      <TableHead className="w-[18%]">Venue</TableHead>
                      {/* Sales — 16% — hidden on xs, visible sm+ */}
                      <TableHead className="w-[16%] hidden sm:table-cell">
                        Sales
                      </TableHead>
                      {/* Event — 18% — hidden until lg */}
                      <TableHead className="w-[18%] hidden lg:table-cell">
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
                    {isFetching ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                          <Refresh weight="BoldDuotone" aria-hidden="true" className="h-6 w-6 opacity-40 animate-spin mx-auto" />
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
                              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                {deriveQuotationNo(q)}
                              </span>
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
                            <span title={q.venue} className="block truncate text-sm">
                              {q.venue}
                            </span>
                          </TableCell>

                          {/* Sales — hidden xs */}
                          <TableCell className="min-w-0 hidden sm:table-cell">
                            <div className="min-w-0">
                              <span
                                title={q.salesName}
                                className="block truncate text-sm text-foreground"
                              >
                                {q.salesName || "—"}
                              </span>
                              {q.salesPhone && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {q.salesPhone}
                                </span>
                              )}
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
                                  <MenuDots
                                    weight="BoldDuotone"
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                  />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handlePreview(q)}>
                                  <Eye
                                    weight="BoldDuotone"
                                    aria-hidden="true"
                                    className="h-4 w-4 mr-2 text-primary"
                                  />
                                  Lihat / Cetak
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(q)}>
                                  <Pen
                                    weight="BoldDuotone"
                                    aria-hidden="true"
                                    className="h-4 w-4 mr-2 text-primary"
                                  />
                                  Edit
                                </DropdownMenuItem>
                                {q.status === "accepted" && (
                                  <DropdownMenuItem onClick={() => handleConvertToBooking(q)}>
                                    <CalendarMark
                                      weight="BoldDuotone"
                                      aria-hidden="true"
                                      className="h-4 w-4 mr-2 text-primary"
                                    />
                                    Convert ke Booking
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDelete(q)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <TrashBinTrash
                                    weight="BoldDuotone"
                                    aria-hidden="true"
                                    className="h-4 w-4 mr-2"
                                  />
                                  Hapus
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list (<sm) */}
              {isFetching ? (
                <SkeletonMobileCards rows={Math.max(paginated.length, ROWS_PER_PAGE)} />
              ) : (
                <div className="block sm:hidden p-4 space-y-3">
                  {paginated.map((q, idx) => {
                    const rowNumber = (currentPage - 1) * ROWS_PER_PAGE + idx + 1;
                    return (
                      <div
                        key={q.id}
                        className="rounded-lg border bg-card p-3 space-y-2"
                      >
                        {/* Row 1: nomor + nama customer + nomor quotation + StatusBadge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0 mt-0.5">
                              {rowNumber}.
                            </span>
                            <div className="min-w-0">
                              <span className="block font-mono text-[10px] text-muted-foreground truncate">
                                {deriveQuotationNo(q)}
                              </span>
                              <span
                                title={q.leadName}
                                className="block font-medium text-sm text-foreground truncate"
                              >
                                {q.leadName}
                              </span>
                            </div>
                          </div>
                          <StatusBadge status={q.status} />
                        </div>

                        {/* Row 2: venue · event type · event date · total */}
                        <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                          <span className="truncate">{q.venue}</span>
                          {q.eventType && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{q.eventType}</span>
                            </>
                          )}
                          {q.eventDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{formatDate(q.eventDate)}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatRupiah(q.totalPrice)}
                          </span>
                        </div>

                        {/* Footer: action buttons */}
                        <div className="flex items-center gap-1 pt-1 border-t border-border">
                          <Button
                            variant="outline"
                            className="h-9 flex-1 text-xs"
                            onClick={() => handlePreview(q)}
                            aria-label={`Lihat/cetak ${deriveQuotationNo(q)}`}
                          >
                            <Eye
                              weight="BoldDuotone"
                              aria-hidden="true"
                              className="h-3.5 w-3.5 mr-1 text-muted-foreground"
                            />
                            Lihat/Cetak
                          </Button>
                          <Button
                            variant="outline"
                            className="h-9 flex-1 text-xs"
                            onClick={() => handleEdit(q)}
                            aria-label={`Edit ${deriveQuotationNo(q)}`}
                          >
                            <Pen
                              weight="BoldDuotone"
                              aria-hidden="true"
                              className="h-3.5 w-3.5 mr-1 text-muted-foreground"
                            />
                            Edit
                          </Button>
                          {q.status === "accepted" && (
                            <Button
                              variant="outline"
                              className="h-9 flex-1 text-xs"
                              onClick={() => handleConvertToBooking(q)}
                              aria-label={`Convert ke booking ${deriveQuotationNo(q)}`}
                            >
                              <CalendarMark
                                weight="BoldDuotone"
                                aria-hidden="true"
                                className="h-3.5 w-3.5 mr-1 text-muted-foreground"
                              />
                              Convert
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(q)}
                            aria-label={`Hapus ${deriveQuotationNo(q)}`}
                          >
                            <TrashBinTrash
                              weight="BoldDuotone"
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                aria-label="Halaman sebelumnya"
              >
                <ArrowLeft weight="BoldDuotone" aria-hidden="true" className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              {/* Mobile: X / Y */}
              <span className="text-sm text-muted-foreground sm:hidden">
                {currentPage} / {totalPages}
              </span>
              {/* Desktop: page numbers with ellipsis */}
              <div className="hidden sm:flex items-center gap-1">
                {buildPageRange(currentPage, totalPages).map((item, idx) =>
                  item === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 py-1 text-sm text-muted-foreground select-none"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item as number)}
                      aria-label={`Halaman ${item}`}
                      aria-current={currentPage === item ? "page" : undefined}
                      className={cn(
                        "px-3 py-1 rounded-md text-sm font-medium cursor-pointer",
                        currentPage === item
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                aria-label="Halaman berikutnya"
              >
                <span className="hidden sm:inline">Next</span>
                <ArrowRight weight="BoldDuotone" aria-hidden="true" className="w-4 h-4 sm:ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <QuotationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editQuotation={editQuotation}
        onSuccess={() => {
          setCurrentPage(1);
          refetch();
        }}
      />

      <QuotationPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        quotation={previewQuotation}
      />
    </>
  );
}
