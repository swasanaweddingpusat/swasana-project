"use client";

import { useMemo, useState } from "react";
import { AltArrowDown, AltArrowUp } from "@solar-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ARFilterBar } from "./_components/ar-filter-bar";
import { ARTable } from "./_components/ar-table";
import { ARDetailDrawer } from "./_components/ar-detail-drawer";
import { ARTerminSummary } from "./_components/ar-termin-summary";
import { EditTopDrawerById } from "@/app/(private)/dashboard/booking-weddings/_components/edit-top-drawer";
import { useAR } from "@/hooks/use-ar";
import { usePermissions } from "@/hooks/use-permissions";
import type { ARBooking, ARFilters } from "@/types/finance";

const ROWS_PER_PAGE = 10;

export default function AccountsReceivablePage() {
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

  // Bulk "Akui Pendapatan" — client-level, all-at-once. Pure UI state (preview),
  // no backend/ledger call yet. Resets on refresh by design.
  const [recognizedIds, setRecognizedIds] = useState<Set<string>>(new Set());

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

  // Distinct event years present, newest first — feeds the year filter dropdown.
  const years = useMemo(() => {
    const seen = new Set<string>();
    bookings.forEach((b) => {
      if (b.customerDate) seen.add(b.customerDate.slice(0, 4));
    });
    return Array.from(seen).sort((a, b) => b.localeCompare(a));
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = filters.search?.trim().toLowerCase();
    return bookings.filter((b) => {
      if (filters.status && b.statusTermin !== filters.status) return false;
      if (filters.venue && b.venueId !== filters.venue) return false;
      if (filters.salesPic && b.salesId !== filters.salesPic) return false;
      if (filters.eventDate && b.customerDate.slice(0, 10) !== filters.eventDate) return false;
      if (filters.eventMonth && b.customerDate.slice(5, 7) !== filters.eventMonth) return false;
      if (filters.eventYear && b.customerDate.slice(0, 4) !== filters.eventYear) return false;
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

  function handleRecognize(booking: ARBooking) {
    setRecognizedIds((prev) => {
      const next = new Set(prev);
      next.add(booking.id);
      return next;
    });
    toast.success(`Pendapatan ${booking.customerEvent} diakui (preview)`);
  }

  function handleUndoRecognize(booking: ARBooking) {
    setRecognizedIds((prev) => {
      const next = new Set(prev);
      next.delete(booking.id);
      return next;
    });
    toast.success(`Pengakuan pendapatan ${booking.customerEvent} dibatalkan (preview)`);
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ARFilterBar
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setCurrentPage(1); }}
        venues={venues}
        salesPics={salesPics}
        years={years}
      />
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
  );

  return (
    <div className="flex flex-col gap-4">
      <ARTerminSummary bookings={filtered} />

      <ARTable
        bookings={paginated}
        loading={isLoading}
        toolbar={toolbar}
        expandedRows={expandedRows}
        onToggleRow={toggleRow}
        onOpenDetail={(b) => setDetailBooking(b)}
        onEditKeuangan={(b) => setFinanceTarget({ id: b.id, customerName: b.customerEvent })}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        canEditKeuangan={canEditKeuangan}
        onRecognize={handleRecognize}
        onUndoRecognize={handleUndoRecognize}
        recognizedIds={recognizedIds}
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
