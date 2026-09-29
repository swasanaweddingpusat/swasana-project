"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "@solar-icons/react";
import { useGuestbookEntries } from "@/hooks/use-guestbook";
import { useVenues } from "@/hooks/use-venues";
import { useSalesUsers } from "@/hooks/use-sales-users";
import type { GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import { GuestbookOverviewCards } from "../../_components/GuestbookOverviewCards";
import { GuestbookFunnelReportSection } from "../../_components/GuestbookFunnelReportSection";
import { GuestbookFilterDrawer } from "../../_components/GuestbookFilterDrawer";

const EMPTY_OVERVIEW = {
  total: 0,
  doneVisit: 0,
  lost: 0,
  onlineMeetings: 0,
  deal: 0,
  byStatus: [],
  byCategory: [],
  bySource: [],
  byVenue: [],
  byHost: [],
  adsUrlBuckets: [],
  adsUrlOrganik: 0,
};

function todayRange(): DateRange {
  const today = new Date();
  return { from: today, to: today };
}

function toggleArrayValue<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function GuestbookOverviewClient() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [filterStatusIds, setFilterStatusIds] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<GuestbookCategoryFilter[]>([]);
  const [filterSourceIds, setFilterSourceIds] = useState<string[]>([]);
  const [filterVenueIds, setFilterVenueIds] = useState<string[]>([]);
  const [filterHostId, setFilterHostId] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: venues = [] } = useVenues();
  const { users: salesUsers } = useSalesUsers();
  const salesOptions = salesUsers.map((u) => ({ id: u.id, name: u.fullName ?? u.id }));

  // pageSize 1: this page only renders aggregate stats, so the paginated rows
  // are dead weight — the overview block is computed over the whole filter set.
  // dateField "createdAt": seluruh metrik Overview dihitung per tanggal input
  // sales, sama dengan kartu Database/Ads Performance. Tanpa ini angka Database
  // di dua blok tersebut tidak akan cocok karena beda kolom tanggal.
  const { data, isLoading } = useGuestbookEntries({
    page: 1,
    pageSize: 1,
    dateField: "createdAt",
    dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    statusIds: filterStatusIds.length > 0 ? filterStatusIds : undefined,
    categories: filterCategories.length > 0 ? filterCategories : undefined,
    sourceOfInformationIds: filterSourceIds.length > 0 ? filterSourceIds : undefined,
    venueIds: filterVenueIds.length > 0 ? filterVenueIds : undefined,
    hostId: filterHostId !== "all" ? filterHostId : undefined,
  });

  const activeFilterCount =
    filterStatusIds.length +
    filterCategories.length +
    filterSourceIds.length +
    filterVenueIds.length +
    (filterHostId !== "all" ? 1 : 0);

  function resetFilters() {
    setDateRange(todayRange());
    setFilterStatusIds([]);
    setFilterCategories([]);
    setFilterSourceIds([]);
    setFilterVenueIds([]);
    setFilterHostId("all");
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Overview Guestbook</h2>
            <p className="text-xs text-muted-foreground">
              Ringkasan kunjungan tamu. Klik kartu untuk mempersempit data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-full text-xs relative"
            onClick={() => setFilterOpen(true)}
          >
            <Filter weight="BoldDuotone" className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      <GuestbookFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        venueIds={filterVenueIds}
        onVenueIdsChange={setFilterVenueIds}
        hostId={filterHostId}
        onHostIdChange={setFilterHostId}
        categories={filterCategories}
        onCategoriesChange={setFilterCategories}
        statusIds={filterStatusIds}
        onStatusIdsChange={setFilterStatusIds}
        sourceOfInformationIds={filterSourceIds}
        onSourceOfInformationIdsChange={setFilterSourceIds}
        venues={venues}
        salesOptions={salesOptions}
        onReset={resetFilters}
      />

      {/* Ratio funnel jadi insight utama halaman, langsung setelah kontrol filter. */}
      <GuestbookFunnelReportSection
        dateRange={dateRange}
        venueIds={filterVenueIds}
        hostId={filterHostId !== "all" ? filterHostId : undefined}
        categories={filterCategories}
      />

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <GuestbookOverviewCards
          overview={data?.overview ?? EMPTY_OVERVIEW}
          activeStatuses={filterStatusIds}
          onStatusClick={(key) => setFilterStatusIds((p) => toggleArrayValue(p, key))}
          activeCategories={filterCategories}
          onCategoryClick={(key) => setFilterCategories((p) => toggleArrayValue(p, key as GuestbookCategoryFilter))}
          activeSourceIds={filterSourceIds}
          onSourceClick={(key) => setFilterSourceIds((p) => toggleArrayValue(p, key))}
          activeVenueIds={filterVenueIds}
          onVenueClick={(key) => setFilterVenueIds((p) => toggleArrayValue(p, key))}
          activeHostId={filterHostId !== "all" ? filterHostId : undefined}
          onHostClick={(key) => setFilterHostId((p) => (p === key ? "all" : key))}
        />
      )}
    </div>
  );
}
