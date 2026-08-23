"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { UserPlus } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer } from "@/components/shared/drawer";
import { useAddCandidate } from "@/hooks/use-candidates";

type CandidateForm = {
  jobPostingId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  expectedSalary: string;
};

interface CandidateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobPostings: Array<{ id: string; title: string }>;
}

export function CandidateDrawer({ isOpen, onClose, jobPostings }: CandidateDrawerProps) {
  const addCandidateMutation = useAddCandidate();

  const [form, setForm] = useState<CandidateForm>({
    jobPostingId: jobPostings[0]?.id ?? "",
    fullName: "",
    email: "",
    phoneNumber: "",
    expectedSalary: "",
  });

  useEffect(() => {
    if (jobPostings.length > 0 && !form.jobPostingId) {
      setForm((current) => ({ ...current, jobPostingId: jobPostings[0].id }));
    }
  }, [jobPostings]);

  useEffect(() => {
    if (isOpen && jobPostings.length > 0) {
      setForm({ jobPostingId: jobPostings[0].id, fullName: "", email: "", phoneNumber: "", expectedSalary: "" });
    }
  }, [isOpen]);

  async function handleSubmit() {
    if (!form.jobPostingId) {
      toast.error("Lowongan wajib dipilih");
      return;
    }

    const result = await addCandidateMutation.mutateAsync({
      jobPostingId: form.jobPostingId,
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim() || undefined,
      expectedSalary: form.expectedSalary ? Number(form.expectedSalary) : undefined,
    });

    if (result.success) {
      toast.success("Kandidat ditambahkan");
      setForm((current) => ({ ...current, fullName: "", email: "", phoneNumber: "", expectedSalary: "" }));
      onClose();
      return;
    }

    toast.error(result.error ?? "Gagal menambah kandidat");
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Tambah Kandidat" maxWidth="sm:max-w-md">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-candidate-job-posting">Lowongan</Label>
          <select
            id="drawer-candidate-job-posting"
            value={form.jobPostingId}
            onChange={(event) => setForm((current) => ({ ...current, jobPostingId: event.target.value }))}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
          >
            {jobPostings.map((posting) => (
              <option key={posting.id} value={posting.id}>
                {posting.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer-candidate-name">Nama</Label>
          <Input
            id="drawer-candidate-name"
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            placeholder="Nama kandidat"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer-candidate-email">Email</Label>
          <Input
            id="drawer-candidate-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="nama@email.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer-candidate-phone">Telepon</Label>
          <Input
            id="drawer-candidate-phone"
            value={form.phoneNumber}
            onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
            placeholder="0812xxxx"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="drawer-candidate-salary">Gaji Diharapkan</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              Rp
            </span>
            <Input
              id="drawer-candidate-salary"
              type="number"
              min={0}
              value={form.expectedSalary}
              onChange={(event) => setForm((current) => ({ ...current, expectedSalary: event.target.value }))}
              placeholder="5000000"
              className="pl-9"
            />
          </div>
        </div>

        <Button
          className="w-full rounded-full gap-2"
          onClick={handleSubmit}
          disabled={addCandidateMutation.isPending}
        >
          <UserPlus weight="BoldDuotone" className="h-4 w-4" />
          Tambah kandidat
        </Button>
      </div>
    </Drawer>
  );
}
