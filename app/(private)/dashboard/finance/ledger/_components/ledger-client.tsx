"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AddCircle, Refresh } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { LedgerSummaryCards, type LedgerSummaryData } from "./ledger-summary-cards";
import { LedgerFilterBar, type LedgerFilters } from "./ledger-filter-bar";
import { LedgerTable } from "./ledger-table";
import { LedgerEntryDrawer, type LedgerPromoOption } from "./ledger-entry-drawer";
import { KwitansiPreviewModal } from "./kwitansi-preview-modal";
import { LedgerAckModal } from "./ledger-ack-modal";
import { LedgerRejectModal } from "./LedgerRejectModal";
import { LedgerVoidModal } from "./LedgerVoidModal";
import { LedgerDeleteModal } from "./LedgerDeleteModal";
import { LedgerUnackModal } from "./LedgerUnackModal";
import { LedgerActivityModal } from "./ledger-activity-modal";
import type { BookingPickerItem, LedgerRow } from "@/lib/queries/ledger";
import type { PaymentMethodPickerItem } from "@/lib/queries/payment-methods";

/* ─── Tab config ─────────────────────────────────────────────────────────── */

type TabKey = "all" | "pending" | "acknowledged" | "rejected" | "voided";

interface TabConfig {
  key: TabKey;
  label: string;
  predicate: (e: LedgerRow) => boolean;
}

const TABS: TabConfig[] = [
  { key: "all", label: "Semua", predicate: () => true },
  { key: "pending", label: "Menunggu", predicate: (e) => e.ackStatus === "pending" && !e.voided },
  { key: "acknowledged", label: "Terverifikasi", predicate: (e) => e.ackStatus === "acknowledged" && !e.voided },
  { key: "rejected", label: "Ditolak", predicate: (e) => e.ackStatus === "rejected" && !e.voided },
  { key: "voided", label: "Dibatalkan", predicate: (e) => e.voided },
];

const ROWS_PER_PAGE = 10;

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface LedgerClientProps {
  entries: LedgerRow[];
  bookings: BookingPickerItem[];
  promos: LedgerPromoOption[];
  paymentMethods: PaymentMethodPickerItem[];
}

/* ─── Client shell ───────────────────────────────────────────────────────── */

export function LedgerClient({
  entries,
  bookings,
  promos,
  paymentMethods,
}: LedgerClientProps): React.ReactElement {
  const router = useRouter();
  const { can } = usePermissions();
  // Catat cash-in = domain AR. finance-ap boleh lihat cashflow tapi tak boleh catat.
  const canRecord = can("finance-ar", "create");

  const [filters, setFilters] = useState<LedgerFilters>({});
  const [tab, setTab] = useState<TabKey>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kwitansiEntry, setKwitansiEntry] = useState<LedgerRow | null>(null);
  const [kwitansiOpen, setKwitansiOpen] = useState(false);
  const [ackEntry, setAckEntry] = useState<LedgerRow | null>(null);
  const [ackOpen, setAckOpen] = useState(false);
  const [rejectEntry, setRejectEntry] = useState<LedgerRow | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [voidEntry, setVoidEntry] = useState<LedgerRow | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<LedgerRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unackEntry, setUnackEntry] = useState<LedgerRow | null>(null);
  const [unackOpen, setUnackOpen] = useState(false);
  const [activityEntry, setActivityEntry] = useState<LedgerRow | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  /* ── Summary (cash-in, exclude void) ────────────────────────────────────── */

  const summary = useMemo<LedgerSummaryData>(() => {
    let totalCashIn = 0;
    let pendingAmount = 0;
    let discountTotal = 0;
    let txCount = 0;

    for (const e of entries) {
      if (e.voided) continue;
      txCount += 1;
      if (e.ackStatus === "acknowledged") {
        totalCashIn += e.cashAmount;
        discountTotal += e.discountAmount;
      }
      if (e.ackStatus === "pending") {
        pendingAmount += e.amount;
      }
    }

    return { totalCashIn, pendingAmount, discountTotal, txCount };
  }, [entries]);

  /* ── Tab counts ─────────────────────────────────────────────────────────── */

  const tabCounts = useMemo<Record<TabKey, number>>(() => {
    const counts = {} as Record<TabKey, number>;
    for (const t of TABS) {
      counts[t.key] = entries.filter(t.predicate).length;
    }
    return counts;
  }, [entries]);

  /* ── Filtered + sorted ──────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = filters.search?.toLowerCase().trim();
    const tabPredicate = TABS.find((t) => t.key === tab)?.predicate ?? (() => true);

    const result = entries.filter((e) => {
      if (!tabPredicate(e)) return false;
      const day = e.occurredAt.slice(0, 10);
      if (filters.dateRange?.from && day < filters.dateRange.from) return false;
      if (filters.dateRange?.to && day > filters.dateRange.to) return false;
      if (q) {
        const haystack = `${e.clientName} ${e.invoiceNumber ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [entries, filters, tab]);

  /* ── Pagination ─────────────────────────────────────────────────────────── */

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);

  /* ── Handlers ───────────────────────────────────────────────────────────── */

  function refresh(): void {
    router.refresh();
  }

  function handleAck(e: LedgerRow): void {
    setAckEntry(e);
    setAckOpen(true);
  }

  function handleReject(e: LedgerRow): void {
    setRejectEntry(e);
    setRejectOpen(true);
  }

  function handleVoid(e: LedgerRow): void {
    setVoidEntry(e);
    setVoidOpen(true);
  }

  function handleDelete(e: LedgerRow): void {
    setDeleteEntry(e);
    setDeleteOpen(true);
  }

  function handleUnack(e: LedgerRow): void {
    setUnackEntry(e);
    setUnackOpen(true);
  }

  function handleKwitansi(e: LedgerRow): void {
    setKwitansiEntry(e);
    setKwitansiOpen(true);
  }

  function handleActivity(e: LedgerRow): void {
    setActivityEntry(e);
    setActivityOpen(true);
  }

  function handleFiltersChange(f: LedgerFilters): void {
    setFilters(f);
    setCurrentPage(1);
  }

  function handleTabChange(value: TabKey): void {
    setTab(value);
    setCurrentPage(1);
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4">
      <LedgerSummaryCards summary={summary} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Tab pills + Catat Transaksi */}
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide">
            {TABS.map((t) => {
              const isActive = tab === t.key;
              const count = tabCounts[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTabChange(t.key)}
                  className={cn(
                    "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "tabular-nums",
                      isActive ? "text-primary-foreground/70" : "text-muted-foreground/70",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {canRecord && (
            <Button className="shrink-0 rounded-full" onClick={() => setDrawerOpen(true)}>
              <AddCircle weight="BoldDuotone" className="size-4" />
              <span className="hidden sm:inline">Catat Transaksi</span>
            </Button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3 sm:px-5">
          <div className="flex-1">
            <LedgerFilterBar filters={filters} onFiltersChange={handleFiltersChange} />
          </div>
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh data"
            title="Refresh data"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Refresh weight="BoldDuotone" className="size-4" />
          </button>
        </div>

        {/* List */}
        <div className="border-t border-border/60">
          <LedgerTable
            entries={paginated}
            onAck={handleAck}
            onReject={handleReject}
            onVoid={handleVoid}
            onDelete={handleDelete}
            onUnack={handleUnack}
            onKwitansi={handleKwitansi}
            onActivity={handleActivity}
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            emptyLabel="Belum ada transaksi di tab ini."
          />
        </div>
      </div>

      {/* Entry drawer — create */}
      <LedgerEntryDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={refresh}
        bookings={bookings}
        promos={promos}
        paymentMethods={paymentMethods}
      />

      {/* Kwitansi preview */}
      <KwitansiPreviewModal open={kwitansiOpen} onOpenChange={setKwitansiOpen} entry={kwitansiEntry} />

      {/* Ack */}
      <LedgerAckModal open={ackOpen} onOpenChange={setAckOpen} entry={ackEntry} onSuccess={refresh} />

      {/* Reject */}
      <LedgerRejectModal open={rejectOpen} onOpenChange={setRejectOpen} entry={rejectEntry} onSuccess={refresh} />

      {/* Void */}
      <LedgerVoidModal open={voidOpen} onOpenChange={setVoidOpen} entry={voidEntry} onSuccess={refresh} />

      {/* Delete */}
      <LedgerDeleteModal open={deleteOpen} onOpenChange={setDeleteOpen} entry={deleteEntry} onSuccess={refresh} />

      {/* Unack */}
      <LedgerUnackModal open={unackOpen} onOpenChange={setUnackOpen} entry={unackEntry} onSuccess={refresh} />

      {/* Riwayat */}
      <LedgerActivityModal open={activityOpen} onOpenChange={setActivityOpen} entry={activityEntry} />
    </div>
  );
}
