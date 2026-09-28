"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDate, Restart } from "@solar-icons/react";
import { useGuestbookEntries } from "@/hooks/use-guestbook";
import type { GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import type { GuestVisitStatus } from "@prisma/client";
import { GuestbookOverviewCards } from "../../_components/GuestbookOverviewCards";

const EMPTY_OVERVIEW = {
  total: 0,
  doneVisit: 0,
  lost: 0,
  onlineMeetings: 0,
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

// Label for the date-range Popover trigger, e.g. "12 Agu – 15 Agu 2026".
function formatDateRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Pilih tanggal";
  const from = format(range.from, "d MMM yyyy", { locale: idLocale });
  if (!range.to) return from;
  const to = format(range.to, "d MMM yyyy", { locale: idLocale });
  return from === to ? from : `${from} – ${to}`;
}

function toggleArrayValue<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function GuestbookOverviewClient() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [filterStatuses, setFilterStatuses] = useState<GuestVisitStatus[]>([]);
  const [filterCategories, setFilterCategories] = useState<GuestbookCategoryFilter[]>([]);
  const [filterSourceIds, setFilterSourceIds] = useState<string[]>([]);
  const [filterVenueIds, setFilterVenueIds] = useState<string[]>([]);
  const [filterHostId, setFilterHostId] = useState<string>("all");

  // pageSize 1: this page only renders aggregate stats, so the paginated rows
  // are dead weight — the overview block is computed over the whole filter set.
  const { data, isLoading } = useGuestbookEntries({
    page: 1,
    pageSize: 1,
    dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    statuses: filterStatuses.length > 0 ? filterStatuses : undefined,
    categories: filterCategories.length > 0 ? filterCategories : undefined,
    sourceOfInformationIds: filterSourceIds.length > 0 ? filterSourceIds : undefined,
    venueIds: filterVenueIds.length > 0 ? filterVenueIds : undefined,
    hostId: filterHostId !== "all" ? filterHostId : undefined,
  });

  const activeFilterCount =
    filterStatuses.length +
    filterCategories.length +
    filterSourceIds.length +
    filterVenueIds.length +
    (filterHostId !== "all" ? 1 : 0);

  function resetFilters() {
    setDateRange(todayRange());
    setFilterStatuses([]);
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
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger className="flex h-8 items-center gap-2 rounded-xl border bg-background px-3 text-xs">
                <span className="truncate">{formatDateRangeLabel(dateRange)}</span>
                <CalendarDate weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="range" numberOfMonths={2} selected={dateRange} onSelect={setDateRange} autoFocus />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs"
              onClick={resetFilters}
              disabled={activeFilterCount === 0 && !dateRange?.from}
            >
              <Restart weight="BoldDuotone" className="mr-1.5 h-3.5 w-3.5" />
              Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
          activeStatuses={filterStatuses}
          onStatusClick={(key) => setFilterStatuses((p) => toggleArrayValue(p, key as GuestVisitStatus))}
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
