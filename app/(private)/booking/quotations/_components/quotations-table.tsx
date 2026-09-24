"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  Refresh,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";

import {
  useConvertQuotationToMiceBooking,
  useDuplicateQuotationRevision,
  useQuotations,
} from "@/hooks/use-quotations";
import type { QuotationListRow } from "@/lib/queries/quotations";
import { calculateQuotationTotals } from "@/lib/quotationPricing";
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

export interface QuotationComplimentaryItem {
  id: string;
  complimentaryId: string | null;
  name: string;
  price: number;
  isShowPrice: boolean;
  description?: string;
  qty: number;
}

export interface QuotationBonusItem {
  id: string;
  bonusId: string | null;
  name: string;
  price: number;
  description?: string;
  qty: number;
}

export interface QuotationPriceItem {
  id: string;
  name: string;
  description?: string;
  priceType: "QTY" | "NOMINAL";
  qty: number | null;
  price: number | null;
  total: number;
  sortOrder: number;
}

export interface QuotationTaxDepositItem {
  id: string;
  name: string;
  nominal: number;
  sortOrder: number;
}

export interface QuotationTermItem {
  id: string;
  name: string;
  amount: number;
  dueDate: string | null;
  sortOrder: number;
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
  salesId?: string;
  // ── Event ──────────────────────────────────────────────────────
  venue: string;
  venueId?: string;
  eventType: string;
  eventTypeId?: string;
  eventDate: string;
  /** Tanggal akhir event kalau berupa rentang; kosong = single-date. */
  eventEndDate?: string;
  /** mis. "Venue Only" */
  details?: string;
  /** mis. "Half Day 07.00 - 13.00" */
  time?: string;
  /** mis. "Ballroom" */
  place?: string;
  // ── Paket (ringkasan untuk list) ───────────────────────────────
  packageId?: string;
  packageSource?: string;
  packageName: string;
  variantName: string;
  pax: number;
  // ── Line items (detail penawaran) ──────────────────────────────
  items?: QuotationLineItem[];
  additionals?: QuotationLineItem[];
  // ── Harga (step 2) ─────────────────────────────────────────────
  prices?: QuotationPriceItem[];
  // ── Tax & Deposit (step 4) ─────────────────────────────────────
  taxDeposits?: QuotationTaxDepositItem[];
  // ── Term of Payment / TOP (step 4) ─────────────────────────────
  terms?: QuotationTermItem[];
  // ── Complimentary (bonus gratis, tidak masuk pricing) ───────────
  complimentaries?: QuotationComplimentaryItem[];
  // ── Bonus (tidak masuk pricing) ─────────────────────────────────
  bonuses?: QuotationBonusItem[];
  // ── Pricing ────────────────────────────────────────────────────
  price: number;
  discount: number;
  discountName?: string;
  totalPrice: number;
  // ── Term & Payment ─────────────────────────────────────────────
  bookingFee?: number;
  termAndCondition?: string;
  paymentNote?: string;
  cancellationPolicy?: string;
  closingNote?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  downPayment?: number;
  others?: number;
  // ── Meta ───────────────────────────────────────────────────────
  status: "draft" | "sent" | "revised" | "accepted" | "rejected";
  paymentMethodId?: string;
  validUntil: string;
  createdAt: string;
  /** Tanggal dokumen diterbitkan (mis. "2026-02-04") */
  issuedAt?: string;
  notes: string;
  signingLocation?: string;
  signatureSales?: string;
  booking?: { id: string; poNumber: string | null } | null;
}

// ── DB row → display type mapper ─────────────────────────────────────────────

function mapRowToQuotationItem(row: QuotationListRow): QuotationItem {
  const items = row.items
    .filter((item) => item.type !== "ADDITIONAL")
    .map((item) => ({
      id: item.id,
      description: item.title,
      richDescription: item.description ?? undefined,
      qty: item.qty,
      price: item.price,
      total: item.total,
      manualTotal: item.manualTotal,
    }));
  const additionals = row.items
    .filter((item) => item.type === "ADDITIONAL")
    .map((item) => ({
      id: item.id,
      description: item.title,
      richDescription: item.description ?? undefined,
      qty: item.qty,
      price: item.price,
      total: item.total,
      manualTotal: item.manualTotal,
    }));
  const totals = calculateQuotationTotals({
    items,
    additionals,
    prices: row.prices,
    discount: row.discount,
  });

  return {
    id: row.id,
    quotationNo: row.quotationNo ?? undefined,
    leadName: row.clientName,
    leadPhone: row.clientPhone,
    instansi: row.instansi ?? undefined,
    salesName: row.sales.fullName ?? "",
    salesPhone: row.sales.phoneNumber ?? undefined,
    salesId: row.salesId,
    venue: row.venueName ?? "",
    venueId: row.venueId ?? undefined,
    eventType: row.eventTypeName ?? "",
    eventTypeId: row.eventTypeId ?? undefined,
    eventDate: row.eventDate ? format(new Date(row.eventDate), "yyyy-MM-dd") : "",
    eventEndDate: row.eventEndDate ? format(new Date(row.eventEndDate), "yyyy-MM-dd") : "",
    time: row.time ?? undefined,
    place: row.place ?? undefined,
    details: row.details ?? undefined,
    // items from DB → QuotationLineItem[] (split by type)
    items,
    additionals,
    prices: row.prices.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      priceType: p.priceType as "QTY" | "NOMINAL",
      qty: p.qty,
      price: p.price,
      total: p.total,
      sortOrder: p.sortOrder,
    })),
    taxDeposits: row.taxDeposits.map((t) => ({
      id: t.id,
      name: t.name,
      nominal: t.nominal,
      sortOrder: t.sortOrder,
    })),
    terms: row.terms.map((t) => ({
      id: t.id,
      name: t.name,
      amount: t.amount,
      dueDate: t.dueDate ? format(new Date(t.dueDate), "yyyy-MM-dd") : null,
      sortOrder: t.sortOrder,
    })),
    complimentaries: row.complimentaries.map((c) => ({
      id: c.id,
      complimentaryId: c.complimentaryId,
      name: c.name,
      price: c.price,
      isShowPrice: c.isShowPrice,
      description: c.description ?? undefined,
      qty: c.qty,
    })),
    bonuses: row.bonuses.map((b) => ({
      id: b.id,
      bonusId: b.bonusId,
      name: b.name,
      price: b.price,
      description: b.description ?? undefined,
      qty: b.qty,
    })),
    price: totals.subtotal,
    discount: row.discount,
    discountName: row.discountName ?? undefined,
    totalPrice: totals.totalPrice,
    bookingFee: row.bookingFee ?? undefined,
    termAndCondition: row.termAndCondition ?? undefined,
    paymentNote: row.paymentNote ?? undefined,
    cancellationPolicy: row.cancellationPolicy ?? undefined,
    closingNote: row.closingNote ?? undefined,
    status: row.status as QuotationItem["status"],
    paymentMethodId: row.paymentMethodId ?? undefined,
    bankName: row.bankName ?? undefined,
    bankAccountNo: row.bankAccountNumber ?? undefined,
    bankAccountName: row.bankRecipient ?? undefined,
    validUntil: row.validUntil ? format(new Date(row.validUntil), "yyyy-MM-dd") : "",
    createdAt: format(new Date(row.createdAt), "yyyy-MM-dd"),
    notes: row.notes ?? "",
    signingLocation: row.signingLocation ?? undefined,
    signatureSales: row.signatureSales ?? undefined,
    packageId: row.packageId ?? undefined,
    packageSource: row.packageSource ?? undefined,
    packageName: row.packageName ?? "",
    variantName: "",
    pax: row.pax,
    booking: row.booking,
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

function formatRupiah(amount: number): string {
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Nomor dokumen — pakai yang ada, atau derive dari id (quotation = MICE-only). */
function deriveQuotationNo(q: QuotationItem): string {
  if (q.quotationNo) return q.quotationNo;
  return `#${q.id}-MICE`;
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "d MMM yyyy");
}

/** Single date or "start – end" range when eventEndDate is set and differs from eventDate. */
function formatEventDateRange(eventDate: string, eventEndDate?: string): string {
  if (eventEndDate && eventEndDate !== eventDate) {
    return `${formatDate(eventDate)} – ${formatDate(eventEndDate)}`;
  }
  return formatDate(eventDate);
}

/**
 * True when the offer's validity window has closed. Compared date-only (the
 * quotation is still valid for the whole of its last day), and only for
 * quotations that have not been converted — once a booking exists the validity
 * date is history and flagging it as expired would be misleading.
 */
function isQuotationExpired(q: QuotationItem): boolean {
  if (!q.validUntil || q.booking) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(q.validUntil) < today;
}

export function QuotationsTable() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editQuotation, setEditQuotation] = useState<QuotationItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState<QuotationItem | null>(null);
  const convertMutation = useConvertQuotationToMiceBooking();
  const revisionMutation = useDuplicateQuotationRevision();

  // ── Server-side data ──────────────────────────────────────────────────────
  const { data: quotationsResult, isLoading, isError, isFetching, refetch } = useQuotations({
    page: currentPage,
    pageSize: ROWS_PER_PAGE,
    search,
  });

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

  async function handleConvertToBooking(q: QuotationItem): Promise<void> {
    if (q.booking) {
      toast.info(`Quotation sudah menjadi booking ${q.booking.poNumber ?? q.booking.id}.`);
      return;
    }
    const result = await convertMutation.mutateAsync(q.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Quotation berhasil dikonversi ke Booking MICE.");
    refetch();
  }

  async function handleCreateRevision(q: QuotationItem): Promise<void> {
    const result = await revisionMutation.mutateAsync(q.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Revisi ${result.data.quotationNo} berhasil dibuat.`);
    setCurrentPage(1);
    refetch();
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* ════════════════════════════════════════════════════════════════
              MOBILE TOOLBAR  (visible < sm)
              Row 1: [count badge] ──── [refresh icon] [add button]
              Row 2: [search full-width]
          ════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-2 px-4 pb-3 border-b sm:hidden">
            {/* Row 1 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
                {isLoading ? "..." : total}
              </span>
              <div className="flex-1" />
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
              Single row: [count] | [refresh] [search] →→ [add]
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
                      {/* # — 3% */}
                      <TableHead className="w-[3%] text-center">#</TableHead>
                      {/* Quotation no + client + instansi — 21% */}
                      <TableHead className="w-[21%]">Customer</TableHead>
                      {/* Event type + pax — 14%, hidden below lg to protect the
                          columns a salesperson scans first on narrow screens */}
                      <TableHead className="w-[14%] hidden lg:table-cell">Event</TableHead>
                      {/* Venue + event date — 18% */}
                      <TableHead className="w-[18%]">Venue</TableHead>
                      {/* Sales + created date — 15% */}
                      <TableHead className="w-[15%] hidden sm:table-cell">Sales</TableHead>
                      {/* Total + validity — 15% */}
                      <TableHead className="w-[15%] text-right">Total</TableHead>
                      {/* Document/conversion state — 14% */}
                      <TableHead className="w-[14%]">Status</TableHead>
                      {/* Actions — 5% */}
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
                          onClick={() => {
                            if (q.booking) {
                              handlePreview(q);
                            } else {
                              handleEdit(q);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (q.booking) {
                                handlePreview(q);
                              } else {
                                handleEdit(q);
                              }
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${q.booking ? "Lihat" : "Edit"} quotation ${q.leadName}`}
                          className="cursor-pointer hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        >
                          {/* # */}
                          <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                            {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                          </TableCell>
                          {/* Customer — document no, PIC, and the company the offer
                              is addressed to (MICE sells to organisations, so the
                              instansi is often what people search by) */}
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
                              {q.instansi ? (
                                <span title={q.instansi} className="block truncate text-xs text-muted-foreground">
                                  {q.instansi}
                                </span>
                              ) : (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {q.leadPhone}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Event type + pax — the two figures that separate an
                              otherwise identical Halfday and Fullday quotation */}
                          <TableCell className="min-w-0 hidden lg:table-cell">
                            <div className="min-w-0">
                              <span title={q.eventType} className="block truncate text-sm text-foreground">
                                {q.eventType || "—"}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground tabular-nums">
                                {q.pax > 0 ? `${q.pax} pax` : "—"}
                              </span>
                            </div>
                          </TableCell>

                          {/* Venue + Event Date */}
                          <TableCell className="min-w-0">
                            <div className="min-w-0">
                              <span title={q.venue} className="block truncate text-sm text-foreground">
                                {q.venue || "—"}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground tabular-nums">
                                {q.eventDate ? formatEventDateRange(q.eventDate, q.eventEndDate) : "—"}
                              </span>
                            </div>
                          </TableCell>

                          {/* Sales + Submit Date — hidden xs */}
                          <TableCell className="min-w-0 hidden sm:table-cell">
                            <div className="min-w-0">
                              <span
                                title={q.salesName}
                                className="block truncate text-sm text-foreground"
                              >
                                {q.salesName || "—"}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground tabular-nums">
                                {q.createdAt ? formatDate(q.createdAt) : "—"}
                              </span>
                            </div>
                          </TableCell>

                          {/* Total + validity — an expired offer is called out in
                              red so it is not quoted to a client by accident */}
                          <TableCell className="text-right">
                            <div className="min-w-0">
                              <span className="block truncate tabular-nums font-semibold text-sm text-foreground">
                                {formatRupiah(q.totalPrice)}
                              </span>
                              {q.validUntil && (
                                <span
                                  className={cn(
                                    "block truncate text-xs tabular-nums",
                                    isQuotationExpired(q) ? "text-destructive font-medium" : "text-muted-foreground",
                                  )}
                                >
                                  {isQuotationExpired(q) ? "Expired " : "s/d "}
                                  {formatDate(q.validUntil)}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Quotation has no approval lifecycle. Status only shows
                              whether it is still editable or already converted. */}
                          <TableCell className="min-w-0">
                            <div className="min-w-0 space-y-1">
                              <Badge variant={q.booking ? "default" : "secondary"} className="text-[10px]">
                                {q.booking ? "Converted" : "Siap"}
                              </Badge>
                              {q.booking && (
                                <span
                                  title={q.booking.poNumber ?? undefined}
                                  className="flex items-center gap-1 min-w-0 text-[11px] text-muted-foreground"
                                >
                                  <CalendarMark
                                    weight="BoldDuotone"
                                    aria-hidden="true"
                                    className="h-3 w-3 shrink-0 text-primary"
                                  />
                                  <span className="truncate font-mono">
                                    {q.booking.poNumber ?? "Booking"}
                                  </span>
                                </span>
                              )}
                            </div>
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
                                  <Eye weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                  Lihat / Cetak
                                </DropdownMenuItem>
                                {!q.booking && (
                                  <DropdownMenuItem onClick={() => handleEdit(q)}>
                                    <Pen weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {q.booking && (
                                  <DropdownMenuItem
                                    onClick={() => handleCreateRevision(q)}
                                    disabled={revisionMutation.isPending}
                                  >
                                    <Refresh weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                    Buat Revisi
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleConvertToBooking(q)}
                                  disabled={!!q.booking || convertMutation.isPending}
                                >
                                  <CalendarMark weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                  {q.booking ? "Sudah Dikonversi" : "Convert ke Booking"}
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
                        {/* Row 1: nomor + nama customer + nomor quotation */}
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0 mt-0.5">
                            {rowNumber}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="block font-mono text-[10px] text-muted-foreground truncate">
                              {deriveQuotationNo(q)}
                            </span>
                            <span
                              title={q.leadName}
                              className="block font-medium text-sm text-foreground truncate"
                            >
                              {q.leadName}
                            </span>
                            {q.instansi && (
                              <span title={q.instansi} className="block text-xs text-muted-foreground truncate">
                                {q.instansi}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <Badge variant={q.booking ? "default" : "secondary"} className="text-[10px]">
                                {q.booking ? "Converted" : "Siap"}
                              </Badge>
                              {q.booking && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                                  <CalendarMark weight="BoldDuotone" aria-hidden="true" className="h-3 w-3 shrink-0 text-primary" />
                                  <span className="truncate font-mono">{q.booking.poNumber ?? "Booking"}</span>
                                </span>
                              )}
                              {isQuotationExpired(q) && (
                                <span className="text-[10px] font-medium text-destructive">
                                  Expired {formatDate(q.validUntil)}
                                </span>
                              )}
                            </div>
                          </div>
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
                          {q.pax > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate tabular-nums">{q.pax} pax</span>
                            </>
                          )}
                          {q.eventDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">
                                {formatEventDateRange(q.eventDate, q.eventEndDate)}
                              </span>
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
                          {q.booking ? (
                            <Button
                              variant="outline"
                              className="h-9 flex-1 text-xs"
                              onClick={() => handleCreateRevision(q)}
                              disabled={revisionMutation.isPending}
                              aria-label={`Buat revisi ${deriveQuotationNo(q)}`}
                            >
                              <Refresh
                                weight="BoldDuotone"
                                aria-hidden="true"
                                className="h-3.5 w-3.5 mr-1 text-muted-foreground"
                              />
                              Revisi
                            </Button>
                          ) : (
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
                          )}
                          <Button
                            variant="outline"
                            className="h-9 flex-1 text-xs"
                            onClick={() => handleConvertToBooking(q)}
                            disabled={!!q.booking || convertMutation.isPending}
                            aria-label={`Convert ke booking ${deriveQuotationNo(q)}`}
                          >
                            <CalendarMark
                              weight="BoldDuotone"
                              aria-hidden="true"
                              className="h-3.5 w-3.5 mr-1 text-muted-foreground"
                            />
                            {q.booking ? "Converted" : "Convert"}
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
