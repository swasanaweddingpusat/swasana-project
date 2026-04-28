"use client";

import { useState, useMemo } from "react";
import { ARFilterBar } from "./_components/ar-filter-bar";
import { ARTable } from "./_components/ar-table";
import { ARDetailDrawer } from "./_components/ar-detail-drawer";
import { useAR } from "@/hooks/use-ar";
import type { ARBooking, ARFilters } from "@/types/finance";

const ROWS_PER_PAGE = 10;

export default function AccountsReceivablePage() {
  const { data: bookings = [], isLoading } = useAR();
  const [filters, setFilters] = useState<ARFilters>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<ARBooking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filters.status && b.statusTermin !== filters.status) return false;
      if (filters.dateRange?.from && b.customerDate < filters.dateRange.from) return false;
      if (filters.dateRange?.to && b.customerDate > filters.dateRange.to) return false;
      return true;
    });
  }, [bookings, filters]);

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4 py-6 px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-bold text-[#1D1D1D]">Accounts Receivable</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} booking</span>
      </div>

      <ARFilterBar
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setCurrentPage(1); }}
      />

      <ARTable
        bookings={paginated}
        loading={isLoading}
        expandedRow={expandedRow}
        onToggleRow={(id) => setExpandedRow((prev) => (prev === id ? null : id))}
        onOpenDetail={(b) => setDetailBooking(b)}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <ARDetailDrawer
        isOpen={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        booking={detailBooking}
      />
    </div>
  );
}
