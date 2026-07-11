"use client";

import { useMemo, useState } from "react";
import { AddCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SEED_LEDGER,
  SEED_ACTIVITY,
  activitiesForEntry,
  generateKwitansiNumber,
  nextKwitansiSeq,
} from "./_components/ledger-dummy";
import { LedgerSummaryCards } from "./_components/ledger-summary-cards";
import { LedgerFilterBar } from "./_components/ledger-filter-bar";
import { LedgerTable } from "./_components/ledger-table";
import { LedgerEntryDrawer } from "./_components/ledger-entry-drawer";
import { KwitansiPreviewModal } from "./_components/kwitansi-preview-modal";
import { LedgerAckModal, type LedgerAckResult } from "./_components/ledger-ack-modal";
import { LedgerActivityModal } from "./_components/ledger-activity-modal";
import type {
  LedgerActivity,
  LedgerEntry,
  LedgerFilters,
  LedgerSummary,
} from "@/types/finance";

/* ─── Tab config ─────────────────────────────────────────────────────────── */

type TabKey = "all" | "receivable" | "unearned" | "earned" | "discount";

interface TabConfig {
  key: TabKey;
  label: string;
  predicate: (e: LedgerEntry) => boolean;
}

const TABS: TabConfig[] = [
  { key: "all", label: "Semua", predicate: () => true },
  { key: "receivable", label: "Piutang", predicate: (e) => e.status === "receivable" },
  { key: "unearned", label: "Unearned", predicate: (e) => e.status === "unearned" },
  { key: "earned", label: "Earned", predicate: (e) => e.status === "earned" },
  { key: "discount", label: "Potongan", predicate: (e) => e.entryType === "discount" },
];

const ROWS_PER_PAGE = 10;

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function LedgerPage(): React.ReactElement {
  const [ledger, setLedger] = useState<LedgerEntry[]>(SEED_LEDGER);
  const [activities, setActivities] = useState<LedgerActivity[]>(SEED_ACTIVITY);
  const [filters, setFilters] = useState<LedgerFilters>({});
  const [tab, setTab] = useState<TabKey>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kwitansiEntry, setKwitansiEntry] = useState<LedgerEntry | null>(null);
  const [kwitansiOpen, setKwitansiOpen] = useState(false);
  const [ackEntry, setAckEntry] = useState<LedgerEntry | null>(null);
  const [ackOpen, setAckOpen] = useState(false);
  const [activityEntry, setActivityEntry] = useState<LedgerEntry | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  /* ── Summary — computed over FULL ledger ──────────────────────────────── */

  const summary = useMemo<LedgerSummary>(() => {
    let piutang = 0;
    let unearned = 0;
    let earned = 0;
    let potongan = 0;

    for (const e of ledger) {
      if (e.status === "receivable") {
        piutang += e.amount;
      }
      if (e.status === "unearned" && e.entryType !== "discount") {
        unearned += e.amount;
      }
      if (e.status === "earned" && e.entryType !== "recognition") {
        earned += e.amount;
      }
      if (e.entryType === "discount") {
        potongan += e.amount;
      }
    }

    return { piutang, unearned, earned, potongan };
  }, [ledger]);

  /* ── Tab counts — for the pill badges ──────────────────────────────────── */

  const tabCounts = useMemo<Record<TabKey, number>>(() => {
    const counts = {} as Record<TabKey, number>;
    for (const t of TABS) {
      counts[t.key] = ledger.filter(t.predicate).length;
    }
    return counts;
  }, [ledger]);

  /* ── Activity counts — for the Riwayat badge per entry ─────────────────── */

  const activityCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const a of activities) {
      counts[a.entryId] = (counts[a.entryId] ?? 0) + 1;
    }
    return counts;
  }, [activities]);

  /* ── Filtered + sorted entries ────────────────────────────────────────── */

  const filtered = useMemo(() => {
    const q = filters.search?.toLowerCase().trim();
    const tabPredicate = TABS.find((t) => t.key === tab)?.predicate ?? (() => true);

    const result = ledger.filter((e) => {
      if (!tabPredicate(e)) return false;
      if (filters.status && e.status !== filters.status) return false;
      if (filters.entryType && e.entryType !== filters.entryType) return false;
      if (filters.dateRange?.from && e.occurredAt < filters.dateRange.from) return false;
      if (filters.dateRange?.to && e.occurredAt > filters.dateRange.to) return false;
      if (q) {
        const haystack = `${e.clientName} ${e.invoiceNumber ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [ledger, filters, tab]);

  /* ── Pagination ───────────────────────────────────────────────────────── */

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  );

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  function handleRecord(rows: LedgerEntry[]): void {
    // Auto-generate nomor kwitansi buat baris cash_in (butuh running sequence).
    // Discount row tetap tanpa nomor.
    let seq = nextKwitansiSeq(ledger);
    const numbered = rows.map((r) => {
      if (r.entryType !== "cash_in") return r;
      const withNumber = { ...r, invoiceNumber: generateKwitansiNumber(seq, r.occurredAt) };
      seq += 1;
      return withNumber;
    });
    setLedger((prev) => [...numbered, ...prev]);
    // Setiap transaksi baru lahir dengan jejak "Dicatat" di riwayatnya.
    const now = new Date().toISOString();
    const created: LedgerActivity[] = numbered.map((r, i) => ({
      id: `act-new-${r.id}-${i}`,
      entryId: r.id,
      action: "created",
      actorName: "Bintang",
      actorRole: "Sales",
      signatureDataUrl: null,
      note: r.notes ?? null,
      createdAt: now,
    }));
    setActivities((prev) => [...created, ...prev]);
    setDrawerOpen(false);
  }

  // Ack = butuh approval + ttd → buka modal verifikasi (bukan langsung acknowledge).
  function handleAck(target: LedgerEntry): void {
    setAckEntry(target);
    setAckOpen(true);
  }

  function handleAckConfirm(target: LedgerEntry, result: LedgerAckResult): void {
    setLedger((prev) =>
      prev.map((e) =>
        e.id === target.id
          ? { ...e, ackStatus: "acknowledged", acknowledgedBy: "Rosita" }
          : e,
      ),
    );
    const activity: LedgerActivity = {
      id: `act-ack-${target.id}-${new Date().getTime()}`,
      entryId: target.id,
      action: "acknowledged",
      actorName: "Rosita",
      actorRole: "Finance",
      signatureDataUrl: result.signatureDataUrl,
      note: null,
      createdAt: new Date().toISOString(),
    };
    setActivities((prev) => [activity, ...prev]);
  }

  function handleActivity(target: LedgerEntry): void {
    setActivityEntry(target);
    setActivityOpen(true);
  }

  function handleKwitansi(target: LedgerEntry): void {
    setKwitansiEntry(target);
    setKwitansiOpen(true);
  }

  function handleFiltersChange(f: LedgerFilters): void {
    setFilters(f);
    setCurrentPage(1);
  }

  function handleTabChange(value: TabKey): void {
    setTab(value);
    setCurrentPage(1);
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-4">
      {/* 1. KPI cards — page title/subtitle live in the dashboard header (route-meta) */}
      <LedgerSummaryCards summary={summary} />

      {/* 3. Panel card (tabs + filter + list) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* ── Tab pills row + Catat Transaksi ── */}
        <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide">
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
          <Button
            className="ml-auto shrink-0 rounded-full"
            onClick={() => setDrawerOpen(true)}
          >
            <AddCircle weight="BoldDuotone" className="size-4" />
            <span className="hidden sm:inline">Catat Transaksi</span>
          </Button>
        </div>

        {/* ── Toolbar (filter) ── */}
        <div className="border-t border-border/60 px-4 py-3 sm:px-5">
          <LedgerFilterBar filters={filters} onFiltersChange={handleFiltersChange} />
        </div>

        {/* ── List body ── */}
        <div className="border-t border-border/60">
          <LedgerTable
            entries={paginated}
            onAck={handleAck}
            onKwitansi={handleKwitansi}
            onActivity={handleActivity}
            activityCounts={activityCounts}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            emptyLabel="Belum ada transaksi di tab ini."
          />
        </div>
      </div>

      {/* 4. Entry drawer */}
      <LedgerEntryDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleRecord}
      />

      {/* 5. Kwitansi preview + download */}
      <KwitansiPreviewModal
        open={kwitansiOpen}
        onOpenChange={setKwitansiOpen}
        entry={kwitansiEntry}
      />

      {/* 6. Ack — verifikasi pembayaran (approval + ttd) */}
      <LedgerAckModal
        open={ackOpen}
        onOpenChange={setAckOpen}
        entry={ackEntry}
        onConfirm={handleAckConfirm}
      />

      {/* 7. Riwayat / activity log transaksi */}
      <LedgerActivityModal
        open={activityOpen}
        onOpenChange={setActivityOpen}
        entry={activityEntry}
        activities={activityEntry ? activitiesForEntry(activityEntry.id, activities) : []}
      />
    </div>
  );
}
