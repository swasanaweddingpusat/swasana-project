"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useQuotations } from "@/hooks/use-quotations";
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

export interface QuotationComplimentaryItem {
  id: string;
  complimentaryId: string | null;
  name: string;
  price: number;
  isShowPrice: boolean;
  description?: string;
  qty: number;
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
  /** Tanggal akhir event kalau berupa rentang; kosong = single-date. */
  eventEndDate?: string;
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
  // ── Complimentary (bonus gratis, tidak masuk pricing) ───────────
  complimentaries?: QuotationComplimentaryItem[];
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
  paymentMethodId?: string;
  validUntil: string;
  createdAt: string;
  /** Tanggal dokumen diterbitkan (mis. "2026-02-04") */
  issuedAt?: string;
  notes: string;
  signingLocation?: string;
  signatureSales?: string;
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
    eventEndDate: row.eventEndDate ? format(new Date(row.eventEndDate), "yyyy-MM-dd") : "",
    time: row.time ?? undefined,
    place: row.place ?? undefined,
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
    complimentaries: row.complimentaries.map((c) => ({
      id: c.id,
      complimentaryId: c.complimentaryId,
      name: c.name,
      price: c.price,
      isShowPrice: c.isShowPrice,
      description: c.description ?? undefined,
      qty: c.qty,
    })),
    price: row.subtotal,
    discount: row.discount,
    totalPrice: row.totalPrice,
    bookingFee: row.bookingFee ?? undefined,
    status: row.status as QuotationItem["status"],
    paymentMethodId: row.paymentMethodId ?? undefined,
    bankName: row.paymentMethod?.bankName,
    bankAccountNo: row.paymentMethod?.bankAccountNumber,
    bankAccountName: row.paymentMethod?.bankRecipient,
    validUntil: row.validUntil ? format(new Date(row.validUntil), "yyyy-MM-dd") : "",
    createdAt: format(new Date(row.createdAt), "yyyy-MM-dd"),
    notes: row.notes ?? "",
    signingLocation: row.signingLocation ?? undefined,
    signatureSales: row.signatureSales ?? undefined,
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

export function QuotationsTable() {
  const [search, setSearch] = useState("");
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

  function handleConvertToBooking(q: QuotationItem) {
    toast.info(`Convert ke Booking untuk ${q.leadName} — coming soon.`);
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
                      {/* Customer — 18% */}
                      <TableHead className="w-[18%]">Customer</TableHead>
                      {/* Venue — 15% */}
                      <TableHead className="w-[15%]">Venue</TableHead>
                      {/* Sales — 14% — hidden xs */}
                      <TableHead className="w-[14%] hidden sm:table-cell">Sales</TableHead>
                      {/* Submit Date — 11% — hidden until md */}
                      <TableHead className="w-[11%] hidden md:table-cell">Submit</TableHead>
                      {/* Event Date — 11% — hidden until xl */}
                      <TableHead className="w-[11%] hidden xl:table-cell">Event</TableHead>
                      {/* Total — 23% — right-aligned */}
                      <TableHead className="w-[23%] text-right">Total</TableHead>
                      {/* Actions — 5% */}
                      <TableHead className="w-[5%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFetching ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
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

                          {/* Submit Date — hidden until md */}
                          <TableCell className="min-w-0 hidden md:table-cell">
                            <span className="block text-sm tabular-nums text-muted-foreground">
                              {q.createdAt ? formatDate(q.createdAt) : "—"}
                            </span>
                          </TableCell>

                          {/* Event Date — hidden until xl */}
                          <TableCell className="min-w-0 hidden xl:table-cell">
                            <span className="block text-sm tabular-nums">
                              {q.eventDate ? formatEventDateRange(q.eventDate, q.eventEndDate) : "—"}
                            </span>
                          </TableCell>

                          {/* Total */}
                          <TableCell className="text-right tabular-nums font-semibold text-sm">
                            {formatRupiah(q.totalPrice)}
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
                                <DropdownMenuItem onClick={() => handleEdit(q)}>
                                  <Pen weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleConvertToBooking(q)}>
                                  <CalendarMark weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                  Convert ke Booking
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
