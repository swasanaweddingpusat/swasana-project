"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, CloseCircle, ClockCircle, PenNewSquare } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ApprovalStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRoleId: string | null;
  approverUserId: string | null;
  revisionId: string | null;
  status: string;
  signature: string | null;
  decidedAt: string | null;
  notes: string | null;
  approverRole: { id: string; name: string } | null;
  approverUser: { id: string; fullName: string | null } | null;
  decidedBy: { id: string; fullName: string | null } | null;
}

interface ApprovalRecord {
  id: string;
  status: string;
  signature: string | null;
  createdBy: { id: string; fullName: string | null };
  steps: ApprovalStep[];
}

interface ApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  packageId: string;
  packageName: string;
  userProfileId: string;
  userRoleId: string | null;
  isSuperAdmin?: boolean;
  /** Explicit reset permission override (booking callers use this via can("booking","reset-approval")).
   *  When provided, takes precedence over isSuperAdmin for the Reset button.
   *  Package/MICE callers omit this and rely on isSuperAdmin as before. */
  canReset?: boolean;
  module?: string;
}

export function ApprovalDialog({ open, onClose, packageId, packageName, userProfileId: _userProfileId, userRoleId: _userRoleId, isSuperAdmin, canReset, module = "package" }: ApprovalDialogProps) {
  const [record, setRecord] = useState<ApprovalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const fetchRecord = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/approval-records?module=${module}&entityId=${packageId}`);
      if (res.ok) setRecord(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [module, packageId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/approval-records?module=${module}&entityId=${packageId}`);
        if (res.ok && !cancelled) setRecord(await res.json());
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, module, packageId]);

  // Group steps by revisionId (null = initial round), pick the latest round.
  const latestRoundSteps = (() => {
    if (!record?.steps.length) return [];
    const groups = new Map<string, ApprovalStep[]>();
    for (const s of record.steps) {
      const key = s.revisionId ?? "__initial__";
      const g = groups.get(key) ?? [];
      g.push(s);
      groups.set(key, g);
    }
    // Last inserted group = latest revision (steps are sorted by createdAt asc)
    const keys = [...groups.keys()];
    const latestKey = keys[keys.length - 1];
    return (groups.get(latestKey) ?? []).sort((a, b) => a.stepOrder - b.stepOrder);
  })();

  const activeStep = latestRoundSteps.find((s) => s.status === "pending");

  async function handleResetStep(stepId: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/approval-records/reset-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error ?? "Gagal reset"); setSubmitting(false); return; }
      toast.success("Step berhasil di-reset");
      await qc.refetchQueries({ queryKey: ["packages"] });
      await qc.refetchQueries({ queryKey: ["package-approvals"] });
      fetchRecord();
    } catch { toast.error("Gagal reset step"); }
    setSubmitting(false);
  }


  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approval: {packageName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className={cn('h-12', 'w-full')} />)}
          </div>
        ) : !record ? (
          <p className={cn('text-sm', 'text-muted-foreground', 'text-center', 'py-4')}>Tidak ada data approval.</p>
        ) : (
          <div className="space-y-4">
            {/* Creator info */}
            <div className={cn('flex', 'items-center', 'gap-3', 'p-3', 'rounded-lg', 'border', 'bg-muted/30')}>
              <div className={cn('flex', 'items-center', 'justify-center', 'h-7', 'w-7', 'rounded-full', 'bg-primary', 'text-primary-foreground', 'shrink-0')}>
                <PenNewSquare weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />
              </div>
              <div className={cn('flex-1', 'min-w-0')}>
                <p className={cn('text-sm', 'font-medium')}>Dibuat oleh {record.createdBy.fullName}</p>
              </div>
            </div>

            {/* Steps timeline — only show latest round */}
            <div className="space-y-2">
              {latestRoundSteps.map((step) => (
                <div key={step.id} className={cn("flex items-center gap-3 p-3 rounded-lg border", step.status === "approved" && "bg-muted/50", step.status === "rejected" && "bg-destructive/5 border-destructive/20")}>
                  <div className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full shrink-0",
                    step.status === "approved" && "bg-primary text-primary-foreground",
                    step.status === "rejected" && "bg-destructive text-white",
                    step.status === "pending" && "bg-muted text-muted-foreground",
                  )}>
                    {step.status === "approved" ? <CheckCircle weight="BoldDuotone" className={cn('h-4', 'w-4')} /> : step.status === "rejected" ? <CloseCircle weight="BoldDuotone" className={cn('h-4', 'w-4')} /> : <ClockCircle weight="BoldDuotone" className={cn('h-3.5', 'w-3.5')} />}
                  </div>
                  <div className={cn('flex-1', 'min-w-0')}>
                    <p className={cn('text-sm', 'font-medium')}>
                      Step {step.stepOrder}: {step.approverType === "client" ? `Client — ${packageName}` : step.approverType === "role" ? step.approverRole?.name : step.approverUser?.fullName}
                    </p>
                    {step.status === "approved" && (step.decidedBy || step.approverType === "client") && (
                      <p className={cn('text-xs', 'text-muted-foreground')}>
                        {step.approverType === "client" ? "Ditandatangani oleh client" : `Disetujui oleh ${step.decidedBy?.fullName}`}
                        {step.decidedAt ? ` · ${new Date(step.decidedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
                      </p>
                    )}
                    {step.status === "rejected" && (
                      <div>
                        <p className={cn('text-xs', 'text-destructive')}>Ditolak{step.decidedBy ? ` oleh ${step.decidedBy.fullName}` : ""} {step.decidedAt ? `· ${new Date(step.decidedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                        {step.notes && <p className={cn('text-xs', 'text-destructive/80', 'mt-0.5')}>Alasan: {step.notes}</p>}
                      </div>
                    )}
                  </div>
                  {(canReset ?? isSuperAdmin) && step.status === "approved" && (
                    <button type="button" onClick={() => handleResetStep(step.id)} disabled={submitting} className={cn('text-xs', 'text-muted-foreground', 'hover:text-destructive', 'underline', 'shrink-0')}>
                      Reset
                    </button>
                  )}
                </div>
              ))}
            </div>

            {activeStep && (
              <p className={cn('text-sm', 'text-muted-foreground', 'text-center', 'py-2')}>
                Menunggu tanda tangan dari {activeStep.approverType === "role" ? activeStep.approverRole?.name : activeStep.approverUser?.fullName}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
