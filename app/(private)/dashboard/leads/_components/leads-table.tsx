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
import { BookingDrawer } from "@/app/(private)/dashboard/booking-weddings/_components/booking-drawer";
import { MiceBookingDrawer } from "@/app/(private)/dashboard/booking-mice/_components/MiceBookingDrawer";
import { useLeads, useUpdateLeadStatus, useDeleteLead } from "@/hooks/use-leads";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LeadItem } from "@/lib/queries/leads";
import type { LeadListItem, BookingPrefillLead, ContactNumber } from "@/types/lead";

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
  const [dealTarget, setDealTarget] = useState<LeadItem | null>(null);
  const [lostTarget, setLostTarget] = useState<LeadItem | null>(null);
  const [resetTarget, setResetTarget] = useState<LeadItem | null>(null);
  const [isMarkingStatus, setIsMarkingStatus] = useState(false);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  // Booking creation from a lead — routed to wedding or MICE drawer by category.
  const [weddingPrefill, setWeddingPrefill] = useState<BookingPrefillLead | null>(null);
  const [micePrefill, setMicePrefill] = useState<BookingPrefillLead | null>(null);

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

  // Find the system Deal and Lost status IDs from the loaded statuses list.
  // Deal has isFinal=true & isSystem=true, Lost has isFinal=true & isSystem=false.
  const dealStatus = statuses.find((s) => s.isFinal && s.isSystem);
  const lostStatus = statuses.find((s) => s.isFinal && !s.isSystem);

  // Open confirmation modal; the actual mutation runs on confirm.
  function handleMarkDeal(lead: LeadItem) {
    if (lead.status.isFinal) { toast.info("Lead sudah berstatus final."); return; }
    setDealTarget(lead);
  }

  function handleMarkLost(lead: LeadItem) {
    if (lead.status.isFinal) { toast.info("Lead sudah berstatus final."); return; }
    setLostTarget(lead);
  }

  async function handleConfirmDeal() {
    if (!dealTarget) return;
    if (!dealStatus) { toast.error("Status Deal tidak ditemukan."); return; }
    setIsMarkingStatus(true);
    try {
      const res = await updateStatus({ id: dealTarget.id, statusId: dealStatus.id });
      if (res.success) {
        toast.success(`${dealTarget.name} ditandai sebagai Deal.`);
        setDealTarget(null);
      } else {
        toast.error(res.error ?? "Gagal mengubah status.");
      }
    } catch {
      toast.error("Gagal mengubah status.");
    } finally {
      setIsMarkingStatus(false);
    }
  }

  async function handleConfirmLost() {
    if (!lostTarget) return;
    if (!lostStatus) { toast.error("Status Lost tidak ditemukan."); return; }
    setIsMarkingStatus(true);
    try {
      const res = await updateStatus({ id: lostTarget.id, statusId: lostStatus.id });
      if (res.success) {
        toast.success(`${lostTarget.name} ditandai sebagai Lost.`);
        setLostTarget(null);
      } else {
        toast.error(res.error ?? "Gagal mengubah status.");
      }
    } catch {
      toast.error("Gagal mengubah status.");
    } finally {
      setIsMarkingStatus(false);
    }
  }

  // Cold = the default pipeline status (isDefault flag), fallback to the first
  // non-final / non-system status by load order.
  const coldStatus =
    statuses.find((s) => s.isDefault && !s.isFinal && !s.isSystem) ??
    statuses.find((s) => !s.isFinal && !s.isSystem);

  // Open the Reset confirmation (only meaningful for final leads).
  function handleReset(lead: LeadItem) {
    if (!lead.status.isFinal) { toast.info("Lead belum final, tidak perlu di-reset."); return; }
    setResetTarget(lead);
  }

  async function handleConfirmReset() {
    if (!resetTarget) return;
    if (!coldStatus) { toast.error("Status Cold tidak ditemukan."); return; }
    setIsMarkingStatus(true);
    try {
      const res = await updateStatus({ id: resetTarget.id, statusId: coldStatus.id });
      if (res.success) {
        toast.success(`${resetTarget.name} dikembalikan ke ${coldStatus.name}.`);
        setResetTarget(null);
      } else {
        toast.error(res.error ?? "Gagal me-reset status.");
      }
    } catch {
      toast.error("Gagal me-reset status.");
    } finally {
      setIsMarkingStatus(false);
    }
  }

  // Build a booking prefill payload from a lead and open the matching drawer.
  function handleCreateBooking(lead: LeadItem) {
    const prefill: BookingPrefillLead = {
      leadId: lead.id,
      name: lead.name,
      contactNumbers: (lead.contactNumbers as ContactNumber[] | null) ?? [],
      email: lead.email,
      address: lead.address,
      bitrixId: lead.bitrixId,
      eventDate: lead.eventDate,
      time: lead.time,
      estimatedPax: lead.estimatedPax,
      notes: lead.notes,
      weddingSession: lead.weddingSession,
      venue: lead.venue,
      package: lead.package,
      eventType: lead.eventType,
      sourceOfInformation: lead.sourceOfInformation,
      assignedTo: lead.assignedTo,
    };
    // Route by the lead's category (eventType.category wins, falls back to lead.category).
    const category = lead.eventType?.category ?? lead.category;
    if (category === "MICE") {
      setMicePrefill(prefill);
    } else {
      setWeddingPrefill(prefill);
    }
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
              onMarkDeal={handleMarkDeal}
              onMarkLost={handleMarkLost}
              onReset={handleReset}
              onCreateBooking={handleCreateBooking}
              isLoading={leadsLoading || isManualRefresh}
            />
          )}

          {effectiveViewMode === "pipeline" && (
            <LeadsPipelineView
              leads={leads}
              statuses={pipelineStatuses}
              onDragEnd={handleDragEnd}
              onEdit={handleEdit}
              onMarkDeal={handleMarkDeal}
              onMarkLost={handleMarkLost}
              onCreateBooking={handleCreateBooking}
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

      {/* Create Booking from a lead — wedding drawer */}
      {weddingPrefill && (
        <BookingDrawer
          open={!!weddingPrefill}
          onOpenChange={(o) => { if (!o) setWeddingPrefill(null); }}
          prefillLead={weddingPrefill}
          onSuccess={() => { setWeddingPrefill(null); void refetchLeads(); }}
        />
      )}

      {/* Create Booking from a lead — MICE drawer */}
      {micePrefill && (
        <MiceBookingDrawer
          open={!!micePrefill}
          onOpenChange={(o) => { if (!o) setMicePrefill(null); }}
          booking={null}
          prefillLead={micePrefill}
          onSuccess={() => { setMicePrefill(null); void refetchLeads(); }}
        />
      )}

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

      <AlertDialog open={!!dealTarget} onOpenChange={(open) => !open && setDealTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai sebagai Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai <strong>{dealTarget?.name}</strong> sebagai <strong>Deal</strong>? Status lead akan menjadi final dan tidak bisa dipindahkan lagi di pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarkingStatus}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeal} disabled={isMarkingStatus}>
              {isMarkingStatus ? "Memproses..." : "Tandai Deal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!lostTarget} onOpenChange={(open) => !open && setLostTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai sebagai Lost</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai <strong>{lostTarget?.name}</strong> sebagai <strong>Lost</strong>? Status lead akan menjadi final dan tidak bisa dipindahkan lagi di pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarkingStatus}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLost}
              disabled={isMarkingStatus}
              className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}
            >
              {isMarkingStatus ? "Memproses..." : "Tandai Lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Status Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Kembalikan <strong>{resetTarget?.name}</strong> ke status <strong>{coldStatus?.name ?? "Cold"}</strong>? Lead akan kembali aktif di pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarkingStatus}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReset} disabled={isMarkingStatus}>
              {isMarkingStatus ? "Memproses..." : `Reset ke ${coldStatus?.name ?? "Cold"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
