"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddCircle, Magnifer, UploadMinimalistic } from "@solar-icons/react";
import { useVenues } from "@/hooks/use-venues";
import { useMaintenanceCategories } from "@/hooks/useMaintenanceCategories";
import { useMaintenancePriorities } from "@/hooks/useMaintenancePriorities";
import { useMaintenanceStatuses } from "@/hooks/useMaintenanceStatuses";

interface TicketFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  venueId: string;
  onVenueChange: (v: string) => void;
  statusId: string;
  onStatusChange: (v: string) => void;
  priorityId: string;
  onPriorityChange: (v: string) => void;
  categoryId: string;
  onCategoryChange: (v: string) => void;
  isVendor: boolean;
  onIsVendorChange: (v: boolean) => void;
  isAudit: boolean;
  onIsAuditChange: (v: boolean) => void;
  pageSize: number;
  onPageSizeChange: (v: number) => void;
  onAddClick: () => void;
  onExport: () => void;
}

export function TicketFilters({
  search,
  onSearchChange,
  venueId,
  onVenueChange,
  statusId,
  onStatusChange,
  priorityId,
  onPriorityChange,
  categoryId,
  onCategoryChange,
  isVendor,
  onIsVendorChange,
  isAudit,
  onIsAuditChange,
  pageSize,
  onPageSizeChange,
  onAddClick,
  onExport,
}: TicketFiltersProps) {
  const { data: venues = [] } = useVenues();
  const { data: statuses = [] } = useMaintenanceStatuses();
  const { data: priorities = [] } = useMaintenancePriorities();
  const { data: categories = [] } = useMaintenanceCategories();

  return (
    <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-b">
      {/* Row 1: Selects */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select value={venueId} onValueChange={onVenueChange}>
          <SelectTrigger className="h-9 text-sm" aria-label="Filter venue">
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

        <Select value={statusId} onValueChange={onStatusChange}>
          <SelectTrigger className="h-9 text-sm" aria-label="Filter status">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityId} onValueChange={onPriorityChange}>
          <SelectTrigger className="h-9 text-sm" aria-label="Filter prioritas">
            <SelectValue placeholder="Semua Prioritas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Prioritas</SelectItem>
            {priorities.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryId} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-9 text-sm" aria-label="Filter kategori">
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Checkboxes */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-vendor"
            checked={isVendor}
            onCheckedChange={(checked) => onIsVendorChange(checked === true)}
          />
          <Label htmlFor="filter-vendor" className="text-sm cursor-pointer">
            Vendor
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="filter-audit"
            checked={isAudit}
            onCheckedChange={(checked) => onIsAuditChange(checked === true)}
          />
          <Label htmlFor="filter-audit" className="text-sm cursor-pointer">
            Audit
          </Label>
        </div>
      </div>

      {/* Row 3: Search + Show entries + Export + Add */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Magnifer
              weight="BoldDuotone"
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Cari ticket"
              placeholder="Cari deskripsi / kategori..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-full sm:w-60"
            />
          </div>

          {/* Show entries */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Tampilkan</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-9 w-20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <UploadMinimalistic weight="BoldDuotone" className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button size="sm" onClick={onAddClick}>
            <AddCircle weight="BoldDuotone" className="h-4 w-4 mr-1" />
            Tambah Job
          </Button>
        </div>
      </div>
    </div>
  );
}
