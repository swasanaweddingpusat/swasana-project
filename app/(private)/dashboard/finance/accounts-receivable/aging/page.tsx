"use client";

import { useMemo, useState } from "react";
import { useAR } from "@/hooks/use-ar";
import { ARFilterBar } from "../_components/ar-filter-bar";
import { ARAgingView } from "../_components/ar-aging-view";
import type { ARFilters } from "@/types/finance";

export default function AccountsReceivableAgingPage() {
  const { data: arResult, isLoading } = useAR();
  const [filters, setFilters] = useState<ARFilters>({});

  const bookings = useMemo(() => arResult?.data ?? [], [arResult?.data]);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-bold text-foreground">Aging Report</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} booking</span>
      </div>

      <ARFilterBar
        filters={filters}
        onFiltersChange={(f) => setFilters(f)}
        venues={venues}
        salesPics={salesPics}
        years={years}
      />

      <ARAgingView bookings={filtered} loading={isLoading} />
    </div>
  );
}
