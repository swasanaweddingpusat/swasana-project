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
import { AddSquare } from "@solar-icons/react";
import {
  useProcurementList,
  useProcurementSummary,
  useDeleteProcurement,
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
  const { data, isLoading } = useProcurementList(filters);
  const { data: summary } = useProcurementSummary(filters.venueId);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProcurementItem | null>(null);
  const [detailItem, setDetailItem] = useState<ProcurementItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approveItem, setApproveItem] = useState<ProcurementItem | null>(null);

  const { mutateAsync: deleteMutation, isPending: isDeleting } =
    useDeleteProcurement();

  const handleFilterChange = (newFilters: Partial<ProcurementFilterInput>): void => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number): void => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const findItem = (id: string): ProcurementItem | null =>
    data?.items.find((i) => i.id === id) ?? null;

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

  const deleteItemName =
    data?.items.find((i) => i.id === deleteId)?.namaBarang ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Pengadaan Barang
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola pengajuan pengadaan dan pembelian barang
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="rounded-full">
          <AddSquare weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
          Tambah Pengajuan
        </Button>
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
    </div>
  );
}
