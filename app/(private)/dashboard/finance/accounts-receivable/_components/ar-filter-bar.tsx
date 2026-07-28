"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  CalendarDate,
  CloseCircle,
  CheckCircle,
  AltArrowDown,
  Buildings,
  UsersGroupRounded,
  Magnifer,
  Filter,
  TagHorizontal,
} from "@solar-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { ARFilters, ARTerminStatus } from "@/types/finance";

interface ARFilterBarProps {
  filters: ARFilters;
  onFiltersChange: (filters: ARFilters) => void;
  venues?: { id: string; name: string }[];
  salesPics?: { id: string; name: string }[];
  /** Distinct event years present in the data, e.g. ["2026","2025"] (desc). */
  years?: string[];
}

/** Status options for the dropdown — excludes "all" (the dropdown renders its own "Semua Status" reset). */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "paid", label: "Lunas" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Aging" },
  { value: "unpaid", label: "Unpaid" },
  { value: "not_due_yet", label: "Not Due Yet" },
];

/** Zero-padded values so they compare directly against `customerDate.slice(5,7)`. */
const MONTHS: { value: string; label: string }[] = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

/** Parse a stored `yyyy-MM-dd` back to a local Date for the calendar. */
function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/* ─── Reusable filter dropdown (one shape for all secondary filters) ─────────── */

interface FilterOption {
  value: string;
  label: string;
}

/** Shared pill-trigger classes so every dropdown looks identical. */
function comboTriggerCls(active: boolean): string {
  return cn(
    "inline-flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
    active
      ? "border-primary/40 bg-primary/5 text-foreground"
      : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
  );
}

/**
 * One dropdown to rule them all — Popover + Solar chevron + left-aligned label,
 * so Status/Venue/Sales/Bulan/Tahun render identically (native <Select> would
 * force a lucide chevron and centered value we can't restyle).
 */
function FilterCombo({
  icon: Icon,
  allLabel,
  emptyLabel,
  value,
  options,
  onSelect,
  searchable = false,
}: {
  icon: typeof Filter;
  allLabel: string;
  emptyLabel?: string;
  value: string | undefined;
  options: FilterOption[];
  onSelect: (value: string) => void;
  searchable?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const active = !!value;
  const label = options.find((o) => o.value === value)?.label ?? allLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger role="combobox" aria-expanded={open} className={comboTriggerCls(active)}>
        <Icon weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 rotate-0!" />
        <span className="flex-1 truncate text-left">{label}</span>
        <AltArrowDown weight="BoldDuotone" className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder="Cari..." autoFocus />}
          <CommandList>
            <CommandEmpty>{emptyLabel ?? "Tidak ditemukan."}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => { onSelect(""); setOpen(false); }}
                className="cursor-pointer"
              >
                <CheckCircle weight="BoldDuotone" className={cn("mr-2 h-4 w-4 shrink-0", !active ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => { onSelect(o.value); setOpen(false); }}
                  className="cursor-pointer"
                >
                  <CheckCircle weight="BoldDuotone" className={cn("mr-2 h-4 w-4 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Secondary Filters Fragment ────────────────────────────────────────────── */

interface SecondaryFiltersProps {
  filters: ARFilters;
  setVenue: (v: string) => void;
  venues: { id: string; name: string }[];
  setSales: (v: string) => void;
  salesPics: { id: string; name: string }[];
  dateOpen: boolean;
  setDateOpen: (open: boolean) => void;
  dateLabel: string;
  dateActive: boolean;
  handleDateSelect: (date: Date | undefined) => void;
  setEventMonth: (v: string) => void;
  setEventYear: (v: string) => void;
  years: string[];
  onFiltersChange: (filters: ARFilters) => void;
  hasAny: boolean;
  reset: () => void;
}

function SecondaryFilters({
  filters,
  setVenue,
  venues,
  setSales,
  salesPics,
  dateOpen,
  setDateOpen,
  dateLabel,
  dateActive,
  handleDateSelect,
  setEventMonth,
  setEventYear,
  years,
  onFiltersChange,
  hasAny,
  reset,
}: SecondaryFiltersProps): React.ReactElement {
  return (
    <>
      {/* Venue */}
      {venues.length > 1 && (
        <FilterCombo
          icon={Buildings}
          allLabel="Semua Venue"
          emptyLabel="Venue tidak ditemukan."
          value={filters.venue}
          options={venues.map((v) => ({ value: v.id, label: v.name }))}
          onSelect={setVenue}
          searchable
        />
      )}

      {/* Sales PIC */}
      {salesPics.length > 1 && (
        <FilterCombo
          icon={UsersGroupRounded}
          allLabel="Semua Sales"
          emptyLabel="Sales tidak ditemukan."
          value={filters.salesPic}
          options={salesPics.map((s) => ({ value: s.id, label: s.name }))}
          onSelect={setSales}
          searchable
        />
      )}

      {/* Event date — exact single day. Picking one clears month/year. */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger className={comboTriggerCls(dateActive)}>
          <CalendarDate weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">{dateLabel}</span>
          <AltArrowDown weight="BoldDuotone" className={cn("h-3 w-3 shrink-0 transition-transform", dateOpen && "rotate-180")} />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.eventDate ? parseDate(filters.eventDate) : undefined}
            onSelect={handleDateSelect}
            numberOfMonths={1}
          />
          {dateActive && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => { onFiltersChange({ ...filters, eventDate: undefined }); setDateOpen(false); }}
                className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                Hapus tanggal
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Event month — combinable with year. Picking one clears exact date. */}
      <FilterCombo
        icon={CalendarDate}
        allLabel="Semua Bulan"
        value={filters.eventMonth}
        options={MONTHS}
        onSelect={setEventMonth}
      />

      {/* Event year — combinable with month. Picking one clears exact date. */}
      <FilterCombo
        icon={CalendarDate}
        allLabel="Semua Tahun"
        value={filters.eventYear}
        options={years.map((y) => ({ value: y, label: y }))}
        onSelect={setEventYear}
      />

      {/* Reset button */}
      {hasAny && (
        <button
          type="button"
          onClick={reset}
          title="Reset semua filter"
          className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
          Reset
        </button>
      )}
    </>
  );
}

/* ─── Main Export ────────────────────────────────────────────────────────────── */

export function ARFilterBar({ filters, onFiltersChange, venues = [], salesPics = [], years = [] }: ARFilterBarProps): React.ReactElement {
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Status lives inline as its own control now — the Filter dropdown only groups
  // the remaining secondary filters, so its badge/highlight excludes status.
  const hasSecondary = !!(filters.venue || filters.salesPic || filters.eventDate || filters.eventMonth || filters.eventYear);
  const hasAny = !!(filters.status || filters.search || hasSecondary);
  const secondaryCount = [
    filters.venue,
    filters.salesPic,
    filters.eventDate,
    filters.eventMonth,
    filters.eventYear,
  ].filter(Boolean).length;

  function setStatus(val: ARTerminStatus | "all"): void {
    onFiltersChange({ ...filters, status: val === "all" ? undefined : val });
  }

  function setVenue(v: string): void {
    onFiltersChange({ ...filters, venue: v || undefined });
  }

  function setSales(v: string): void {
    onFiltersChange({ ...filters, salesPic: v || undefined });
  }

  function setSearch(v: string): void {
    onFiltersChange({ ...filters, search: v || undefined });
  }

  // Exact date is mutually exclusive with month/year — a specific day already
  // pins the month and year, so keeping those set would only confuse.
  function handleDateSelect(date: Date | undefined): void {
    if (!date) {
      onFiltersChange({ ...filters, eventDate: undefined });
      return;
    }
    onFiltersChange({
      ...filters,
      eventDate: format(date, "yyyy-MM-dd"),
      eventMonth: undefined,
      eventYear: undefined,
    });
    setDateOpen(false);
  }

  function setEventMonth(v: string): void {
    onFiltersChange({ ...filters, eventMonth: v || undefined, eventDate: undefined });
  }

  function setEventYear(v: string): void {
    onFiltersChange({ ...filters, eventYear: v || undefined, eventDate: undefined });
  }

  function reset(): void {
    onFiltersChange({});
  }

  const dateLabel = filters.eventDate
    ? format(parseDate(filters.eventDate), "dd MMM yyyy")
    : "Tanggal Event";

  const dateActive = !!filters.eventDate;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Search by client — primary entry point, leads the toolbar */}
      <div className="relative w-full sm:w-60">
        <Magnifer
          weight="BoldDuotone"
          className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          inputMode="search"
          value={filters.search ?? ""}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari client atau event..."
          className={cn(
            "h-8 w-full rounded-full border border-border bg-transparent pr-8 pl-8 text-xs text-foreground transition-colors outline-none placeholder:text-muted-foreground",
            "focus:border-primary/40 focus:bg-primary/5",
          )}
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Hapus pencarian"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-destructive"
          >
            <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Status — standalone dropdown, primary lens for the table */}
      <div className="w-40">
        <FilterCombo
          icon={TagHorizontal}
          allLabel="Semua Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          onSelect={(v) => setStatus((v || "all") as ARTerminStatus | "all")}
        />
      </div>

      {/* Remaining secondary filters grouped under one Filter dropdown */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
            hasSecondary
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Filter weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
          Filter
          {secondaryCount > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {secondaryCount}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="flex flex-col gap-2">
            <SecondaryFilters
              filters={filters}
              setVenue={setVenue}
              venues={venues}
              setSales={setSales}
              salesPics={salesPics}
              dateOpen={dateOpen}
              setDateOpen={setDateOpen}
              dateLabel={dateLabel}
              dateActive={dateActive}
              handleDateSelect={handleDateSelect}
              setEventMonth={setEventMonth}
              setEventYear={setEventYear}
              years={years}
              onFiltersChange={onFiltersChange}
              hasAny={hasAny}
              reset={reset}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
