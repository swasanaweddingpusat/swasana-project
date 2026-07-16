"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AddCircle } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer } from "@/components/shared/drawer";
import { useCreateJobPosting } from "@/hooks/use-job-postings";

type JobPostingForm = {
  title: string;
  description: string;
  requirements: string;
  location: string;
  employmentType: string;
  salaryRangeMin: string;
  salaryRangeMax: string;
};

const EMPTY_FORM: JobPostingForm = {
  title: "",
  description: "",
  requirements: "",
  location: "",
  employmentType: "",
  salaryRangeMin: "",
  salaryRangeMax: "",
};

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

interface JobPostingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JobPostingDrawer({ isOpen, onClose }: JobPostingDrawerProps) {
  const [form, setForm] = useState<JobPostingForm>(EMPTY_FORM);
  const createJobPostingMutation = useCreateJobPosting();

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Judul lowongan wajib diisi");
      return;
    }

    const result = await createJobPostingMutation.mutateAsync({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      requirements: form.requirements.trim() || undefined,
      location: form.location.trim() || undefined,
      employmentType: form.employmentType || undefined,
      salaryRangeMin: toOptionalNumber(form.salaryRangeMin),
      salaryRangeMax: toOptionalNumber(form.salaryRangeMax),
    });

    if (result.success) {
      toast.success("Lowongan dibuat");
      setForm(EMPTY_FORM);
      onClose();
      return;
    }

    toast.error(result.error ?? "Gagal membuat lowongan");
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Buat Lowongan" maxWidth="sm:max-w-lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-job-title">Judul</Label>
          <Input
            id="drawer-job-title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Misal: HR Generalist"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-job-location">Lokasi</Label>
          <Input
            id="drawer-job-location"
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            placeholder="Jakarta"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="drawer-job-salary-min">Gaji minimum</Label>
            <Input
              id="drawer-job-salary-min"
              type="number"
              value={form.salaryRangeMin}
              onChange={(event) => setForm((current) => ({ ...current, salaryRangeMin: event.target.value }))}
              placeholder="8000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-job-salary-max">Gaji maksimum</Label>
            <Input
              id="drawer-job-salary-max"
              type="number"
              value={form.salaryRangeMax}
              onChange={(event) => setForm((current) => ({ ...current, salaryRangeMax: event.target.value }))}
              placeholder="12000000"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-job-employment-type">Tipe kerja</Label>
          <select
            id="drawer-job-employment-type"
            value={form.employmentType}
            onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value }))}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
          >
            <option value="">Pilih tipe</option>
            <option value="permanent">Permanent</option>
            <option value="contract">Kontrak</option>
            <option value="probation">Probation</option>
            <option value="intern">Magang</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-job-description">Deskripsi</Label>
          <Textarea
            id="drawer-job-description"
            rows={4}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Tugas utama dan konteks role"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawer-job-requirements">Persyaratan</Label>
          <Textarea
            id="drawer-job-requirements"
            rows={4}
            value={form.requirements}
            onChange={(event) => setForm((current) => ({ ...current, requirements: event.target.value }))}
            placeholder="Ringkas skill dan kualifikasi"
          />
        </div>
        <Button
          className="w-full rounded-full gap-2"
          onClick={handleSubmit}
          disabled={createJobPostingMutation.isPending}
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          Buat lowongan
        </Button>
      </div>
    </Drawer>
  );
}
