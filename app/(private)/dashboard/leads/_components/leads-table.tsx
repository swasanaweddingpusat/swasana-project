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
import { BookingDrawer } from "@/app/(private)/dashboard/booking-weddings/_components/booking-drawer";
import { MiceBookingDrawer } from "@/app/(private)/dashboard/booking-mice/_components/MiceBookingDrawer";
import { useLeads, useUpdateLeadStatus, useDeleteLead } from "@/hooks/use-leads";
import {
  convertLeadToDraftBooking,
  convertLeadToDraftMiceBooking,
} from "@/actions/lead-conversion";
import { DealConfirmModal } from "./DealConfirmModal";
import type { DealSelection } from "./DealConfirmModal";
import { LeadDetailModal } from "./LeadDetailModal";
import { useLeadStatuses } from "@/hooks/use-lead-statuses";
import type { LeadItem } from "@/lib/queries/leads";
import type { LeadListItem, BookingPrefillLead, ContactNumber } from "@/types/lead";
import type { LeadScope } from "@/lib/validations/lead";

export type { LeadItem };

// ─── Main orchestrator ────────────────────────────────────────────────────────

export function LeadsTable() {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<LeadScope>("active");
  const [statusFilter, setStatusFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadListItem | null>(null);
  // CreateLeadDrawer — new redesigned create flow (frontend-only for now)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadItem | null>(null);
  const [dealTarget, setDealTarget] = useState<LeadItem | null>(null);
  const [lostTarget, setLostTarget] = useState<LeadItem | null>(null);
  const [resetTarget, setResetTarget] = useState<LeadItem | null>(null);
  const [detailLead, setDetailLead] = useState<LeadItem | null>(null);
  const [isMarkingStatus, setIsMarkingStatus] = useState(false);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  // Booking creation from a lead — routed to wedding or MICE drawer by category.
  const [weddingPrefill, setWeddingPrefill] = useState<BookingPrefillLead | null>(null);
  const [micePrefill, setMicePrefill] = useState<BookingPrefillLead | null>(null);
  // initialDraftId injected from Deal flow — skips createDraftBooking on Step 1 "Continue"
  const [weddingInitialDraftId, setWeddingInitialDraftId] = useState<string | null>(null);
  const [miceInitialDraftId, setMiceInitialDraftId] = useState<string | null>(null);

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
      page: currentPage,
      pageSize,
    }),
    [search, scope, statusFilter, venueFilter, eventTypeFilter, currentPage, pageSize],
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
  function handleMarkDeal(lead: LeadItem) {
    // Block if already final — except when status is Deal (isSystem=true) but
    // the booking was deleted (convertedToBookingId = null). In that case, allow
    // re-deal so the user can recreate the draft without getting stuck.
    if (lead.status.isFinal) {
      const isDealWithoutBooking = lead.status.isSystem && !lead.convertedToBooking?.id;
      if (!isDealWithoutBooking) {
        toast.info("Lead sudah berstatus final.");
        return;
      }
    }
    setDealTarget(lead);
  }

  function handleMarkLost(lead: LeadItem) {
    if (lead.status.isFinal) { toast.info("Lead sudah berstatus final."); return; }
    setLostTarget(lead);
  }

  async function handleConfirmDeal(selection: DealSelection) {
    if (!dealTarget) return;
    if (!dealStatus) { toast.error("Status Deal tidak ditemukan."); return; }

    const lead = dealTarget;
    const category = lead.eventType?.category ?? lead.category;

    setIsMarkingStatus(true);

    // Check if lead already has a booking — reopen existing draft instead of creating duplicate
    if (lead.convertedToBooking?.id) {
      // Lead already converted — reopen existing booking drawer using the user's selection
      const prefill = buildPrefill(lead, selection);
      toast.info("Lead sudah punya booking. Membuka draft yang ada...");
      if (category === "MICE") {
        setMicePrefill(prefill);
        setMiceInitialDraftId(lead.convertedToBooking.id);
      } else {
        setWeddingPrefill(prefill);
        setWeddingInitialDraftId(lead.convertedToBooking.id);
      }
      setDealTarget(null);
      setIsMarkingStatus(false);
      return;
    }

    try {
      // Atomic: flip status to Deal + create the draft booking in one server action
      // (single db.$transaction). If booking creation fails, the status change rolls
      // back — no "floating Deal with no booking" slot. Route by category to the
      // matching permission (booking:create vs booking-mice:create).
      const prefill = buildPrefill(lead, selection);

      const draftRes =
        category === "MICE"
          ? await convertLeadToDraftMiceBooking({
              leadId: lead.id,
              eventDate: selection.eventDate,
              venueId: selection.venueId,
              miceSession: selection.session,
            })
          : await convertLeadToDraftBooking({
              leadId: lead.id,
              eventDate: selection.eventDate,
              venueId: selection.venueId,
              category,
              weddingSession: selection.session,
            });

      if (!draftRes.success || !draftRes.draftId) {
        // Failure → toast only. Do NOT open the drawer (no draft to resume).
        toast.error(draftRes.error ?? "Gagal mengkonversi lead menjadi Deal.");
        return;
      }

      toast.success(`${lead.name} ditandai sebagai Deal. Draft booking dibuat.`);

      // Success → open matching drawer with prefill + initialDraftId
      if (category === "MICE") {
        setMicePrefill(prefill);
        setMiceInitialDraftId(draftRes.draftId);
      } else {
        setWeddingPrefill(prefill);
        setWeddingInitialDraftId(draftRes.draftId);
      }

      setDealTarget(null);
    } catch {
      toast.error("Terjadi kesalahan saat memproses Deal.");
    } finally {
      setIsMarkingStatus(false);
    }
  }

  /**
   * Build the BookingPrefillLead payload.
   * When `selection` is provided (Deal flow), override venue/eventDate/weddingSession
   * with the user's chosen values so the booking drawer opens in a consistent state.
   */
  function buildPrefill(lead: LeadItem, selection?: DealSelection): BookingPrefillLead {
    // Resolve the venue object matching the selected venueId (could be primary or secondary)
    let resolvedVenue = lead.venue;
    if (selection) {
      if (lead.venue?.id === selection.venueId) {
        resolvedVenue = lead.venue;
      } else if (lead.venueSecondary?.id === selection.venueId) {
        resolvedVenue = lead.venueSecondary;
      }
    }

    // Resolve bookingFeeDate: DB stores as DateTime, convert to "YYYY-MM-DD" string
    const bookingFeeDateStr = lead.bookingFeeDate
      ? (() => {
          const d = new Date(lead.bookingFeeDate);
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, "0");
          const day = String(d.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })()
      : null;

    return {
      leadId: lead.id,
      name: lead.name,
      contactNumbers: (lead.contactNumbers as ContactNumber[] | null) ?? [],
      email: lead.email,
      address: lead.address,
      bitrixId: lead.bitrixId,
      // Override with selection if provided, else fall back to lead values
      eventDate: selection ? selection.eventDate : lead.eventDate,
      time: lead.time,
      estimatedPax: lead.estimatedPax,
      notes: lead.notes,
      weddingSession: selection ? selection.session : lead.weddingSession,
      venue: resolvedVenue ?? null,
      package: lead.package,
      eventType: lead.eventType,
      sourceOfInformation: lead.sourceOfInformation,
      assignedTo: lead.assignedTo,
      // Booking fee — only populated when lead has isDateLocked (received booking fee)
      bookingFeeAmount: lead.bookingFeeAmount ?? null,
      bookingFeeDate: bookingFeeDateStr,
      bookingFeeEvidenceUrl: lead.bookingFeeEvidenceUrl ?? null,
    };
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

      {/* Deal flow — wedding drawer (with initialDraftId injected) */}
      {weddingPrefill && (
        <BookingDrawer
          open={!!weddingPrefill}
          onOpenChange={(o) => {
            if (!o) {
              setWeddingPrefill(null);
              setWeddingInitialDraftId(null);
            }
          }}
          prefillLead={weddingPrefill}
          initialDraftId={weddingInitialDraftId}
          onSuccess={() => {
            setWeddingPrefill(null);
            setWeddingInitialDraftId(null);
            void refetchLeads();
          }}
        />
      )}

      {/* Deal flow — MICE drawer (with initialDraftId injected) */}
      {micePrefill && (
        <MiceBookingDrawer
          open={!!micePrefill}
          onOpenChange={(o) => {
            if (!o) {
              setMicePrefill(null);
              setMiceInitialDraftId(null);
            }
          }}
          booking={null}
          prefillLead={micePrefill}
          initialDraftId={miceInitialDraftId}
          onSuccess={() => {
            setMicePrefill(null);
            setMiceInitialDraftId(null);
            void refetchLeads();
          }}
        />
      )}

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

      {/* Deal confirm modal — replaces simple AlertDialog */}
      <DealConfirmModal
        lead={dealTarget}
        isProcessing={isMarkingStatus}
        onConfirm={handleConfirmDeal}
        onClose={() => setDealTarget(null)}
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
