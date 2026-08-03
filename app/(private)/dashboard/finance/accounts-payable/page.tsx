"use client";

import { useMemo, useState } from "react";
import { AltArrowDown, CalendarMark, CheckCircle, ClockCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApSummaryCards } from "./_components/ap-summary-cards";
import { ApFilterBar } from "./_components/ap-filter-bar";
import { ApTable } from "./_components/ap-table";
import { ApPayDrawer } from "./_components/ap-pay-drawer";
import { ApDetailDrawer } from "./_components/ap-detail-drawer";
import { fmtDate, fmtRp } from "./_components/ap-format";
import { AP_PAYABLES, buildApEvents } from "./_components/ap-dummy";
import type { APFilters, APPayable } from "@/types/finance";

const ROWS_PER_PAGE = 10;

export default function AccountsPayablePage() {
  const [view, setView] = useState("event");
  const [filters, setFilters] = useState<APFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<APPayable | null>(null);
  const [payTarget, setPayTarget] = useState<APPayable | null>(null);

  const filtered = useMemo(() => {
    const q = filters.search?.toLowerCase().trim();
    return AP_PAYABLES.filter((p) => {
      if (p.status === "paid") return false; // Outstanding = belum lunas
      if (filters.category && p.category !== filters.category) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.ack && p.ackStatus !== filters.ack) return false;
      if (q && !`${p.payeeName} ${p.title} ${p.eventName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filters]);

  const summary = useMemo(() => {
    const outstanding = AP_PAYABLES.filter((p) => p.status !== "paid");
    return {
      totalOutstanding: outstanding.reduce((s, p) => s + p.outstanding, 0),
      totalPaid: AP_PAYABLES.reduce((s, p) => s + p.paidAmount, 0),
      pendingAckCount: AP_PAYABLES.filter((p) => p.paidAmount > 0 && p.ackStatus === "pending").length,
      onHoldCount: AP_PAYABLES.filter((p) => p.status === "on_hold").length,
    };
  }, []);

  const events = useMemo(() => buildApEvents(AP_PAYABLES), []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleEvent(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4 px-2 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">Accounts Payable</h1>
          <p className="text-xs text-muted-foreground">
            Semua kewajiban uang keluar — bonus sales, fee manager, tunjangan WP, general expense & MICE.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {view === "outstanding" ? `${filtered.length} payable` : `${events.length} event`}
        </span>
      </div>

      <ApSummaryCards summary={summary} />

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="event">Per Event</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding" className="flex flex-col gap-4">
          <ApFilterBar
            filters={filters}
            onFiltersChange={(f) => {
              setFilters(f);
              setCurrentPage(1);
            }}
          />

          <ApTable
            payables={paginated}
            loading={false}
            onOpenDetail={setDetailTarget}
            onPay={setPayTarget}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            emptyLabel="Tidak ada payable outstanding."
          />
        </TabsContent>

        <TabsContent value="event" className="flex flex-col gap-3">
          {events.map((ev) => {
            const open = !collapsed.has(ev.id);
            return (
              <div key={ev.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleEvent(ev.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40"
                >
                  <AltArrowDown
                    weight="BoldDuotone"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      !open && "-rotate-90",
                    )}
                  />
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <CalendarMark weight="BoldDuotone" className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{ev.eventName}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(ev.eventDate)}</p>
                  </div>
                  <span
                    className={cn(
                      "hidden items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium sm:inline-flex",
                      ev.eventDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    {ev.eventDone ? (
                      <CheckCircle weight="BoldDuotone" className="size-3" />
                    ) : (
                      <ClockCircle weight="BoldDuotone" className="size-3" />
                    )}
                    {ev.eventDone ? "Selesai" : "Belum selesai"}
                  </span>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
                    <p className="font-heading text-sm font-bold tabular-nums text-foreground">
                      {fmtRp(ev.totalOutstanding)}
                    </p>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border p-3">
                    <ApTable
                      payables={ev.payables}
                      loading={false}
                      onOpenDetail={setDetailTarget}
                      onPay={setPayTarget}
                      currentPage={1}
                      totalPages={1}
                      onPageChange={() => {}}
                      showEvent={false}
                      emptyLabel="Tidak ada payable untuk event ini."
                    />
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      <ApDetailDrawer isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} payable={detailTarget} />
      <ApPayDrawer isOpen={!!payTarget} onClose={() => setPayTarget(null)} payable={payTarget} />
    </div>
  );
}
