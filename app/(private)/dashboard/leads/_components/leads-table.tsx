"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { type DropResult } from "@hello-pangea/dnd";
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
import { LeadDrawer } from "./lead-drawer";
import { LeadsFilters, type ViewMode } from "./leads-filters";
import { LeadsListView } from "./leads-list-view";
import { LeadsPipelineView } from "./leads-pipeline-view";
import { useLeads, useUpdateLeadStatus, useDeleteLead } from "@/hooks/use-leads";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LeadItem } from "@/lib/queries/leads";
import type { LeadListItem } from "@/types/lead";

export type { LeadItem };

// ─── Main orchestrator ────────────────────────────────────────────────────────

export function LeadsTable() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const isMobile = useIsMobile();
  // On mobile, always render list view regardless of viewMode state
  const effectiveViewMode: ViewMode = isMobile ? "list" : viewMode;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadItem | null>(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const pageSize = 20;
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useLeads({
    search: search.trim() || undefined,
    statusId: statusFilter !== "all" ? statusFilter : undefined,
    venueId: venueFilter !== "all" ? venueFilter : undefined,
    eventTypeId: eventTypeFilter !== "all" ? eventTypeFilter : undefined,
    page: currentPage,
    pageSize,
  });

  const { data: statuses = [] } = useLeadStatuses();
  const { mutateAsync: updateStatus } = useUpdateLeadStatus();
  const { mutateAsync: deleteLeadMut, isPending: isDeleting } = useDeleteLead();

  // Non-final statuses go in pipeline
  const pipelineStatuses = statuses.filter((s) => !s.isFinal);

  const leads = useMemo(() => leadsData?.items ?? [], [leadsData?.items]);
  const totalPages = leadsData?.totalPages ?? 1;

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, destination } = result;
      if (!destination) return;
      const newStatusId = destination.droppableId;
      const newStatus = statuses.find((s) => s.id === newStatusId);
      if (!newStatus) return;

      const lead = leads.find((l) => l.id === draggableId);
      if (!lead || lead.status.id === newStatusId) return;

      if (newStatus.isSystem) {
        toast.error(`Status "${newStatus.name}" tidak dapat diubah lewat drag.`);
        return;
      }

      // Fire-and-forget: the card moves instantly via optimistic cache update
      // in useUpdateLeadStatus. The API runs in the background; on failure the
      // mutation rolls back the cache and we surface the error.
      updateStatus({ id: draggableId, statusId: newStatusId })
        .then((res) => {
          if (res.success) {
            toast.success(`${lead.name} dipindahkan ke ${newStatus.name}`);
          } else {
            toast.error(res.error ?? "Gagal memindahkan lead.");
          }
        })
        .catch(() => toast.error("Gagal memindahkan lead."));
    },
    [leads, statuses, updateStatus]
  );

  function handleAdd() {
    setEditLead(null);
    setDrawerOpen(true);
  }

  function handleEdit(lead: LeadItem) {
    setEditLead(lead as unknown as LeadListItem);
    setDrawerOpen(true);
  }

  function handleBuatQuotation(lead: LeadItem) {
    toast.info(`Buat Quotation untuk ${lead.name} — coming soon.`);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const res = await deleteLeadMut(deleteTarget.id);
    if (res.success) {
      toast.success(`Lead "${deleteTarget.name}" dihapus.`);
      setDeleteTarget(null);
    } else {
      toast.error(res.error ?? "Gagal menghapus lead.");
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  function handleVenueChange(value: string) {
    setVenueFilter(value);
    setCurrentPage(1);
  }

  function handleEventTypeChange(value: string) {
    setEventTypeFilter(value);
    setCurrentPage(1);
  }

  function handleRefresh() {
    // Show shimmer only for manual refresh (not for background refetches like
    // drag-and-drop optimistic settles).
    setIsManualRefresh(true);
    void refetchLeads().finally(() => setIsManualRefresh(false));
  }

  const statusCounts = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    count: leads.filter((l) => l.status.id === s.id).length,
  }));

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <LeadsFilters
            viewMode={viewMode}
            onViewModeChange={(mode) => { setViewMode(mode); }}
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusChange={handleStatusChange}
            venueFilter={venueFilter}
            onVenueChange={handleVenueChange}
            eventTypeFilter={eventTypeFilter}
            onEventTypeChange={handleEventTypeChange}
            statusCounts={statusCounts}
            totalFiltered={leadsData?.total ?? 0}
            onAdd={handleAdd}
            onRefresh={handleRefresh}
            isRefreshing={isManualRefresh}
          />

          {effectiveViewMode === "list" && (
            <LeadsListView
              leads={leads}
              search={search}
              currentPage={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onBuatQuotation={handleBuatQuotation}
              isLoading={leadsLoading || isManualRefresh}
            />
          )}

          {effectiveViewMode === "pipeline" && (
            <LeadsPipelineView
              leads={leads}
              statuses={pipelineStatuses}
              onDragEnd={handleDragEnd}
              onEdit={handleEdit}
              isLoading={leadsLoading || isManualRefresh}
            />
          )}
        </CardContent>
      </Card>

      <LeadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editLead={editLead}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
