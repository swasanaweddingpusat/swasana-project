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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AddCircle,
  Magnifer,
  List,
  Widget,
  Refresh,
  Filter,
  HandShake,
  CloseCircle,
  UsersGroupRounded,
} from "@solar-icons/react";
import { useVenues } from "@/hooks/use-venues";
import { useEventTypes } from "@/hooks/use-event-types";
import { cn } from "@/lib/utils";
import type { LeadScope } from "@/lib/validations/lead";

export type ViewMode = "list" | "pipeline";

interface StatusCount {
  id: string;
  name: string;
  color: string;
}

interface LeadsFiltersProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  scope: LeadScope;
  onScopeChange: (scope: LeadScope) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  venueFilter: string;
  onVenueChange: (value: string) => void;
  eventTypeFilter: string;
  onEventTypeChange: (value: string) => void;
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

const SCOPE_TABS: { value: LeadScope; label: string; icon: React.ElementType }[] = [
  { value: "active", label: "Active", icon: UsersGroupRounded },
  { value: "deal", label: "Deal", icon: HandShake },
  { value: "lost", label: "Lost", icon: CloseCircle },
];

export function LeadsFilters({
  viewMode,
  onViewModeChange,
  scope,
  onScopeChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  venueFilter,
  onVenueChange,
  eventTypeFilter,
  onEventTypeChange,
  statusCounts,
  totalFiltered,
  onAdd,
  onRefresh,
  isRefreshing,
}: LeadsFiltersProps) {
  const { data: venues = [] } = useVenues();
  const { data: eventTypes = [] } = useEventTypes();

  // Only count active (non-"all") filters — statusId irrelevant in deal/lost scope
  const activeCount =
    (venueFilter !== "all" ? 1 : 0) +
    (scope === "active" && statusFilter !== "all" ? 1 : 0) +
    (eventTypeFilter !== "all" ? 1 : 0);
  const hasActive = activeCount > 0;

  function handleReset() {
    onVenueChange("all");
    onStatusChange("all");
    onEventTypeChange("all");
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-4 sm:px-6 py-3 border-b">
      {/* GROUP 1: Scope tabs + View toggle + Count badge */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Scope segmented control — Active / Deal / Lost */}
        <div
          role="tablist"
          aria-label="Lead scope"
          className="flex items-center rounded-lg border border-border p-0.5"
        >
          {SCOPE_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => onScopeChange(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                scope === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon weight="BoldDuotone" aria-hidden="true" className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
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

        {/* Count badge */}
        <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full">
          {totalFiltered} leads
        </span>
      </div>

      {/* DIVIDER — visible on lg+ only, hidden when toolbar wraps */}
      <div className="hidden lg:block w-px h-5 bg-border shrink-0" aria-hidden="true" />

      {/* GROUP 2 + CTA: Refresh + Filter + Search | Tambah Lead pushed right */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {/* Refresh button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Muat ulang data lead"
          title="Muat ulang"
          className="shrink-0"
        >
          <Refresh
            weight="BoldDuotone"
            aria-hidden="true"
            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
          />
        </Button>

        {/* Filter popover */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className={cn("h-9 gap-1.5 relative shrink-0", hasActive && "border-primary/50")}
                aria-label="Filter leads"
              >
                <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                Filter
                {hasActive && (
                  <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-72 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Filter</p>
              {hasActive && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Venue filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Venue</label>
              <Select value={venueFilter} onValueChange={onVenueChange}>
                <SelectTrigger className="h-9 w-full text-sm" aria-label="Filter venue lead">
                  <SelectValue placeholder="Semua Venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter — only shown in active scope */}
            {scope === "active" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={onStatusChange}>
                  <SelectTrigger className="h-9 w-full text-sm" aria-label="Filter status lead">
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
              </div>
            )}

            {/* Event Type filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Event Type</label>
              <Select value={eventTypeFilter} onValueChange={onEventTypeChange}>
                <SelectTrigger className="h-9 w-full text-sm" aria-label="Filter event type lead">
                  <SelectValue placeholder="Semua Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Event Type</SelectItem>
                  {eventTypes.map((et) => (
                    <SelectItem key={et.id} value={et.id}>
                      <span className="flex items-center gap-2">
                        {et.name}
                        <span className="text-[10px] text-muted-foreground">
                          {et.category === "MICE" ? "MICE" : "Wedding"}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        {/* Search */}
        <div className="relative min-w-0 w-full sm:w-auto sm:flex-none">
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
            className="pl-9 w-full sm:w-48"
          />
        </div>

        {/* Tambah Lead — pushed to far right via ml-auto */}
        <Button onClick={onAdd} className="ml-auto shrink-0">
          <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
          Tambah Lead
        </Button>
      </div>
    </div>
  );
}
