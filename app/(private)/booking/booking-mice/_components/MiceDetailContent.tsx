"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { CheckCircle, CloseCircle, ClockCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permissions";
import { ApprovalDialog } from "@/app/(private)/booking/packages/_components/approval-dialog";
import { ApproveModal } from "@/app/(private)/booking/packages/_components/approve-modal";
import { MiceStatusBadge } from "./mice-table";
import type { MiceBookingItem, MiceTerm } from "./types";

interface ApprovalStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRoleId: string | null;
  approverUserId: string | null;
  revisionId: string | null;
  status: string;
  approverRole: { id: string; name: string } | null;
  approverUser: { id: string; fullName: string | null } | null;
  decidedBy: { id: string; fullName: string | null } | null;
  decidedAt: string | null;
  notes: string | null;
}

interface ApprovalRecord {
  id: string;
  status: string;
  steps: ApprovalStep[];
  createdBy: { id: string; fullName: string | null };
}

interface MiceDetailContentProps {
  booking: MiceBookingItem;
  onEdit: () => void;
  onClose: () => void;
  showHeader?: boolean;
  closeLabel?: string;
}

function fmtRp(n: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd MMM yyyy");
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right text-foreground">
        {value}
      </span>
    </div>
  );
}

function TermRow({ term }: { term: MiceTerm }) {
  return (
    <div className="py-2.5 border-b border-border last:border-0 space-y-0.5">
      <div className="flex justify-between items-center gap-4">
        <span className="text-sm text-muted-foreground shrink-0">
          {term.name}
        </span>
        <span className="text-sm font-medium text-foreground">
          {fmtRp(term.amount)}
        </span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <span className="text-xs text-muted-foreground">
          Jatuh tempo: {fmtDate(term.dueDate)}
        </span>
      </div>
    </div>
  );
}

export function MiceDetailContent({
  booking,
  onEdit,
  onClose,
  showHeader = true,
  closeLabel = "Tutup",
}: MiceDetailContentProps) {
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { isAdmin } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<{ stepId: string; stepLabel: string } | null>(null);

  const { data: approval } = useQuery({
    queryKey: ["approval-records", "booking-mice", booking.id],
    queryFn: async () => {
      const res = await fetch(`/api/approval-records?module=booking-mice&entityId=${booking.id}`);
      if (!res.ok) return null;
      return res.json() as Promise<ApprovalRecord>;
    },
    staleTime: 15_000,
  });

  const allSteps: ApprovalStep[] = approval?.steps ?? [];
  const nonClientSteps = allSteps.filter((s: ApprovalStep) => s.approverType !== "client");
  const hasRecord = !!approval && nonClientSteps.length > 0;

  function stepLabel(s: ApprovalStep): string {
    return (s.approverType === "role" ? s.approverRole?.name : s.approverUser?.fullName) ?? "Approver";
  }

  function canActOn(s: ApprovalStep): boolean {
    return (
      s.status === "pending" &&
      (isAdmin ||
        (s.approverType === "role" && s.approverRoleId === user?.roleId) ||
        (s.approverType === "user" && s.approverUserId === user?.profileId))
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Status + PO */}
      {showHeader && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <MiceStatusBadge status={booking.status} />
          {booking.poNumber ? (
            <span className="font-mono text-xs text-muted-foreground">
              {booking.poNumber}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Belum ada PO</span>
          )}
        </div>
      )}

      {/* Approval */}
      {hasRecord && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Approval
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            {nonClientSteps.map((step: ApprovalStep) => {
              const actionable = canActOn(step);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 border-b border-border last:border-0",
                    step.status === "approved" && "bg-muted/30",
                    step.status === "rejected" && "bg-destructive/5",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded-full shrink-0",
                      step.status === "approved" && "bg-primary text-primary-foreground",
                      step.status === "rejected" && "bg-destructive text-white",
                      step.status === "pending" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.status === "approved" ? (
                      <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                    ) : step.status === "rejected" ? (
                      <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                    ) : (
                      <ClockCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{stepLabel(step)}</p>
                    {step.status === "approved" && step.decidedBy && (
                      <p className="text-xs text-muted-foreground">
                        Disetujui oleh {step.decidedBy.fullName}
                        {step.decidedAt
                          ? ` · ${new Date(step.decidedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
                          : ""}
                      </p>
                    )}
                    {step.status === "rejected" && (
                      <p className="text-xs text-destructive">
                        Ditolak{step.decidedBy ? ` oleh ${step.decidedBy.fullName}` : ""}
                        {step.notes ? ` — ${step.notes}` : ""}
                      </p>
                    )}
                  </div>
                  {actionable && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs"
                      onClick={() =>
                        setApproveTarget({ stepId: step.id, stepLabel: stepLabel(step) })
                      }
                    >
                      Approve
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="text-xs text-primary hover:underline mt-1"
          >
            Lihat detail progres approval
          </button>
        </div>
      )}

      {/* Client */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Client
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Nama" value={booking.customer.name} />
          <InfoRow label="Telepon" value={booking.customer.phone} />
        </div>
      </div>

      {/* Event */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Detail Event
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow label="Venue" value={booking.venue.name} />
          <InfoRow label="Tipe Event" value={booking.eventType?.name ?? "—"} />
          <InfoRow label="Tanggal Event" value={fmtDate(booking.eventDate)} />
          {booking.eventEndDate && (
            <InfoRow label="Tanggal Selesai" value={fmtDate(booking.eventEndDate)} />
          )}
          <InfoRow label="Estimasi Pax" value={booking.estimatedPax ? `${booking.estimatedPax} pax` : "—"} />
          <InfoRow
            label="Tanggal Booking"
            value={fmtDate(booking.createdAt)}
          />
          {booking.sourceOfInformation && (
            <InfoRow
              label="Sumber Informasi"
              value={booking.sourceOfInformation.name}
            />
          )}
        </div>
      </div>

      {/* Financial — terms */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Pembayaran
        </p>
        <div className="rounded-lg border border-border px-4">
          {booking.terms.length > 0 ? (
            booking.terms.map((term) => <TermRow key={term.id} term={term} />)
          ) : (
            <div className="py-2.5">
              <span className="text-sm text-muted-foreground italic">
                Belum ada term pembayaran
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quotation
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow
            label="Nomor"
            value={booking.quotation?.quotationNo ?? "Booking manual"}
          />
          {booking.quotation && (
            <InfoRow
              label="Nilai"
              value={fmtRp(booking.quotation.totalPrice)}
            />
          )}
        </div>
      </div>

      {/* Sales */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Sales
        </p>
        <div className="rounded-lg border border-border px-4 divide-y divide-border">
          <InfoRow
            label="Sales"
            value={booking.sales?.fullName ?? "—"}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {closeLabel}
        </Button>
        <Button className="flex-1" onClick={onEdit}>
          Edit Booking
        </Button>
      </div>

      {dialogOpen && user && (
        <ApprovalDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            void qc.invalidateQueries({ queryKey: ["approval-records", "booking-mice", booking.id] });
          }}
          packageId={booking.id}
          packageName={booking.customer.name}
          userProfileId={user.profileId}
          userRoleId={user.roleId}
          module="booking-mice"
        />
      )}
      {approveTarget && (
        <ApproveModal
          open={!!approveTarget}
          onClose={() => {
            setApproveTarget(null);
            void qc.invalidateQueries({ queryKey: ["approval-records", "booking-mice", booking.id] });
          }}
          stepId={approveTarget.stepId}
          stepLabel={approveTarget.stepLabel}
          packageName={booking.customer.name}
        />
      )}
    </div>
  );
}
