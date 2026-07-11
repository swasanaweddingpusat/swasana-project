"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { AltArrowDown, CalendarDate, CloseCircle, Filter, Magnifer } from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { LEDGER_ENTRY_TYPE_META } from "./ledger-format";
import type { LedgerEntryType, LedgerFilters } from "@/types/finance";

interface LedgerFilterBarProps {
  filters: LedgerFilters;
  onFiltersChange: (filters: LedgerFilters) => void;
}

const ENTRY_TYPE_OPTIONS: { value: LedgerEntryType | "all"; label: string }[] = [
  { value: "all", label: "Semua Jenis" },
  ...(Object.keys(LEDGER_ENTRY_TYPE_META) as LedgerEntryType[]).map((value) => ({
    value,
    label: LEDGER_ENTRY_TYPE_META[value].label,
  })),
];

function fmt(iso: string): string {
  return format(new Date(iso), "dd MMM");
}

export function LedgerFilterBar({ filters, onFiltersChange }: LedgerFilterBarProps): React.ReactElement {
  const [dateOpen, setDateOpen] = useState(false);

  const hasDateRange = !!(filters.dateRange?.from || filters.dateRange?.to);
  const activeCount = [filters.entryType, filters.search].filter(Boolean).length + (hasDateRange ? 1 : 0);

  const rangeSelected: DateRange | undefined = filters.dateRange
    ? {
        from: filters.dateRange.from ? new Date(filters.dateRange.from) : undefined,
        to: filters.dateRange.to ? new Date(filters.dateRange.to) : undefined,
      }
    : undefined;

  function setEntryType(v: LedgerEntryType | "all"): void {
    onFiltersChange({ ...filters, entryType: v === "all" ? undefined : v });
  }

  function setSearch(v: string): void {
    onFiltersChange({ ...filters, search: v || undefined });
  }

  function handleRangeSelect(range: DateRange | undefined): void {
    if (!range) {
      onFiltersChange({ ...filters, dateRange: undefined });
      return;
    }
    onFiltersChange({
      ...filters,
      dateRange: {
        from: range.from ? format(range.from, "yyyy-MM-dd") : undefined,
        to: range.to ? format(range.to, "yyyy-MM-dd") : undefined,
      },
    });
    if (range.from && range.to) setDateOpen(false);
  }

  function clearDateRange(): void {
    onFiltersChange({ ...filters, dateRange: undefined });
    setDateOpen(false);
  }

  const dateLabel =
    filters.dateRange?.from && filters.dateRange?.to
      ? `${fmt(filters.dateRange.from)} – ${fmt(filters.dateRange.to)}`
      : filters.dateRange?.from
        ? `Dari ${fmt(filters.dateRange.from)}`
        : "Periode";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Search ── */}
      <div className="relative w-full sm:w-64 sm:max-w-xs">
        <Magnifer
          weight="BoldDuotone"
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          inputMode="search"
          value={filters.search ?? ""}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari client / kwitansi"
          className={cn(
            "h-8 w-full rounded-full border border-border bg-transparent pl-8 pr-8 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground",
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
            <CloseCircle weight="BoldDuotone" className="size-3.5" />
          </button>
        )}
      </div>

      {/* ── Entry type dropdown ── */}
      <Select
        value={filters.entryType ?? "all"}
        onValueChange={(v) => setEntryType(v as LedgerEntryType | "all")}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            "h-8 min-w-36 max-w-48 gap-1.5 rounded-full border-border px-3.5 text-xs font-medium",
            filters.entryType
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "text-muted-foreground",
          )}
        >
          <Filter weight="BoldDuotone" className="size-3.5 shrink-0 rotate-0!" />
          <SelectValue placeholder="Jenis Transaksi" />
        </SelectTrigger>
        <SelectContent>
          {ENTRY_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ── Periode (date range) ── */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
            hasDateRange
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <CalendarDate weight="BoldDuotone" className="size-3.5 shrink-0" />
          {dateLabel}
          <AltArrowDown
            weight="BoldDuotone"
            className={cn("size-3 shrink-0 transition-transform", dateOpen && "rotate-180")}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={rangeSelected}
            onSelect={handleRangeSelect}
            numberOfMonths={1}
          />
          {hasDateRange && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={clearDateRange}
                className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                Hapus rentang tanggal
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* ── Reset ── */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {activeCount} filter
          </span>
          <button
            type="button"
            onClick={() => onFiltersChange({})}
            aria-label="Reset semua filter"
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <CloseCircle weight="BoldDuotone" className="size-3.5" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
