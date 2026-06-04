"use client";

import { useState, useMemo } from "react";
import { ARFilterBar } from "./_components/ar-filter-bar";
import { ARTable } from "./_components/ar-table";
import { ARDetailDrawer } from "./_components/ar-detail-drawer";
import { EditBookingFinanceDrawerById } from "@/app/(private)/dashboard/booking-weddings/_components/edit-finance-drawer";
import { useAR } from "@/hooks/use-ar";
import { usePermissions } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import type { ARBooking, ARFilters } from "@/types/finance";

const ROWS_PER_PAGE = 10;

export default function AccountsReceivablePage() {
  const { data: arResult, isLoading } = useAR();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canAck = can("finance-ar", "edit");
  const canEditKeuangan = can("finance-ar", "edit") || can("booking", "edit");
  const bookings = useMemo(() => arResult?.data ?? [], [arResult?.data]);
  const [filters, setFilters] = useState<ARFilters>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<ARBooking | null>(null);
  const [financeTarget, setFinanceTarget] = useState<{ id: string; customerName: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const venues = useMemo(() => {
    const seen = new Map<string, string>();
    bookings.forEach((b) => {
      if (b.venueId && b.namaEvent !== "-") seen.set(b.venueId, b.namaEvent);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  const salesPics = useMemo(() => {
    const seen = new Map<string, string>();
    bookings.forEach((b) => {
      if (b.salesId && b.salesPicName !== "-") seen.set(b.salesId, b.salesPicName);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filters.status && b.statusTermin !== filters.status) return false;
      if (filters.venue && b.venueId !== filters.venue) return false;
      if (filters.salesPic && b.salesId !== filters.salesPic) return false;
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
        <h1 className="text-base font-bold text-foreground">Accounts Receivable</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} booking</span>
      </div>

      <ARFilterBar
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setCurrentPage(1); }}
        venues={venues}
        salesPics={salesPics}
      />

      <ARTable
        bookings={paginated}
        loading={isLoading}
        expandedRow={expandedRow}
        onToggleRow={(id) => setExpandedRow((prev) => (prev === id ? null : id))}
        onOpenDetail={(b) => setDetailBooking(b)}
        onEditKeuangan={(b) => setFinanceTarget({ id: b.id, customerName: b.customerEvent })}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        canAck={canAck}
        canEditKeuangan={canEditKeuangan}
      />

      <ARDetailDrawer
        isOpen={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        booking={detailBooking}
      />

      {financeTarget && (
        <EditBookingFinanceDrawerById
          isOpen={!!financeTarget}
          onClose={() => {
            setFinanceTarget(null);
            qc.invalidateQueries({ queryKey: ["ar-bookings"] });
          }}
          bookingId={financeTarget.id}
          customerName={financeTarget.customerName}
          defaultTab="top"
        />
      )}
    </div>
  );
}
