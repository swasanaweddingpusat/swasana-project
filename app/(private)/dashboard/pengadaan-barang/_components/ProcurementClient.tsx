"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { ProcurementStats } from "./ProcurementStats";
import { ProcurementFilters } from "./ProcurementFilters";
import { ProcurementTable } from "./ProcurementTable";
import { AddProcurementDrawer } from "./AddProcurementDrawer";
import { EditProcurementDrawer } from "./EditProcurementDrawer";
import { ProcurementDetailDrawer } from "./ProcurementDetailDrawer";
import { ApproveProcurementDialog } from "./ApproveProcurementDialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AddCircle, AltArrowDown } from "@solar-icons/react";
import {
  useProcurementList,
  useProcurementSummary,
  useDeleteProcurement,
  useBulkApproveProcurement,
  useFetchAllPendingIds,
} from "@/hooks/useProcurement";
import type { ProcurementFilterInput } from "@/lib/validations/procurement";
import type { ProcurementItem } from "@/lib/queries/procurement";

interface ProcurementClientProps {
  initialVenues: { id: string; name: string }[];
}

export function ProcurementClient({
  initialVenues,
}: ProcurementClientProps): React.JSX.Element {
  const [filters, setFilters] = useState<ProcurementFilterInput>({
    page: 1,
    limit: 20,
  });
  const { data, isLoading, isError, error } = useProcurementList(filters);
  const { data: summary } = useProcurementSummary(filters.venueId);

  const [editItem, setEditItem] = useState<ProcurementItem | null>(null);
  const [detailItem, setDetailItem] = useState<ProcurementItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approveItem, setApproveItem] = useState<ProcurementItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allPagesSelected, setAllPagesSelected] = useState(false);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { mutateAsync: deleteMutation, isPending: isDeleting } =
    useDeleteProcurement();
  const { mutateAsync: bulkApproveMutation, isPending: isBulkApproving } =
    useBulkApproveProcurement();
  const { mutateAsync: fetchPendingIds, isPending: isSelectingAll } =
    useFetchAllPendingIds();

  const handleFilterChange = (newFilters: Partial<ProcurementFilterInput>): void => {
    setSelectedIds([]);
    setAllPagesSelected(false);
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number): void => {
    if (!allPagesSelected) {
      setSelectedIds([]);
    }
    setFilters((prev) => ({ ...prev, page }));
  };

  const findItem = (id: string): ProcurementItem | null =>
    data?.items.find((i) => i.id === id) ?? null;

  React.useEffect(() => {
    if (!data) return;
    setSelectedIds((prev) =>
      prev.filter((id) =>
        data.items.some((item) => item.id === id && item.status === "PENDING")
      )
    );
  }, [data]);

  async function handleDelete(): Promise<void> {
    if (!deleteId) return;
    try {
      await deleteMutation(deleteId);
      toast.success("Pengajuan berhasil dihapus.");
      setDeleteId(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus pengajuan"
      );
    }
  }

  async function handleBulkApprove(): Promise<void> {
    if (selectedIds.length === 0) return;
    try {
      await bulkApproveMutation(selectedIds);
      toast.success("Semua pengajuan terpilih berhasil disetujui.");
      setSelectedIds([]);
      setAllPagesSelected(false);
      setBulkApproveOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal menyetujui pengajuan terpilih"
      );
    }
  }

  async function handleSelectAllPages(): Promise<void> {
    try {
      const ids = await fetchPendingIds({
        search: filters.search,
        venueId: filters.venueId,
        division: filters.division,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      setSelectedIds(ids);
      setAllPagesSelected(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memilih semua pengajuan");
    }
  }

  function handleClearAllPages(): void {
    setSelectedIds([]);
    setAllPagesSelected(false);
  }

  async function handleExport(format: "pdf" | "excel" | "csv"): Promise<void> {
    setIsExporting(true);
    try {
      const query = new URLSearchParams();
      if (filters.search) query.set("search", filters.search);
      if (filters.venueId) query.set("venueId", filters.venueId);
      if (filters.division) query.set("division", filters.division);
      if (filters.status) query.set("status", filters.status);
      if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) query.set("dateTo", filters.dateTo);
      query.set("format", format);

      const exportUrl = `/api/procurement/export?${query.toString()}`;
      const anchor = document.createElement("a");
      anchor.href = exportUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(`Download ${format.toUpperCase()} dimulai.`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mengekspor data pengadaan"
      );
    } finally {
      setIsExporting(false);
    }
  }

  const deleteItemName = deleteId ? (findItem(deleteId)?.namaBarang ?? "") : "";

  return (
    <div className="space-y-6">
      <ProcurementStats summary={summary} isLoading={!summary} />

      <ProcurementFilters
        venues={initialVenues}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat memuat data pengadaan."}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="rounded-full gap-2"
            onClick={() => setAddOpen(true)}
          >
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            Tambah Pengajuan
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => setBulkApproveOpen(true)}
            disabled={selectedIds.length === 0 || isBulkApproving}
          >
            <span className="text-sm">
              Setujui Terpilih ({selectedIds.length})
            </span>
          </Button>
          <span className="text-sm text-muted-foreground min-w-[180px]">
            Pilih baris status Menunggu untuk aksi bulk.
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full flex items-center gap-2"
                disabled={isExporting}
              >
                <AltArrowDown weight="BoldDuotone" className="h-4 w-4" />
                Ekspor
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { void handleExport("pdf"); }}>PDF</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void handleExport("excel"); }}>Excel</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void handleExport("csv"); }}>CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">
          {selectedIds.length > 0
            ? allPagesSelected
              ? `Semua ${selectedIds.length} pengajuan Menunggu dipilih`
              : `${selectedIds.length} pengajuan dipilih`
            : "Pilih pengajuan untuk aksi massal."}
        </p>
      </div>

      <ProcurementTable
        items={data?.items ?? []}
        total={data?.total ?? 0}
        page={filters.page ?? 1}
        limit={filters.limit ?? 20}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        totalPending={summary?.pending ?? 0}
        allPagesSelected={allPagesSelected}
        onSelectAllPages={() => { void handleSelectAllPages(); }}
        onClearAllPages={handleClearAllPages}
        isSelectingAll={isSelectingAll}
        onPageChange={handlePageChange}
        onView={(id) => setDetailItem(findItem(id))}
        onEdit={(id) => setEditItem(findItem(id))}
        onDelete={(id) => setDeleteId(id)}
        onApprove={(id) => setApproveItem(findItem(id))}
      />

      <AddProcurementDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        venues={initialVenues}
      />

      <EditProcurementDrawer
        open={!!editItem}
        onOpenChange={(o) => {
          if (!o) setEditItem(null);
        }}
        item={editItem}
        venues={initialVenues}
      />

      <ProcurementDetailDrawer
        open={!!detailItem}
        onOpenChange={(o) => {
          if (!o) setDetailItem(null);
        }}
        item={detailItem}
      />

      <ApproveProcurementDialog
        open={!!approveItem}
        onOpenChange={(o) => {
          if (!o) setApproveItem(null);
        }}
        item={approveItem}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Hapus Pengajuan"
        description={`Hapus pengajuan "${deleteItemName}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel={isDeleting ? "Menghapus..." : "Hapus"}
        cancelLabel="Batal"
        onConfirm={() => {
          void handleDelete();
        }}
        destructive
      />
      <ConfirmDialog
        open={bulkApproveOpen}
        onOpenChange={(o) => {
          if (!o) setBulkApproveOpen(false);
        }}
        title="Setujui Pengajuan Terpilih"
        description={`Setujui ${selectedIds.length} pengajuan terpilih?`}
        confirmLabel={isBulkApproving ? "Memproses..." : "Setujui"}
        cancelLabel="Batal"
        onConfirm={() => {
          void handleBulkApprove();
        }}
      />
    </div>
  );
}
