"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useMaintenance, useDeleteMaintenance, useInvalidateMaintenance } from "@/hooks/useMaintenance";
import type { MaintenanceTicketItem } from "@/lib/queries/maintenance";
import { PreventiveFilters } from "./PreventiveFilters";
import { PreventiveTable } from "./PreventiveTable";
import { PreventiveDrawer } from "./PreventiveDrawer";

export function PreventiveMaintenanceTab() {
  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [venueId, setVenueId] = useState("all");
  const [statusId, setStatusId] = useState("all");
  const [priorityId, setPriorityId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [isVendor, setIsVendor] = useState(false);
  const [isAudit, setIsAudit] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceTicketItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceTicketItem | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useMaintenance({
    type: "PREVENTIVE",
    search: search.trim() || undefined,
    venueId: venueId !== "all" ? venueId : undefined,
    statusId: statusId !== "all" ? statusId : undefined,
    priorityId: priorityId !== "all" ? priorityId : undefined,
    categoryId: categoryId !== "all" ? categoryId : undefined,
    isVendor: isVendor ? "true" : undefined,
    isAudit: isAudit ? "true" : undefined,
    page,
    pageSize,
  });

  const { mutateAsync: deleteMutation, isPending: isDeleting } =
    useDeleteMaintenance();
  const invalidateMaintenance = useInvalidateMaintenance();

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleAdd() {
    setEditItem(null);
    setDrawerOpen(true);
  }

  function handleEdit(item: MaintenanceTicketItem) {
    setEditItem(item);
    setDrawerOpen(true);
  }

  function handleViewDetail(item: MaintenanceTicketItem) {
    setEditItem(item);
    setDrawerOpen(true);
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleVenueChange(v: string) {
    setVenueId(v);
    setPage(1);
  }

  function handleStatusChange(v: string) {
    setStatusId(v);
    setPage(1);
  }

  function handlePriorityChange(v: string) {
    setPriorityId(v);
    setPage(1);
  }

  function handleCategoryChange(v: string) {
    setCategoryId(v);
    setPage(1);
  }

  function handlePageSizeChange(v: number) {
    setPageSize(v);
    setPage(1);
  }

  function handleExport() {
    toast.info("Export CSV — segera hadir.");
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation(deleteTarget.id);
      await invalidateMaintenance();
      toast.success("Jadwal preventive berhasil dihapus.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus jadwal preventive.");
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <PreventiveFilters
            search={search}
            onSearchChange={handleSearchChange}
            venueId={venueId}
            onVenueChange={handleVenueChange}
            statusId={statusId}
            onStatusChange={handleStatusChange}
            priorityId={priorityId}
            onPriorityChange={handlePriorityChange}
            categoryId={categoryId}
            onCategoryChange={handleCategoryChange}
            isVendor={isVendor}
            onIsVendorChange={setIsVendor}
            isAudit={isAudit}
            onIsAuditChange={setIsAudit}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            onAddClick={handleAdd}
            onExport={handleExport}
          />

          <PreventiveTable
            items={items}
            isLoading={isLoading}
            pageSize={pageSize}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onEdit={handleEdit}
            onViewDetail={handleViewDetail}
            onDelete={setDeleteTarget}
          />
        </CardContent>
      </Card>

      <PreventiveDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editItem={editItem}
        onSuccess={() => { setDrawerOpen(false); }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jadwal Preventive</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus jadwal ini?{" "}
              <strong>{deleteTarget?.description.slice(0, 60)}</strong>
              {(deleteTarget?.description.length ?? 0) > 60 ? "…" : ""}. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { void handleConfirmDelete(); }}
              disabled={isDeleting}
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
