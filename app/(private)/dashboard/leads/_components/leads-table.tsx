"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { type DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { LeadDrawer } from "./lead-drawer";
import { LeadsFilters, type ViewMode } from "./leads-filters";
import { LeadsListView } from "./leads-list-view";
import { LeadsPipelineView } from "./leads-pipeline-view";
import { useLeads, useUpdateLeadStatus } from "@/hooks/use-leads";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadListItem | null>(null);

  const pageSize = 20;
  const { data: leadsData, isLoading: leadsLoading, isFetching: leadsFetching, refetch: refetchLeads } = useLeads({
    search: search.trim() || undefined,
    statusId: statusFilter !== "all" ? statusFilter : undefined,
    page: currentPage,
    pageSize,
  });

  const { data: statuses = [] } = useLeadStatuses();
  const { mutateAsync: updateStatus } = useUpdateLeadStatus();

  // Non-final statuses go in pipeline
  const pipelineStatuses = statuses.filter((s) => !s.isFinal);

  const leads = useMemo(() => leadsData?.items ?? [], [leadsData?.items]);
  const totalPages = leadsData?.totalPages ?? 1;

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
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

      const res = await updateStatus({ id: draggableId, statusId: newStatusId });
      if (res.success) {
        toast.success(`${lead.name} dipindahkan ke ${newStatus.name}`);
      } else {
        toast.error(res.error ?? "Gagal memindahkan lead.");
      }
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

  function handleSearchChange(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  function handleRefresh() {
    void refetchLeads();
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
            statusCounts={statusCounts}
            totalFiltered={leadsData?.total ?? 0}
            onAdd={handleAdd}
            onRefresh={handleRefresh}
            isRefreshing={leadsFetching}
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
              onBuatQuotation={handleBuatQuotation}
              isLoading={leadsLoading}
            />
          )}

          {effectiveViewMode === "pipeline" && (
            <LeadsPipelineView
              leads={leads}
              statuses={pipelineStatuses}
              onDragEnd={handleDragEnd}
              onEdit={handleEdit}
            />
          )}
        </CardContent>
      </Card>

      <LeadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editLead={editLead}
      />
    </>
  );
}
