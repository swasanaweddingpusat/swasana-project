"use client";

import { X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import type { ARFilters, ARInvoiceStatus } from "@/types/finance";

interface ARFilterBarProps {
  filters: ARFilters;
  onFiltersChange: (filters: ARFilters) => void;
  venues?: { id: string; name: string }[];
  salesPics?: { id: string; name: string }[];
}

const STATUS_OPTIONS: { value: ARInvoiceStatus; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
  { value: "unissued", label: "Unissued" },
  { value: "generated", label: "Generated" },
];

export function ARFilterBar({ filters, onFiltersChange, venues = [], salesPics = [] }: ARFilterBarProps) {
  const activeCount = [filters.status, filters.venue, filters.salesPic, filters.dateRange].filter(Boolean).length;

  const update = (key: keyof ARFilters, value: unknown) =>
    onFiltersChange({ ...filters, [key]: value || undefined });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filters.status ?? ""} onValueChange={(v) => update("status", v as ARInvoiceStatus)}>
        <SelectTrigger className="w-35 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {venues.length > 0 && (
        <Select value={filters.venue ?? ""} onValueChange={(v) => update("venue", v)}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Venue" /></SelectTrigger>
          <SelectContent>
            {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {salesPics.length > 0 && (
        <Select value={filters.salesPic ?? ""} onValueChange={(v) => update("salesPic", v)}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Sales PIC" /></SelectTrigger>
          <SelectContent>
            {salesPics.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Popover>
        <PopoverTrigger>
          <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            {filters.dateRange?.from ? format(new Date(filters.dateRange.from), "dd MMM") : "From"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single"
            selected={filters.dateRange?.from ? new Date(filters.dateRange.from) : undefined}
            onSelect={(d) => d && update("dateRange", { from: format(d, "yyyy-MM-dd"), to: filters.dateRange?.to ?? format(d, "yyyy-MM-dd") })}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger>
          <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
            {filters.dateRange?.to ? format(new Date(filters.dateRange.to), "dd MMM") : "To"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single"
            selected={filters.dateRange?.to ? new Date(filters.dateRange.to) : undefined}
            onSelect={(d) => d && update("dateRange", { from: filters.dateRange?.from ?? format(d, "yyyy-MM-dd"), to: format(d, "yyyy-MM-dd") })}
          />
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">{activeCount} filter</Badge>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onFiltersChange({})}>
            <X className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        </div>
      )}
    </div>
  );
}
