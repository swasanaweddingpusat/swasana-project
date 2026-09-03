"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TrashBinTrash } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer } from "@/components/shared/drawer";
import { useRejectCandidate } from "@/hooks/use-candidates";

type RejectForm = {
  candidateId: string;
  reason: string;
};

interface RejectCandidateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: Array<{ id: string; fullName: string | null }>;
}

export function RejectCandidateDrawer({ isOpen, onClose, candidates }: RejectCandidateDrawerProps) {
  const rejectCandidateMutation = useRejectCandidate();

  const [form, setForm] = useState<RejectForm>({
    candidateId: "",
    reason: "",
  });

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setForm({ candidateId: "", reason: "" });
    }
  }

  const selectedCandidateId = form.candidateId || candidates[0]?.id || "";

  async function handleSubmit() {
    if (!selectedCandidateId || !form.reason.trim()) {
      toast.error("Kandidat dan alasan penolakan wajib diisi");
      return;
    }

    const result = await rejectCandidateMutation.mutateAsync({
      candidateId: selectedCandidateId,
      reason: form.reason.trim(),
    });

    if (result.success) {
      toast.success("Kandidat ditolak");
      setForm((current) => ({ ...current, reason: "" }));
      onClose();
      return;
    }

    toast.error(result.error ?? "Gagal menolak kandidat");
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Tolak Kandidat" maxWidth="sm:max-w-md">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-reject-candidate">Kandidat</Label>
          <select
            id="drawer-reject-candidate"
            value={selectedCandidateId}
            onChange={(event) => setForm((current) => ({ ...current, candidateId: event.target.value }))}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.fullName ?? "(Tanpa nama)"}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer-reject-reason">Alasan</Label>
          <Input
            id="drawer-reject-reason"
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Contoh: pengalaman belum sesuai kebutuhan"
          />
        </div>

        <Button
          variant="destructive"
          className="rounded-full gap-2 w-full"
          onClick={handleSubmit}
          disabled={rejectCandidateMutation.isPending}
        >
          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
          Tolak
        </Button>
      </div>
    </Drawer>
  );
}
