"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDate, Restart } from "@solar-icons/react";
import { useGuestbookEntries } from "@/hooks/use-guestbook";
import type { GuestbookCategoryFilter } from "@/lib/queries/guestbookEntries";
import { GuestbookOverviewCards } from "../../_components/GuestbookOverviewCards";
import { GuestbookFunnelReportSection } from "../../_components/GuestbookFunnelReportSection";

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

// Dropdown kategori hanya menawarkan pilihan tunggal (atau semua). Filter
// kategori sendiri tetap berupa array karena kartu "Kategori Event" bisa
// mengaktifkan lebih dari satu lewat klik.
const CATEGORY_OPTIONS = [
  { value: "WEDDINGS", label: "Wedding" },
  { value: "MICE", label: "MICE" },
] as const;

export function GuestbookOverviewClient() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(todayRange);
  const [filterStatusIds, setFilterStatusIds] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<GuestbookCategoryFilter[]>([]);
  const [filterSourceIds, setFilterSourceIds] = useState<string[]>([]);
  const [filterVenueIds, setFilterVenueIds] = useState<string[]>([]);
  const [filterHostId, setFilterHostId] = useState<string>("all");

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

  // Dropdown hanya bisa mewakili satu kategori. Kalau kartu "Kategori Event"
  // mengaktifkan kombinasi lain (mis. dua kategori sekaligus, atau "no_package"),
  // dropdown jatuh ke "all" agar tidak menampilkan label yang menyesatkan.
  const categorySelectValue =
    filterCategories.length === 1 &&
    CATEGORY_OPTIONS.some((opt) => opt.value === filterCategories[0])
      ? filterCategories[0]
      : "all";

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
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={categorySelectValue}
              onValueChange={(v) =>
                setFilterCategories(v === "all" ? [] : [v as GuestbookCategoryFilter])
              }
            >
              <SelectTrigger className="h-8 w-[130px] rounded-xl text-xs">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
