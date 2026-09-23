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
  ClipboardCheck,
  ClockCircle,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useConvertQuotationToMiceBooking,
  useDuplicateQuotationRevision,
  useQuotations,
} from "@/hooks/use-quotations";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permissions";
import type { QuotationListRow } from "@/lib/queries/quotations";
import { QuotationDrawer } from "./quotation-drawer";
import { QuotationPreview } from "./quotation-preview";
import { ApprovalDialog } from "@/app/(private)/booking/packages/_components/approval-dialog";
import { ApproveModal } from "@/app/(private)/booking/packages/_components/approve-modal";

// ── Approval types ───────────────────────────────────────────────────────────

interface QApprovalStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRoleId: string | null;
  approverUserId: string | null;
  status: string;
  approverRole: { id: string; name: string } | null;
  approverUser: { id: string; fullName: string | null } | null;
}

interface QApprovalRecord {
  id: string;
  entityId: string;
  status: string;
  steps: QApprovalStep[];
  createdBy: { id: string; fullName: string | null };
}

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
    items: row.items
      .filter((it) => it.type !== "ADDITIONAL")
      .map((it) => ({
        id: it.id,
        description: it.title,
        richDescription: it.description ?? undefined,
        qty: it.qty,
        price: it.price,
        total: it.total,
        manualTotal: it.manualTotal,
      })),
    additionals: row.items
      .filter((it) => it.type === "ADDITIONAL")
      .map((it) => ({
        id: it.id,
        description: it.title,
        richDescription: it.description ?? undefined,
        qty: it.qty,
        price: it.price,
        total: it.total,
        manualTotal: it.manualTotal,
      })),
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
    price: row.subtotal,
    discount: row.discount,
    discountName: row.discountName ?? undefined,
    totalPrice: row.totalPrice,
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

export function QuotationsTable() {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editQuotation, setEditQuotation] = useState<QuotationItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState<QuotationItem | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<QuotationItem | null>(null);
  const [approveStepTarget, setApproveStepTarget] = useState<{ stepId: string; stepLabel: string; quotation: QuotationItem } | null>(null);

  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { isAdmin } = usePermissions();
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

  // ── Approval data (batch fetch for visible rows) ─────────────────────────
  const quotationIds = paginated.map((q) => q.id);
  const { data: approvalMap } = useQuery({
    queryKey: ["quotation-approvals", quotationIds],
    queryFn: async () => {
      if (quotationIds.length === 0) return {} as Record<string, QApprovalRecord>;
      const params = new URLSearchParams({
        module: "quotations",
        entityIds: quotationIds.join(","),
      });
      const response = await fetch(`/api/approval-records?${params}`);
      if (!response.ok) throw new Error("Gagal memuat approval quotation");
      const records: QApprovalRecord[] = await response.json();
      return Object.fromEntries(records.map((record) => [record.entityId, record]));
    },
    enabled: quotationIds.length > 0,
    staleTime: 15_000,
  });

  // ── Approval helpers ──────────────────────────────────────────────────────
  function getApprovalBadge(qId: string): { label: string; variant: "default" | "outline" | "secondary" | "destructive" } | null {
    const record = approvalMap?.[qId];
    if (!record) return null;
    const steps = record.steps.filter((s) => s.approverType !== "client");
    if (steps.length === 0) return null;
    if (steps.some((s) => s.status === "rejected")) return { label: "Ditolak", variant: "destructive" };
    if (steps.every((s) => s.status === "approved")) return { label: "Approved", variant: "default" };
    return { label: "Menunggu", variant: "secondary" };
  }

  function getActionableSteps(qId: string): QApprovalStep[] {
    const record = approvalMap?.[qId];
    if (!record) return [];
    return record.steps.filter((s) =>
      s.status === "pending" && s.approverType !== "client" && (
        isAdmin ||
        (s.approverType === "role" && s.approverRoleId === user?.roleId) ||
        (s.approverType === "user" && s.approverUserId === user?.profileId)
      )
    );
  }

  function stepLabel(s: QApprovalStep): string {
    return (s.approverType === "role" ? s.approverRole?.name : s.approverUser?.fullName) ?? "Approver";
  }

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

  function isFullyApproved(qId: string): boolean {
    return approvalMap?.[qId]?.status === "approved";
  }

  async function handleConvertToBooking(q: QuotationItem): Promise<void> {
    if (q.booking) {
      toast.info(`Quotation sudah menjadi booking ${q.booking.poNumber ?? q.booking.id}.`);
      return;
    }
    if (!isFullyApproved(q.id)) {
      toast.error("Quotation harus fully approved sebelum dikonversi.");
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
    if (!isFullyApproved(q.id)) {
      toast.error("Hanya quotation approved yang dapat direvisi.");
      return;
    }

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
                      {/* # — 4% */}
                      <TableHead className="w-[4%] text-center">#</TableHead>
                      {/* Customer — 22% */}
                      <TableHead className="w-[22%]">Customer</TableHead>
                      {/* Venue + Event Date — 21% */}
                      <TableHead className="w-[21%]">Venue</TableHead>
                      {/* Sales + Submit Date — 21% — hidden xs */}
                      <TableHead className="w-[21%] hidden sm:table-cell">Sales</TableHead>
                      {/* Total — 27% — right-aligned */}
                      <TableHead className="w-[27%] text-right">Total</TableHead>
                      {/* Actions — 5% */}
                      <TableHead className="w-[5%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFetching ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          <Refresh weight="BoldDuotone" aria-hidden="true" className="h-6 w-6 opacity-40 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((q, idx) => (
                        <TableRow
                          key={q.id}
                          onClick={() => {
                            if (isFullyApproved(q.id) || q.booking) {
                              handlePreview(q);
                            } else {
                              handleEdit(q);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (isFullyApproved(q.id) || q.booking) {
                                handlePreview(q);
                              } else {
                                handleEdit(q);
                              }
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${isFullyApproved(q.id) || q.booking ? "Lihat" : "Edit"} quotation ${q.leadName}`}
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
                              {(() => {
                                const badge = getApprovalBadge(q.id);
                                if (!badge) return null;
                                return (
                                  <Badge variant={badge.variant} className="text-[10px] mt-0.5">
                                    {badge.label}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </TableCell>

                          {/* Venue + Event Date */}
                          <TableCell className="min-w-0">
                            <div className="min-w-0">
                              <span title={q.venue} className="block truncate text-sm text-foreground">
                                {q.venue}
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
                                {!isFullyApproved(q.id) && !q.booking && (
                                  <DropdownMenuItem onClick={() => handleEdit(q)}>
                                    <Pen weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {isFullyApproved(q.id) && (
                                  <DropdownMenuItem
                                    onClick={() => handleCreateRevision(q)}
                                    disabled={revisionMutation.isPending}
                                  >
                                    <Refresh weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                    Buat Revisi
                                  </DropdownMenuItem>
                                )}
                                {getActionableSteps(q.id).map((step) => (
                                  <DropdownMenuItem
                                    key={step.id}
                                    onClick={() => setApproveStepTarget({
                                      stepId: step.id,
                                      stepLabel: stepLabel(step),
                                      quotation: q,
                                    })}
                                  >
                                    <ClipboardCheck weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-primary" />
                                    Approve {stepLabel(step)}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem onClick={() => { setApprovalTarget(q); setApprovalDialogOpen(true); }}>
                                  <ClockCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Lihat Approval
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleConvertToBooking(q)}
                                  disabled={!isFullyApproved(q.id) || !!q.booking || convertMutation.isPending}
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
                            {(() => {
                              const badge = getApprovalBadge(q.id);
                              if (!badge) return null;
                              return (
                                <Badge variant={badge.variant} className="text-[10px] mt-0.5">
                                  {badge.label}
                                </Badge>
                              );
                            })()}
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
                          {isFullyApproved(q.id) ? (
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
                          {(() => {
                            const steps = getActionableSteps(q.id);
                            if (steps.length === 0) return null;
                            return (
                              <Button
                                variant="outline"
                                className="h-9 flex-1 text-xs"
                                onClick={() => setApproveStepTarget({
                                  stepId: steps[0].id,
                                  stepLabel: stepLabel(steps[0]),
                                  quotation: q,
                                })}
                                aria-label={`Approve ${deriveQuotationNo(q)}`}
                              >
                                <ClipboardCheck weight="BoldDuotone" aria-hidden="true" className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                Approve
                              </Button>
                            );
                          })()}
                          <Button
                            variant="outline"
                            className="h-9 flex-1 text-xs"
                            onClick={() => handleConvertToBooking(q)}
                            disabled={!isFullyApproved(q.id) || !!q.booking || convertMutation.isPending}
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

      {approvalDialogOpen && approvalTarget && user && (
        <ApprovalDialog
          open={approvalDialogOpen}
          onClose={() => {
            setApprovalDialogOpen(false);
            setApprovalTarget(null);
            qc.invalidateQueries({ queryKey: ["quotation-approvals"] });
          }}
          packageId={approvalTarget.id}
          packageName={approvalTarget.leadName}
          userProfileId={user.profileId}
          userRoleId={user.roleId ?? null}
          module="quotations"
        />
      )}

      {approveStepTarget && (
        <ApproveModal
          open={!!approveStepTarget}
          onClose={() => {
            setApproveStepTarget(null);
            qc.invalidateQueries({ queryKey: ["quotation-approvals"] });
          }}
          stepId={approveStepTarget.stepId}
          stepLabel={approveStepTarget.stepLabel}
          packageName={approveStepTarget.quotation.leadName}
        />
      )}
    </>
  );
}
