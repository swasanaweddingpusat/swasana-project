"use client";

import { useState } from "react";
import { ProcurementStats } from "./ProcurementStats";
import { ProcurementFilters } from "./ProcurementFilters";
import { ProcurementTable } from "./ProcurementTable";
import { useProcurementList, useProcurementSummary } from "@/hooks/useProcurement";
import type { ProcurementFilterInput } from "@/lib/validations/procurement";

interface ProcurementClientProps {
  initialVenues: { id: string; name: string }[];
}

export function ProcurementClient({ initialVenues }: ProcurementClientProps) {
  const [filters, setFilters] = useState<ProcurementFilterInput>({ page: 1, limit: 20 });
  const { data, isLoading } = useProcurementList(filters);
  const { data: summary } = useProcurementSummary(filters.venueId);

  const handleFilterChange = (newFilters: Partial<ProcurementFilterInput>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Pengadaan Barang</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola pengajuan pengadaan dan pembelian barang
          </p>
        </div>
        {/* AddProcurementDrawer will be wired here in Task 7 */}
        <button
          type="button"
          className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-full shadow-sm hover:opacity-90 transition-opacity"
          data-add-procurement
        >
          + Tambah Pengajuan
        </button>
      </div>

      <ProcurementStats summary={summary} isLoading={!summary} />

      <ProcurementFilters
        venues={initialVenues}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <ProcurementTable
        items={data?.items ?? []}
        total={data?.total ?? 0}
        page={filters.page ?? 1}
        limit={filters.limit ?? 20}
        isLoading={isLoading}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
