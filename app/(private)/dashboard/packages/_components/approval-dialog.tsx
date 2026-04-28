"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Check, X, Clock, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { approveStep, rejectStep } from "@/actions/approval";
import { useQueryClient } from "@tanstack/react-query";

interface ApprovalStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRoleId: string | null;
  approverUserId: string | null;
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
}

export function ApprovalDialog({ open, onClose, packageId, packageName, userProfileId, userRoleId }: ApprovalDialogProps) {
  const [record, setRecord] = useState<ApprovalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const fetchRecord = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/approval-records?module=package&entityId=${packageId}`);
      if (res.ok) setRecord(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [packageId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) fetchRecord();
  }, [open, fetchRecord]);

  const activeStep = record?.steps.find((s) => s.status === "pending");
  const canApprove = activeStep && (
    (activeStep.approverType === "role" && activeStep.approverRoleId === userRoleId) ||
    (activeStep.approverType === "user" && activeStep.approverUserId === userProfileId)
  );

  async function handleApprove() {
    if (!activeStep || !signature) { toast.error("Tanda tangan wajib diisi"); return; }
    setSubmitting(true);
    const res = await approveStep(activeStep.id, signature);
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Berhasil disetujui");
    qc.invalidateQueries({ queryKey: ["packages"] });
    onClose();
  }

  async function handleReject() {
    if (!activeStep || !rejectNotes.trim()) { toast.error("Alasan penolakan wajib diisi"); return; }
    setSubmitting(true);
    const res = await rejectStep(activeStep.id, rejectNotes);
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Package ditolak");
    qc.invalidateQueries({ queryKey: ["packages"] });
    onClose();
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
              <div className={cn('flex', 'items-center', 'justify-center', 'h-7', 'w-7', 'rounded-full', 'bg-black', 'text-white', 'shrink-0')}>
                <PenLine className={cn('h-3.5', 'w-3.5')} />
              </div>
              <div className={cn('flex-1', 'min-w-0')}>
                <p className={cn('text-sm', 'font-medium')}>Dibuat oleh {record.createdBy.fullName}</p>
              </div>
            </div>

            {/* Steps timeline */}
            <div className="space-y-2">
              {record.steps.map((step) => (
                <div key={step.id} className={cn("flex items-center gap-3 p-3 rounded-lg border", step.status === "approved" && "bg-muted/50", step.status === "rejected" && "bg-destructive/5 border-destructive/20")}>
                  <div className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full shrink-0",
                    step.status === "approved" && "bg-black text-white",
                    step.status === "rejected" && "bg-destructive text-white",
                    step.status === "pending" && "bg-muted text-muted-foreground",
                  )}>
                    {step.status === "approved" ? <Check className={cn('h-4', 'w-4')} /> : step.status === "rejected" ? <X className={cn('h-4', 'w-4')} /> : <Clock className={cn('h-3.5', 'w-3.5')} />}
                  </div>
                  <div className={cn('flex-1', 'min-w-0')}>
                    <p className={cn('text-sm', 'font-medium')}>
                      Step {step.stepOrder}: {step.approverType === "role" ? step.approverRole?.name : step.approverUser?.fullName}
                    </p>
                    {step.status === "approved" && step.decidedBy && (
                      <p className={cn('text-xs', 'text-muted-foreground')}>Disetujui oleh {step.decidedBy.fullName} {step.decidedAt ? `· ${new Date(step.decidedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                    )}
                    {step.status === "rejected" && (
                      <div>
                        <p className={cn('text-xs', 'text-destructive')}>Ditolak{step.decidedBy ? ` oleh ${step.decidedBy.fullName}` : ""} {step.decidedAt ? `· ${new Date(step.decidedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                        {step.notes && <p className={cn('text-xs', 'text-destructive/80', 'mt-0.5')}>Alasan: {step.notes}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Approve/Reject actions */}
            {canApprove && !showReject && (
              <div className={cn('space-y-3', 'border-t', 'pt-4')}>
                <SignaturePad onSignature={setSignature} />
                <div className={cn('flex', 'gap-2')}>
                  <Button variant="outline" onClick={() => setShowReject(true)} className={cn('flex-1', 'text-destructive', 'border-destructive', 'hover:bg-destructive/10')} disabled={submitting}>
                    Tolak
                  </Button>
                  <Button onClick={handleApprove} disabled={submitting || !signature} className="flex-1">
                    {submitting ? "Memproses..." : "Setujui"}
                  </Button>
                </div>
              </div>
            )}

            {canApprove && showReject && (
              <div className={cn('space-y-3', 'border-t', 'pt-4')}>
                <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Alasan penolakan..." className="text-sm" />
                <div className={cn('flex', 'gap-2')}>
                  <Button variant="outline" onClick={() => setShowReject(false)} className="flex-1" disabled={submitting}>
                    Batal
                  </Button>
                  <Button variant="destructive" onClick={handleReject} disabled={submitting || !rejectNotes.trim()} className="flex-1">
                    {submitting ? "Memproses..." : "Tolak Package"}
                  </Button>
                </div>
              </div>
            )}

            {!canApprove && activeStep && (
              <p className={cn('text-sm', 'text-muted-foreground', 'text-center', 'py-2')}>Menunggu approval dari {activeStep.approverType === "role" ? activeStep.approverRole?.name : activeStep.approverUser?.fullName}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
