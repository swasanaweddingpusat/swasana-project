"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProcurementFilterInput } from "@/lib/validations/procurement";

interface ProcurementFiltersProps {
  venues: { id: string; name: string }[];
  filters: ProcurementFilterInput;
  onFilterChange: (filters: Partial<ProcurementFilterInput>) => void;
}

const DIVISIONS = ["HR", "OPERATIONAL", "IT", "FINANCE", "MICE"];
const STATUSES = [
  { value: "PENDING", label: "Menunggu" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "COMPLETED", label: "Selesai" },
];

export function ProcurementFilters({
  venues,
  filters,
  onFilterChange,
}: ProcurementFiltersProps) {
  const handleReset = () => {
    onFilterChange({
      venueId: undefined,
      division: undefined,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters = !!(
    filters.venueId ||
    filters.division ||
    filters.status ||
    filters.dateFrom ||
    filters.dateTo
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-40">
          <p className="text-xs text-muted-foreground mb-1.5">Venue</p>
          <Select
            value={filters.venueId ?? "all"}
            onValueChange={(v) =>
              onFilterChange({ venueId: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger className="rounded-xl h-9">
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

        <div className="min-w-36">
          <p className="text-xs text-muted-foreground mb-1.5">Divisi</p>
          <Select
            value={filters.division ?? "all"}
            onValueChange={(v) =>
              onFilterChange({ division: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger className="rounded-xl h-9">
              <SelectValue placeholder="Semua Divisi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Divisi</SelectItem>
              {DIVISIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-36">
          <p className="text-xs text-muted-foreground mb-1.5">Status</p>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) =>
              onFilterChange({ status: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger className="rounded-xl h-9">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Dari Tanggal</p>
          <Input
            type="date"
            className="rounded-xl h-9 w-36"
            value={filters.dateFrom ?? ""}
            onChange={(e) =>
              onFilterChange({ dateFrom: e.target.value || undefined })
            }
          />
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Sampai Tanggal</p>
          <Input
            type="date"
            className="rounded-xl h-9 w-36"
            value={filters.dateTo ?? ""}
            onChange={(e) =>
              onFilterChange({ dateTo: e.target.value || undefined })
            }
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="rounded-full h-9 text-muted-foreground"
          >
            Reset Filter
          </Button>
        )}
      </div>
    </div>
  );
}
