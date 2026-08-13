"use client";

import { CloseCircle, Magnifer } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AP_CATEGORY_OPTIONS } from "./ap-format";
import type { APAckStatus, APCategory, APFilters, APStatus } from "@/types/finance";

interface ApFilterBarProps {
  filters: APFilters;
  onFiltersChange: (filters: APFilters) => void;
  /** Hide the category select on views that are already scoped to one category. */
  showCategory?: boolean;
}

const STATUS_OPTIONS: { value: APStatus; label: string }[] = [
  { value: "unpaid", label: "Belum Dibayar" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Lunas" },
  { value: "on_hold", label: "On Hold" },
];

const ACK_OPTIONS: { value: APAckStatus; label: string }[] = [
  { value: "pending", label: "Pending Ack" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "rejected", label: "Rejected" },
];

export function ApFilterBar({ filters, onFiltersChange, showCategory = true }: ApFilterBarProps) {
  const activeCount = [
    showCategory ? filters.category : undefined,
    filters.status,
    filters.ack,
    filters.search,
  ].filter(Boolean).length;

  const update = (key: keyof APFilters, value: unknown) =>
    onFiltersChange({ ...filters, [key]: value || undefined });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Magnifer
          weight="BoldDuotone"
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={filters.search ?? ""}
          onChange={(e) => update("search", e.target.value)}
          placeholder="Cari payee / keterangan"
          className="h-8 w-56 rounded-full pl-8 text-xs"
        />
      </div>

      {showCategory && (
        <Select value={filters.category ?? ""} onValueChange={(v) => update("category", v as APCategory)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Kategori" /></SelectTrigger>
          <SelectContent>
            {AP_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.status ?? ""} onValueChange={(v) => update("status", v as APStatus)}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.ack ?? ""} onValueChange={(v) => update("ack", v as APAckStatus)}>
        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Ack" /></SelectTrigger>
        <SelectContent>
          {ACK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {activeCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">{activeCount} filter</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onFiltersChange({})}
          >
            <CloseCircle weight="BoldDuotone" className="mr-1 size-3.5" /> Reset
          </Button>
        </div>
      )}
    </div>
  );
}
