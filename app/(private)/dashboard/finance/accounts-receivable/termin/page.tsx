"use client";

import { useMemo, useState } from "react";
import { AltArrowDown, AltArrowUp } from "@solar-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ARFilterBar } from "../_components/ar-filter-bar";
import { ARTable } from "../_components/ar-table";
import { ARDetailDrawer } from "../_components/ar-detail-drawer";
import { EditTopDrawerById } from "@/app/(private)/dashboard/booking-weddings/_components/edit-top-drawer";
import { useAR } from "@/hooks/use-ar";
import { usePermissions } from "@/hooks/use-permissions";
import type { ARBooking, ARFilters } from "@/types/finance";

const ROWS_PER_PAGE = 10;

export default function AccountsReceivableTerminPage() {
  const { data: arResult, isLoading } = useAR();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canEditKeuangan = can("finance-ar", "edit") || can("booking", "edit");

  const bookings = useMemo(() => arResult?.data ?? [], [arResult?.data]);
  const [filters, setFilters] = useState<ARFilters>({});
  const [detailBooking, setDetailBooking] = useState<ARBooking | null>(null);
  const [financeTarget, setFinanceTarget] = useState<{ id: string; customerName: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Track rows the user explicitly collapsed; everything else stays open, so
  // freshly loaded rows default to expanded without an effect.
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());

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
    const q = filters.search?.trim().toLowerCase();
    return bookings.filter((b) => {
      if (filters.status && b.statusTermin !== filters.status) return false;
      if (filters.venue && b.venueId !== filters.venue) return false;
      if (filters.salesPic && b.salesId !== filters.salesPic) return false;
      if (filters.dateRange?.from && b.customerDate < filters.dateRange.from) return false;
      if (filters.dateRange?.to && b.customerDate > filters.dateRange.to) return false;
      if (q) {
        const haystack = `${b.customerEvent} ${b.namaEvent} ${b.noPo}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, filters]);

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  // Expansion is derived per visible page: open = not in collapsedRows.
  const expandedRows = useMemo(() => {
    const s = new Set<string>();
    paginated.forEach((b) => {
      if (!collapsedRows.has(b.id)) s.add(b.id);
    });
    return s;
  }, [paginated, collapsedRows]);

  const allOpen = paginated.length > 0 && expandedRows.size === paginated.length;

  function toggleRow(id: string) {
    setCollapsedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allOpen) setCollapsedRows(new Set(paginated.map((b) => b.id)));
    else setCollapsedRows(new Set());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-bold text-foreground">Termin</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} booking</span>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            disabled={paginated.length === 0}
            className="gap-1.5 rounded-full"
          >
            {allOpen ? (
              <AltArrowUp weight="BoldDuotone" className="h-4 w-4" />
            ) : (
              <AltArrowDown weight="BoldDuotone" className="h-4 w-4" />
            )}
            {allOpen ? "Tutup semua" : "Buka semua"}
          </Button>
        </div>
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
        expandedRows={expandedRows}
        onToggleRow={toggleRow}
        onOpenDetail={(b) => setDetailBooking(b)}
        onEditKeuangan={(b) => setFinanceTarget({ id: b.id, customerName: b.customerEvent })}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        canEditKeuangan={canEditKeuangan}
      />

      <ARDetailDrawer
        isOpen={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        booking={detailBooking}
      />

      {financeTarget && (
        <EditTopDrawerById
          isOpen={!!financeTarget}
          onClose={() => {
            setFinanceTarget(null);
            qc.invalidateQueries({ queryKey: ["ar-bookings"] });
          }}
          bookingId={financeTarget.id}
          customerName={financeTarget.customerName}
        />
      )}
    </div>
  );
}
