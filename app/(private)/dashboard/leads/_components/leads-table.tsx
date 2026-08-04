"use client";

import { useState, useMemo } from "react";
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
import { LeadDrawer } from "./lead-drawer";
import { CreateLeadDrawer } from "./CreateLeadDrawer";
import { LeadsFilters } from "./leads-filters";
import { LeadsListView } from "./leads-list-view";
import { useLeads, useUpdateLeadStatus, useDeleteLead } from "@/hooks/use-leads";
import { LeadDetailModal } from "./LeadDetailModal";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import type { LeadItem } from "@/lib/queries/leads";
import type { LeadListItem } from "@/types/lead";
import type { LeadScope } from "@/lib/validations/lead";

export type { LeadItem };

// ─── Main orchestrator ────────────────────────────────────────────────────────

export function LeadsTable() {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<LeadScope>("active");
  const [statusFilter, setStatusFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadListItem | null>(null);
  // CreateLeadDrawer — new redesigned create flow (frontend-only for now)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadItem | null>(null);
  // Deal / Lost / Reset are pure pipeline status flips. Leads carry no booking:
  // a Deal only marks the pipeline outcome; the actual Booking is created later
  // from the Booking menu (with its own in-drawer lead picker) or via Quotation.
  const [dealTarget, setDealTarget] = useState<LeadItem | null>(null);
  const [lostTarget, setLostTarget] = useState<LeadItem | null>(null);
  const [resetTarget, setResetTarget] = useState<LeadItem | null>(null);
  const [detailLead, setDetailLead] = useState<LeadItem | null>(null);
  const [isMarkingStatus, setIsMarkingStatus] = useState(false);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const pageSize = 20;

  // Stable filter object via useMemo — avoids new object reference on every render,
  // which would cause TanStack Query to treat it as a new queryKey and refetch unnecessarily.
  const leadsFilter = useMemo(
    () => ({
      search: search.trim() || undefined,
      scope,
      statusId: scope === "active" && statusFilter !== "all" ? statusFilter : undefined,
      venueId: venueFilter !== "all" ? venueFilter : undefined,
      eventTypeId: eventTypeFilter !== "all" ? eventTypeFilter : undefined,
      segmentId: segmentFilter !== "all" ? segmentFilter : undefined,
      page: currentPage,
      pageSize,
    }),
    [search, scope, statusFilter, venueFilter, eventTypeFilter, segmentFilter, currentPage, pageSize],
  );

  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useLeads(leadsFilter);

  const { data: statuses = [] } = useLeadStatuses();
  const { mutateAsync: updateStatus } = useUpdateLeadStatus();
  const { mutateAsync: deleteLeadMut, isPending: isDeleting } = useDeleteLead();

  const leads = useMemo(() => leadsData?.items ?? [], [leadsData?.items]);
  const totalPages = leadsData?.totalPages ?? 1;

  function handleAdd() {
    // Opens the new redesigned CreateLeadDrawer (frontend-only UI for review)
    // TODO(backend): after backend wiring, this will call the real create action
    setCreateDrawerOpen(true);
  }

  function handleEdit(lead: LeadItem) {
    setEditLead(lead as unknown as LeadListItem);
    setDrawerOpen(true);
  }

  // Find the system Deal and Lost status IDs from the loaded statuses list.
  // Deal: isFinal=true & isSystem=true (system-managed, set at seed time).
  // Lost: prefer name match "lost" first (most explicit), then fallback to
  //       isFinal=true & isSystem=false. Assumption: there is exactly one custom
  //       final status and it represents "Lost". If multiple custom final statuses
  //       exist in the future, a dedicated isLost flag on LeadStatus should be added.
  const dealStatus = statuses.find((s) => s.isFinal && s.isSystem);
  const lostStatus =
    statuses.find((s) => s.name.toLowerCase() === "lost") ??
    statuses.find((s) => s.isFinal && !s.isSystem);

  // Open confirmation modal; the actual mutation runs on confirm.
  // Deal is a plain status flip for both wedding & MICE — no booking is created here.
  function handleMarkDeal(lead: LeadItem) {
    if (lead.status.isFinal) {
      toast.info("Lead sudah berstatus final.");
      return;
    }
    setDealTarget(lead);
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

  function handleMarkLost(lead: LeadItem) {
    if (lead.status.isFinal) { toast.info("Lead sudah berstatus final."); return; }
    setLostTarget(lead);
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

  function handleScopeChange(value: LeadScope) {
    setScope(value);
    setCurrentPage(1);
    // Reset status filter when switching scope (status filter only applies in active)
    setStatusFilter("all");
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

  function handleSegmentChange(value: string) {
    setSegmentFilter(value);
    setCurrentPage(1);
  }

  function handleRefresh() {
    // Show shimmer only for manual refresh (not for background refetches like
    // drag-and-drop optimistic settles).
    setIsManualRefresh(true);
    void refetchLeads().finally(() => setIsManualRefresh(false));
  }

  // statusCounts is used only for the status filter dropdown (name + color).
  // Omit per-page count: leads is a 20-item slice so per-status counts would be
  // inaccurate. A server-side aggregate would be needed for accurate counts.
  const statusCounts = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
  }));

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <LeadsFilters
            scope={scope}
            onScopeChange={handleScopeChange}
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusChange={handleStatusChange}
            venueFilter={venueFilter}
            onVenueChange={handleVenueChange}
            eventTypeFilter={eventTypeFilter}
            onEventTypeChange={handleEventTypeChange}
            segmentFilter={segmentFilter}
            onSegmentChange={handleSegmentChange}
            statusCounts={statusCounts}
            totalFiltered={leadsData?.total ?? 0}
            onAdd={handleAdd}
            onRefresh={handleRefresh}
            isRefreshing={isManualRefresh}
          />

          <LeadsListView
            leads={leads}
            search={search}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
            onMarkDeal={handleMarkDeal}
            onMarkLost={handleMarkLost}
            onReset={handleReset}
            onViewDetail={setDetailLead}
            isLoading={leadsLoading || isManualRefresh}
          />
        </CardContent>
      </Card>

      {/* New create drawer — redesigned UI with step-0 category selection */}
      <CreateLeadDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {/* Edit drawer — existing LeadDrawer (edit mode only) */}
      <LeadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editLead={editLead}
      />

      {/* Lead detail modal — opens on row click */}
      <LeadDetailModal
        open={!!detailLead}
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        onEdit={(lead) => {
          setDetailLead(null);
          handleEdit(lead);
        }}
      />

      {/* Deal — plain status flip for wedding & MICE. Booking dibuat terpisah lewat
          menu Booking (punya lead picker sendiri) atau lewat Quotation. */}
      <AlertDialog open={!!dealTarget} onOpenChange={(open) => !open && setDealTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai sebagai Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai <strong>{dealTarget?.name}</strong> sebagai <strong>Deal</strong>? Status lead akan menjadi final. Booking tidak dibuat pada tahap ini — buat Booking lewat menu Booking (pilih lead ini) atau lewat Quotation.
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
