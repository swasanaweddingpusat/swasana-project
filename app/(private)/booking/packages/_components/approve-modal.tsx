"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/shared/signature-pad";
import { ApprovalWarningDialog } from "@/components/shared/approval-warning-dialog";
import { toast } from "sonner";
import { approveStep, rejectStep } from "@/actions/approval";
import { useQueryClient } from "@tanstack/react-query";
import { useMySignature } from "@/hooks/use-my-signature";
import { cn } from "@/lib/utils";

interface ApproveModalProps {
  open: boolean;
  onClose: () => void;
  stepId: string;
  stepLabel: string;
  packageName: string;
}

export function ApproveModal({ open, onClose, stepId, stepLabel, packageName }: ApproveModalProps) {
  const [signature, setSignature] = useState<string | null>(null);
  const [useDefaultSig, setUseDefaultSig] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();
  const { defaultSignature } = useMySignature();

  function handleClose() {
    setSignature(null);
    setUseDefaultSig(false);
    setRejectNotes("");
    setShowReject(false);
    setShowConfirm(false);
    onClose();
  }

  function openConfirm() {
    if (!signature) { toast.error("Tanda tangan wajib diisi"); return; }
    setShowConfirm(true);
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
        <p className={cn("text-sm", "text-muted-foreground")}>Package: <span className={cn("font-medium", "text-foreground")}>{packageName}</span></p>

        {!showReject ? (
          <div className="space-y-4">
            {/* Toggle: Gunakan Tanda Tangan Default */}
            <div className={cn("flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3")}>
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-foreground cursor-pointer">Gunakan Tanda Tangan Default Saya</Label>
                {!defaultSignature && (
                  <p className="text-xs text-muted-foreground">Atur dulu di Profil &rsaquo; Tanda Tangan Default</p>
                )}
              </div>
              <Switch
                checked={useDefaultSig}
                disabled={!defaultSignature}
                onCheckedChange={(checked) => {
                  setUseDefaultSig(checked);
                  if (checked && defaultSignature) {
                    setSignature(defaultSignature);
                  } else {
                    setSignature(null);
                  }
                }}
              />
            </div>

            {/* Manual pad — hanya tampil kalau toggle OFF */}
            {!useDefaultSig && (
              <SignaturePad onSignature={setSignature} />
            )}

            {/* Preview default signature kalau toggle ON */}
            {useDefaultSig && defaultSignature && (
              <div className={cn("rounded-xl border border-border bg-white p-3 flex items-center justify-center")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={defaultSignature} alt="Tanda tangan default" className="max-h-28 max-w-full object-contain" />
              </div>
            )}

            <div className={cn("flex", "gap-2")}>
              <Button variant="outline" onClick={() => setShowReject(true)} className={cn("flex-1", "text-destructive", "border-destructive", "hover:bg-destructive/10")} disabled={submitting}>
                Tolak
              </Button>
              <Button onClick={openConfirm} disabled={submitting || !signature} className="flex-1">
                {submitting ? "Memproses..." : "Setujui"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Alasan penolakan..." className="text-sm" />
            <div className={cn("flex", "gap-2")}>
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

      <ApprovalWarningDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Konfirmasi Persetujuan"
        description="Anda akan menyetujui tahap approval ini atas nama Anda."
        warnings={[
          "Tanda tangan Anda akan tercatat sebagai bukti persetujuan resmi pada dokumen ini.",
          "Setelah disetujui, tahap ini tidak bisa diubah tanpa proses reset approval oleh pihak yang berwenang.",
          "Jika terjadi perubahan pada booking — seperti paket, tanggal event, venue, harga, atau ketentuan pembayaran — setelah ditandatangani, tanda tangan Manager harus di-approve ulang untuk mengecek kembali setiap perubahan yang terjadi.",
          "Pastikan seluruh isi dokumen sudah benar karena keputusan ini mengikat.",
        ]}
        confirmLabel="Ya, Setujui"
        onConfirm={() => {
          setShowConfirm(false);
          void handleApprove();
        }}
        submitting={submitting}
      />
    </Dialog>
  );
}
