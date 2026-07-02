"use client";

import { useMemo, useState } from "react";
import { ApSummaryCards } from "../_components/ap-summary-cards";
import { ApFilterBar } from "../_components/ap-filter-bar";
import { ApTable } from "../_components/ap-table";
import { ApPayDrawer } from "../_components/ap-pay-drawer";
import { ApDetailDrawer } from "../_components/ap-detail-drawer";
import { AP_PAYABLES } from "../_components/ap-dummy";
import type { APFilters, APPayable } from "@/types/finance";

const ROWS_PER_PAGE = 10;

export default function AccountsPayableOutstandingPage() {
  const [filters, setFilters] = useState<APFilters>({});
  const [detailTarget, setDetailTarget] = useState<APPayable | null>(null);
  const [payTarget, setPayTarget] = useState<APPayable | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4 px-2 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-foreground">Outstanding</h1>
          <p className="text-xs text-muted-foreground">
            Semua kewajiban yang belum dibayar — bonus sales, fee manager, tunjangan WP, general expense & MICE.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} payable</span>
      </div>

      <ApSummaryCards summary={summary} />

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

      <ApDetailDrawer isOpen={!!detailTarget} onClose={() => setDetailTarget(null)} payable={detailTarget} />
      <ApPayDrawer isOpen={!!payTarget} onClose={() => setPayTarget(null)} payable={payTarget} />
    </div>
  );
}
