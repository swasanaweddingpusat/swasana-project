"use client";

import { useMemo, useState } from "react";
import { AltArrowDown, AltArrowUp } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { ARFilterBar } from "../_components/ar-filter-bar";
import {
  TerminAccordion,
  groupByClient,
  useAccordionState,
} from "../_components/TerminAccordion";
import { useAR } from "@/hooks/use-ar";
import type { ARFilters } from "@/types/finance";

export default function AccountsReceivableTerminPage() {
  const { data: arResult, isLoading } = useAR();
  const bookings = useMemo(() => arResult?.data ?? [], [arResult?.data]);
  const [filters, setFilters] = useState<ARFilters>({});

  // Termin only lists bookings the client has approved → Confirmed status.
  const confirmed = useMemo(
    () => bookings.filter((b) => b.bookingStatus === "Confirmed"),
    [bookings],
  );

  const venues = useMemo(() => {
    const seen = new Map<string, string>();
    confirmed.forEach((b) => {
      if (b.venueId && b.namaEvent !== "-") seen.set(b.venueId, b.namaEvent);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [confirmed]);

  const salesPics = useMemo(() => {
    const seen = new Map<string, string>();
    confirmed.forEach((b) => {
      if (b.salesId && b.salesPicName !== "-") seen.set(b.salesId, b.salesPicName);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [confirmed]);

  const filtered = useMemo(() => {
    return confirmed.filter((b) => {
      if (filters.venue && b.venueId !== filters.venue) return false;
      if (filters.salesPic && b.salesId !== filters.salesPic) return false;
      if (filters.dateRange?.from && b.customerDate < filters.dateRange.from) return false;
      if (filters.dateRange?.to && b.customerDate > filters.dateRange.to) return false;
      // Status filters by the termin status inside the booking.
      if (filters.status && !b.termins.some((t) => t.status === filters.status)) return false;
      return true;
    });
  }, [confirmed, filters]);

  const groups = useMemo(() => groupByClient(filtered), [filtered]);
  const { openIds, toggle, expandAll, collapseAll, allOpen } = useAccordionState(groups);

  const totalTermin = useMemo(
    () => groups.reduce((s, g) => s + g.termins.length, 0),
    [groups],
  );

  return (
    <div className="flex flex-col gap-4 py-6 px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-base font-bold text-foreground">Termin</h1>
          <p className="text-xs text-muted-foreground">
            {groups.length} client · {totalTermin} termin
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={allOpen ? collapseAll : expandAll}
          disabled={groups.length === 0}
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

      <ARFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        venues={venues}
        salesPics={salesPics}
      />

      <TerminAccordion
        groups={groups}
        loading={isLoading}
        openIds={openIds}
        onToggle={toggle}
      />
    </div>
  );
}
