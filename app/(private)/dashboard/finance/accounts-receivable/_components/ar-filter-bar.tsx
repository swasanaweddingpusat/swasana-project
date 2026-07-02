"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  CalendarDate,
  CloseCircle,
  CheckCircle,
  AltArrowDown,
  Buildings,
  UsersGroupRounded,
  Magnifer,
  Filter,
} from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
}

const STATUS_CHIPS: { value: ARTerminStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "paid", label: "Lunas" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Aging" },
  { value: "unpaid", label: "Unpaid" },
  { value: "not_due_yet", label: "Not Due Yet" },
];

function fmt(iso: string) {
  return format(new Date(iso), "dd MMM");
}

export function ARFilterBar({ filters, onFiltersChange, venues = [], salesPics = [] }: ARFilterBarProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const activeStatus = filters.status ?? "all";
  const selectedSales = salesPics.find((s) => s.id === filters.salesPic);
  const hasSecondary = !!(filters.venue || filters.salesPic || filters.dateRange);
  const hasAny = !!(filters.status || filters.search || hasSecondary);

  const rangeSelected: DateRange | undefined = filters.dateRange
    ? {
        from: filters.dateRange.from ? new Date(filters.dateRange.from) : undefined,
        to: filters.dateRange.to ? new Date(filters.dateRange.to) : undefined,
      }
    : undefined;

  function setStatus(val: ARTerminStatus | "all") {
    onFiltersChange({ ...filters, status: val === "all" ? undefined : val });
  }

  function setVenue(v: string) {
    onFiltersChange({ ...filters, venue: v || undefined });
  }

  function setSales(v: string) {
    onFiltersChange({ ...filters, salesPic: v || undefined });
  }

  function setSearch(v: string) {
    onFiltersChange({ ...filters, search: v || undefined });
  }

  function handleRangeSelect(range: DateRange | undefined) {
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

  function reset() {
    onFiltersChange({});
  }

  const dateLabel =
    filters.dateRange?.from && filters.dateRange?.to
      ? `${fmt(filters.dateRange.from)} – ${fmt(filters.dateRange.to)}`
      : filters.dateRange?.from
        ? `Ab ${fmt(filters.dateRange.from)}`
        : "Tanggal Event";

  const dateActive = !!(filters.dateRange?.from || filters.dateRange?.to);

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

      {/* Status — dropdown chip, in line with the other scope filters */}
      <Select
        value={activeStatus}
        onValueChange={(v) => setStatus(v as ARTerminStatus | "all")}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            "h-8 min-w-36 max-w-48 gap-1.5 rounded-full border-border px-3.5 text-xs font-medium",
            filters.status
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "text-muted-foreground",
          )}
        >
          <Filter weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 rotate-0!" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_CHIPS.map((chip) => (
            <SelectItem key={chip.value} value={chip.value}>{chip.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Scope chips — same h-8 rounded-full family, each with a leading icon */}
      {venues.length > 1 && (
        <Select value={filters.venue ?? "_all"} onValueChange={(v) => setVenue(v === "_all" ? "" : v)}>
          <SelectTrigger
            size="sm"
            className={cn(
              "h-8 min-w-36 max-w-48 gap-1.5 rounded-full border-border px-3.5 text-xs font-medium",
              filters.venue
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "text-muted-foreground",
            )}
          >
            <Buildings weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0 rotate-0!" />
            <SelectValue placeholder="Venue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Semua Venue</SelectItem>
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {salesPics.length > 1 && (
        <Popover open={salesOpen} onOpenChange={setSalesOpen}>
          <PopoverTrigger
            role="combobox"
            aria-expanded={salesOpen}
            className={cn(
              "inline-flex h-8 max-w-48 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
              filters.salesPic
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <UsersGroupRounded weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{selectedSales?.name ?? "Semua Sales"}</span>
            <AltArrowDown weight="BoldDuotone" className={cn("h-3 w-3 shrink-0 transition-transform", salesOpen && "rotate-180")} />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Cari sales..." autoFocus />
              <CommandList>
                <CommandEmpty>Sales tidak ditemukan.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="Semua Sales"
                    onSelect={() => { setSales(""); setSalesOpen(false); }}
                    className="cursor-pointer"
                  >
                    <CheckCircle
                      weight="BoldDuotone"
                      className={cn("mr-2 h-4 w-4 shrink-0", !filters.salesPic ? "opacity-100" : "opacity-0")}
                    />
                    Semua Sales
                  </CommandItem>
                  {salesPics.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.name}
                      onSelect={() => { setSales(s.id); setSalesOpen(false); }}
                      className="cursor-pointer"
                    >
                      <CheckCircle
                        weight="BoldDuotone"
                        className={cn("mr-2 h-4 w-4 shrink-0", filters.salesPic === s.id ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex-1 truncate">{s.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
            dateActive
              ? "border-primary/40 bg-primary/5 text-foreground"
              : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <CalendarDate weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
          {dateLabel}
          <AltArrowDown weight="BoldDuotone" className={cn("h-3 w-3 shrink-0 transition-transform", dateOpen && "rotate-180")} />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={rangeSelected}
            onSelect={handleRangeSelect}
            numberOfMonths={1}
          />
          {dateActive && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => { onFiltersChange({ ...filters, dateRange: undefined }); setDateOpen(false); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                Hapus rentang tanggal
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {hasAny && (
        <button
          type="button"
          onClick={reset}
          title="Reset semua filter"
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
          Reset
        </button>
      )}
    </div>
  );
}
