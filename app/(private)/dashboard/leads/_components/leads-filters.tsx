"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
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


const SCOPE_TABS: { value: LeadScope; label: string; icon: React.ElementType }[] = [
  { value: "active", label: "Active", icon: UsersGroupRounded },
  { value: "deal", label: "Deal", icon: HandShake },
  { value: "lost", label: "Lost", icon: CloseCircle },
];

// ─── Scope segmented control (shared between mobile & desktop) ────────────────

function ScopeTabs({
  scope,
  onScopeChange,
}: {
  scope: LeadScope;
  onScopeChange: (s: LeadScope) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Lead scope"
      className="flex items-center rounded-xl border border-border p-0.5"
    >
      {SCOPE_TABS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={scope === value}
          onClick={() => onScopeChange(value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
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
  );
}

interface Venue { id: string; name: string; }
interface EventType { id: string; name: string; category: string; }

// ─── Filter popover content (reused by mobile & desktop popover) ──────────────

function FilterPanelContent({
  scope,
  statusFilter,
  onStatusChange,
  venueFilter,
  onVenueChange,
  eventTypeFilter,
  onEventTypeChange,
  statusCounts,
  venues,
  eventTypes,
  hasActive,
  onReset,
}: {
  scope: LeadScope;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  venueFilter: string;
  onVenueChange: (v: string) => void;
  eventTypeFilter: string;
  onEventTypeChange: (v: string) => void;
  statusCounts: StatusCount[];
  venues: Venue[];
  eventTypes: EventType[];
  hasActive: boolean;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Filter</p>
        {hasActive && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Venue filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Venue</label>
        <SearchableSelect
          options={[
            { id: "all", name: "Semua Venue" },
            ...venues.map((v) => ({ id: v.id, name: v.name })),
          ]}
          value={venueFilter}
          onChange={onVenueChange}
          placeholder="Semua Venue"
          searchPlaceholder="Cari venue..."
          emptyText="Venue tidak ditemukan"
          className="h-9"
        />
      </div>

      {/* Status filter — only shown in active scope */}
      {scope === "active" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <SearchableSelect
            options={[
              { id: "all", name: "Semua Status" },
              ...statusCounts.map((s) => ({ id: s.id, name: s.name })),
            ]}
            value={statusFilter}
            onChange={onStatusChange}
            placeholder="Semua Status"
            searchPlaceholder="Cari status..."
            emptyText="Status tidak ditemukan"
            className="h-9"
          />
        </div>
      )}

      {/* Event Type filter */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Event Type</label>
        <SearchableSelect
          options={[
            { id: "all", name: "Semua Event Type" },
            ...eventTypes.map((et) => ({
              id: et.id,
              name: et.name,
              badge: et.category === "MICE" ? "MICE" : "Wedding",
            })),
          ]}
          value={eventTypeFilter}
          onChange={onEventTypeChange}
          placeholder="Semua Event Type"
          searchPlaceholder="Cari event type..."
          emptyText="Event type tidak ditemukan"
          className="h-9"
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // ── Shared filter badge indicator ──
  const FilterBadge = hasActive ? (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
      {activeCount}
    </span>
  ) : null;

  // ── Shared filter popover button ──
  const FilterPopoverButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("shrink-0 relative", hasActive && "border-primary/50")}
      aria-label="Filter leads"
    >
      <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
      {hasActive && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground leading-none">
          {activeCount}
        </span>
      )}
    </Button>
  );

  return (
    <div className="border-b">
      {/* ════════════════════════════════════════════════════════════════
          MOBILE TOOLBAR  (visible < sm)
          Row 1: [scope tabs] ──── [filter icon] [refresh icon] [add button]
          Row 2: [search full-width]
      ════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-2 px-4 pb-3 sm:hidden">
        {/* Row 1 */}
        <div className="flex items-center gap-2">
          {/* Scope tabs — shrink to fit, no label on small */}
          <ScopeTabs scope={scope} onScopeChange={onScopeChange} />

          {/* Count badge */}
          <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 border border-border rounded-full shrink-0">
            {totalFiltered}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Filter popover */}
          <Popover>
            <PopoverTrigger render={FilterPopoverButton} />
            <PopoverContent align="end" className="w-72 p-3">
              <FilterPanelContent
                scope={scope}
                statusFilter={statusFilter}
                onStatusChange={onStatusChange}
                venueFilter={venueFilter}
                onVenueChange={onVenueChange}
                eventTypeFilter={eventTypeFilter}
                onEventTypeChange={onEventTypeChange}
                statusCounts={statusCounts}
                venues={venues}
                eventTypes={eventTypes}
                hasActive={hasActive}
                onReset={handleReset}
              />
            </PopoverContent>
          </Popover>

          {/* Refresh */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Muat ulang data lead"
            className="shrink-0"
          >
            <Refresh
              weight="BoldDuotone"
              aria-hidden="true"
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </Button>

          {/* Add */}
          <Button onClick={onAdd} size="icon" className="shrink-0" aria-label="Tambah lead">
            <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>

        {/* Row 2: Search full-width */}
        <div className="relative w-full">
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
            className="pl-9 w-full"
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP TOOLBAR  (visible sm+)
          Single row: [scope tabs] [view toggle] [count] | [refresh] [filter] [search] →→ [add]
      ════════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:flex items-center gap-2 px-6 pb-3">
        {/* Scope segmented control */}
        <ScopeTabs scope={scope} onScopeChange={onScopeChange} />

        {/* View mode toggle */}
        <div
          role="tablist"
          aria-label="View mode"
          className="flex items-center rounded-xl border border-border p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
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
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
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
        <span className="text-xs font-medium bg-muted text-muted-foreground px-3 py-1 border border-border rounded-full shrink-0">
          {totalFiltered} leads
        </span>

        {/* Divider */}
        <div className="w-px h-5 bg-border shrink-0 mx-1" aria-hidden="true" />

        {/* Refresh */}
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
                className={cn("h-9 gap-1.5 shrink-0", hasActive && "border-primary/50")}
                aria-label="Filter leads"
              >
                <Filter weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
                Filter
                {FilterBadge}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-72 p-3">
            <FilterPanelContent
              scope={scope}
              statusFilter={statusFilter}
              onStatusChange={onStatusChange}
              venueFilter={venueFilter}
              onVenueChange={onVenueChange}
              eventTypeFilter={eventTypeFilter}
              onEventTypeChange={onEventTypeChange}
              statusCounts={statusCounts}
              venues={venues}
              eventTypes={eventTypes}
              hasActive={hasActive}
              onReset={handleReset}
            />
          </PopoverContent>
        </Popover>

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
            className="pl-9 w-48"
          />
        </div>

        {/* Tambah Lead — pushed to far right */}
        <Button onClick={onAdd} className="ml-auto shrink-0">
          <AddCircle weight="BoldDuotone" aria-hidden="true" className="h-4 w-4" />
          Tambah Lead
        </Button>
      </div>
    </div>
  );
}
