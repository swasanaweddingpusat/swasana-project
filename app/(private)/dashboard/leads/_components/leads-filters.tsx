"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AddCircle,
  Magnifer,
  List,
  Widget,
  Refresh,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "pipeline";

interface StatusCount {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface LeadsFiltersProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusCounts: StatusCount[];
  totalFiltered: number;
  onAdd: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

function StatusDot({
  color,
  selected,
}: {
  color: string;
  selected?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block w-2 h-2 rounded-full shrink-0")}
      style={{ backgroundColor: selected ? undefined : color }}
    />
  );
}

export function LeadsFilters({
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  statusCounts,
  totalFiltered,
  onAdd,
  onRefresh,
  isRefreshing,
}: LeadsFiltersProps) {
  return (
    <>
      {/* Header row */}
      <div className="flex flex-col gap-3 px-4 sm:px-6 pb-4 border-b sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* View mode toggle — Pipeline button hidden on mobile (<sm) */}
          <div
            role="tablist"
            aria-label="View mode"
            className="flex items-center rounded-lg border border-border p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "list"}
              onClick={() => onViewModeChange("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List weight="BoldDuotone" aria-hidden="true" className="size-3.5" />
              List
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "pipeline"}
              onClick={() => onViewModeChange("pipeline")}
              className={cn(
                "hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                viewMode === "pipeline"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Widget weight="BoldDuotone" aria-hidden="true" className="size-3.5" />
              Pipeline
            </button>
          </div>
          <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full">
            {totalFiltered} leads
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger
              className="h-9 w-full sm:w-40 text-sm"
              aria-label="Filter status lead"
            >
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {statusCounts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <StatusDot color={s.color} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Magnifer
              weight="BoldDuotone"
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Cari lead"
              placeholder="Cari lead..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-full sm:w-52"
            />
          </div>

          {/* Refresh button — icon only */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Muat ulang data lead"
            title="Muat ulang"
          >
            <Refresh
              weight="BoldDuotone"
              aria-hidden="true"
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </Button>

          {/* Add button */}
          <Button onClick={onAdd}>
            <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
            Tambah Lead
          </Button>
        </div>
      </div>
    </>
  );
}
