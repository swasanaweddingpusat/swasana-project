"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AddCircle,
  Refresh,
  Wallet,
  HandMoney,
  ClipboardList,
  Magnifer,
  CloseCircle,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { voidPayable } from "@/actions/customer-payout";
import { fmtRp } from "./payout-format";
import { PayableTable } from "./PayableTable";
import { CreatePayableDrawer } from "./CreatePayableDrawer";
import { DisbursePayableDrawer } from "./DisbursePayableDrawer";
import type { PayableRow, PayableSummary } from "@/lib/queries/customer-payout";
import type { BookingPickerItem } from "@/lib/queries/ledger";
import type { PaymentMethodPickerItem } from "@/lib/queries/payment-methods";

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const ROWS_PER_PAGE = 10;

/* ─── Filters ─────────────────────────────────────────────────────────────────── */

type StatusFilter = "all" | "outstanding" | "paid" | "void";
type TypeFilter = "all" | "program_cashback" | "overpay_refund";

interface PayableFilters {
  status: StatusFilter;
  type: TypeFilter;
  search: string;
}

/* ─── Props ──────────────────────────────────────────────────────────────────── */

interface PayableClientViewProps {
  payables: PayableRow[];
  total: number;
  summary: PayableSummary;
  bookings: BookingPickerItem[];
  paymentMethods: PaymentMethodPickerItem[];
}

/* ─── Summary cards ──────────────────────────────────────────────────────────── */

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
}): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
          <Icon weight="BoldDuotone" className="size-4 text-muted-foreground" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 font-heading text-xl font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function PayableClientView({
  payables,
  summary,
  bookings,
  paymentMethods,
}: PayableClientViewProps): React.ReactElement {
  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────────────────── */

  const [filters, setFilters] = useState<PayableFilters>({
    status: "all",
    type: "all",
    search: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [disburseTarget, setDisburseTarget] = useState<PayableRow | null>(null);
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<PayableRow | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<PayableRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /* ── Filtered data ───────────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase().trim();
    return payables.filter((p) => {
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.type !== "all" && p.type !== filters.type) return false;
      if (q) {
        const haystack = p.clientName.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [payables, filters]);

  /* ── Pagination ──────────────────────────────────────────────────────────────── */

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  /* ── Filter active count ─────────────────────────────────────────────────────── */

  const activeFilterCount = [
    filters.status !== "all" ? filters.status : undefined,
    filters.type !== "all" ? filters.type : undefined,
    filters.search || undefined,
  ].filter(Boolean).length;

  /* ── Handlers ────────────────────────────────────────────────────────────────── */

  function refresh(): void {
    router.refresh();
  }

  function handleFiltersChange(partial: Partial<PayableFilters>): void {
    setFilters((prev) => ({ ...prev, ...partial }));
    setCurrentPage(1);
  }

  function handleDisburse(p: PayableRow): void {
    setDisburseTarget(p);
    setDisburseOpen(true);
  }

  function handleVoidRequest(p: PayableRow): void {
    setVoidTarget(p);
    setVoidDialogOpen(true);
  }

  async function handleVoidConfirm(): Promise<void> {
    if (!voidTarget) return;
    setVoidSubmitting(true);
    const result = await voidPayable({ payableId: voidTarget.id });
    setVoidSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Payable berhasil dibatalkan");
    setVoidDialogOpen(false);
    setVoidTarget(null);
    refresh();
  }

  function handleDetail(p: PayableRow): void {
    setDetailTarget(p);
    setDetailOpen(true);
  }

  /* ── Render ──────────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummaryCard
          icon={Wallet}
          label="Total Outstanding"
          value={fmtRp(summary.totalOutstanding)}
          sub="Belum dicairkan"
        />
        <SummaryCard
          icon={HandMoney}
          label="Dicairkan Bulan Ini"
          value={fmtRp(summary.totalPaidThisMonth)}
          sub="Kas keluar bulan ini"
        />
        <SummaryCard
          icon={ClipboardList}
          label="Jumlah Outstanding"
          value={summary.outstandingCount.toString()}
          sub="Menunggu pencairan"
        />
      </div>

      {/* ── Main card ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-4 sm:px-5">
          {/* Filter bar */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Magnifer
                weight="BoldDuotone"
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={filters.search}
                onChange={(e) => handleFiltersChange({ search: e.target.value })}
                placeholder="Cari client"
                className="h-8 w-44 rounded-full pl-8 text-xs"
              />
            </div>

            {/* Status filter */}
            <Select
              value={filters.status}
              onValueChange={(v) => handleFiltersChange({ status: v as StatusFilter })}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="outstanding">Outstanding</SelectItem>
                <SelectItem value="paid">Dicairkan</SelectItem>
                <SelectItem value="void">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>

            {/* Type filter */}
            <Select
              value={filters.type}
              onValueChange={(v) => handleFiltersChange({ type: v as TypeFilter })}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="program_cashback">Cashback Program</SelectItem>
                <SelectItem value="overpay_refund">Refund Overpay</SelectItem>
              </SelectContent>
            </Select>

            {/* Active filters badge + reset */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {activeFilterCount} filter
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() =>
                    setFilters({ status: "all", type: "all", search: "" })
                  }
                >
                  <CloseCircle weight="BoldDuotone" className="mr-1 size-3.5" />
                  Reset
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh data"
              title="Refresh data"
              className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Refresh weight="BoldDuotone" className="size-4" />
            </button>
            <Button className="shrink-0 rounded-full" onClick={() => setCreateOpen(true)}>
              <AddCircle weight="BoldDuotone" className="size-4" />
              <span className="hidden sm:inline">Buat Payable</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div
          className={cn(
            "p-4 sm:p-5",
            filtered.length === 0 && "min-h-48",
          )}
        >
          <PayableTable
            payables={paginated}
            onDisburse={handleDisburse}
            onVoid={handleVoidRequest}
            onDetail={handleDetail}
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            emptyLabel="Belum ada customer payout."
          />
        </div>
      </div>

      {/* ── Drawers ───────────────────────────────────────────────────────────── */}

      <CreatePayableDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={refresh}
        bookings={bookings}
      />

      <DisbursePayableDrawer
        target={disburseTarget}
        isOpen={disburseOpen}
        onClose={() => {
          setDisburseOpen(false);
          setDisburseTarget(null);
        }}
        onSuccess={refresh}
        paymentMethods={paymentMethods}
      />

      {/* Detail view — simple read-only dialog */}
      <AlertDialog open={detailOpen} onOpenChange={setDetailOpen}>
        {detailTarget && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Detail Payable</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="flex flex-col gap-1 pt-1 text-sm not-italic">
                  <span className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium text-foreground">{detailTarget.clientName}</span>
                  </span>
                  <span className="flex justify-between">
                    <span className="text-muted-foreground">Tipe</span>
                    <span className="font-medium text-foreground">
                      {detailTarget.type === "program_cashback" ? "Cashback Program" : "Refund Overpay"}
                    </span>
                  </span>
                  <span className="flex justify-between">
                    <span className="text-muted-foreground">Jumlah</span>
                    <span className="font-semibold text-foreground">{fmtRp(detailTarget.amount)}</span>
                  </span>
                  {detailTarget.disbursementNumber && (
                    <span className="flex justify-between">
                      <span className="text-muted-foreground">No. Disbursement</span>
                      <span className="font-mono text-xs text-foreground">{detailTarget.disbursementNumber}</span>
                    </span>
                  )}
                  {detailTarget.paymentMethod && (
                    <span className="flex justify-between">
                      <span className="text-muted-foreground">Via</span>
                      <span className="text-foreground">{detailTarget.paymentMethod}</span>
                    </span>
                  )}
                  {detailTarget.notes && (
                    <span className="flex justify-between gap-4">
                      <span className="shrink-0 text-muted-foreground">Catatan</span>
                      <span className="text-right text-foreground">{detailTarget.notes}</span>
                    </span>
                  )}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDetailOpen(false)}>
                Tutup
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* ── Void confirm dialog ───────────────────────────────────────────────── */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Payable?</AlertDialogTitle>
            <AlertDialogDescription>
              {voidTarget
                ? `Payable ${voidTarget.type === "program_cashback" ? "Cashback Program" : "Refund Overpay"} sebesar ${fmtRp(voidTarget.amount)} untuk ${voidTarget.clientName} akan dibatalkan. Tindakan ini tidak bisa diurungkan.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setVoidDialogOpen(false);
                setVoidTarget(null);
              }}
              disabled={voidSubmitting}
            >
              Tidak, Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void handleVoidConfirm();
              }}
              disabled={voidSubmitting}
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
