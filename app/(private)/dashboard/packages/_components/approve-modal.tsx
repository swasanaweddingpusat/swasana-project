"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/shared/signature-pad";
import { toast } from "sonner";
import { approveStep, rejectStep } from "@/actions/approval";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../../../../lib/utils";

interface ApproveModalProps {
  open: boolean;
  onClose: () => void;
  stepId: string;
  stepLabel: string;
  packageName: string;
}

export function ApproveModal({ open, onClose, stepId, stepLabel, packageName }: ApproveModalProps) {
  const [signature, setSignature] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  function handleClose() {
    setSignature(null);
    setRejectNotes("");
    setShowReject(false);
    onClose();
  }

  async function handleApprove() {
    if (!signature) { toast.error("Tanda tangan wajib diisi"); return; }
    setSubmitting(true);
    const res = await approveStep(stepId, signature);
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success(`${stepLabel} berhasil disetujui`);
    qc.invalidateQueries({ queryKey: ["packages"] });
    qc.invalidateQueries({ queryKey: ["package-approvals"] });
    handleClose();
  }

  async function handleReject() {
    if (!rejectNotes.trim()) { toast.error("Alasan penolakan wajib diisi"); return; }
    setSubmitting(true);
    const res = await rejectStep(stepId, rejectNotes);
    setSubmitting(false);
    if (!res.success) { toast.error(res.error); return; }
    toast.success("Package ditolak");
    qc.invalidateQueries({ queryKey: ["packages"] });
    qc.invalidateQueries({ queryKey: ["package-approvals"] });
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve {stepLabel}</DialogTitle>
        </DialogHeader>
        <p className={cn('text-sm', 'text-muted-foreground')}>Package: <span className={cn('font-medium', 'text-foreground')}>{packageName}</span></p>

        {!showReject ? (
          <div className="space-y-4">
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
        ) : (
          <div className="space-y-4">
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
      </DialogContent>
    </Dialog>
  );
}
