"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AddCircle, TrashBinTrash } from "@solar-icons/react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer } from "@/components/shared/drawer";
import { useCreateJobPosting, useUpdateJobPosting, useJobPostingDetail } from "@/hooks/use-job-postings";
import { useVenues } from "@/hooks/use-venues";
import { useDepartments } from "@/hooks/use-departments";
import { usePositions } from "@/hooks/use-positions";
import { useMyProfile } from "@/hooks/use-my-profile";
import type { JobPostingDetail } from "@/lib/queries/jobPostings";

type ApproverOption = {
  id: string;
  fullName: string;
};

type JobPostingForm = {
  title: string;
  employmentType: string;
  isWalkInInterview: boolean;
  companyName: string;
  submissionDate: string;
  interviewDate: string;
  // Section A
  departmentId: string;
  positionId: string;
  level: string;
  quota: string;
  interviewLocation: string;
  interviewLink: string;
  interviewVenueId: string;
  startDate: string;
  // Section B
  minEducation: string;
  minExperience: string;
  otherQualifications: string;
  jobDescriptions: string[];
  additionalNotes: string;
  approverId: string;
  approver2Id: string;
  // Legacy fields (kept for compatibility)
  location: string;
  salaryRangeMin: string;
  salaryRangeMax: string;
  description: string;
  requirements: string;
};

const EMPTY_FORM: JobPostingForm = {
  title: "",
  employmentType: "",
  isWalkInInterview: false,
  companyName: "",
  submissionDate: "",
  interviewDate: "",
  departmentId: "",
  positionId: "",
  level: "",
  quota: "",
  interviewLocation: "",
  interviewLink: "",
  interviewVenueId: "",
  startDate: "",
  minEducation: "",
  minExperience: "",
  otherQualifications: "",
  jobDescriptions: [""],
  additionalNotes: "",
  approverId: "",
  approver2Id: "",
  location: "",
  salaryRangeMin: "",
  salaryRangeMax: "",
  description: "",
  requirements: "",
};

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function uploadSignature(canvas: SignatureCanvas): Promise<string | null> {
  if (canvas.isEmpty()) return null;
  const dataUrl = canvas.toDataURL("image/png");
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const fd = new FormData();
  fd.append("file", blob, "signature.png");
  const uploadRes = await fetch("/api/upload/signature", { method: "POST", body: fd });
  if (!uploadRes.ok) return null;
  const { url } = (await uploadRes.json()) as { url: string };
  return url;
}

function detailToForm(detail: NonNullable<JobPostingDetail>): JobPostingForm {
  const toDateString = (v: Date | string | null | undefined) =>
    v ? new Date(v).toISOString().split("T")[0] : "";
  const descs = Array.isArray(detail.jobDescriptions)
    ? (detail.jobDescriptions as string[])
    : [];
  return {
    title: detail.title ?? "",
    employmentType: detail.employmentType ?? "",
    isWalkInInterview: detail.isWalkInInterview ?? false,
    companyName: detail.companyName ?? "",
    submissionDate: toDateString(detail.submissionDate),
    interviewDate: toDateString(detail.interviewDate),
    departmentId: detail.departmentId ?? "",
    positionId: detail.positionId ?? "",
    level: detail.level ?? "",
    quota: detail.quota != null ? String(detail.quota) : "",
    interviewLocation: detail.interviewLocation ?? "",
    interviewLink: detail.interviewLink ?? "",
    interviewVenueId: detail.interviewVenueId ?? "",
    startDate: toDateString(detail.startDate),
    minEducation: detail.minEducation ?? "",
    minExperience: detail.minExperience ?? "",
    otherQualifications: detail.otherQualifications ?? "",
    jobDescriptions: descs.length > 0 ? descs : [""],
    additionalNotes: detail.additionalNotes ?? "",
    approverId: detail.approverId ?? "",
    approver2Id: detail.approver2Id ?? "",
    location: detail.location ?? "",
    salaryRangeMin: detail.salaryRangeMin != null ? String(detail.salaryRangeMin) : "",
    salaryRangeMax: detail.salaryRangeMax != null ? String(detail.salaryRangeMax) : "",
    description: detail.description ?? "",
    requirements: detail.requirements ?? "",
  };
}

interface JobPostingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editId?: string;
}

export function JobPostingDrawer({ isOpen, onClose, editId }: JobPostingDrawerProps) {
  const isEditMode = !!editId;
  const [form, setForm] = useState<JobPostingForm>(EMPTY_FORM);
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const createJobPostingMutation = useCreateJobPosting();
  const updateJobPostingMutation = useUpdateJobPosting();

  const { data: editDetail } = useJobPostingDetail(editId ?? "");

  useEffect(() => {
    if (isEditMode && editDetail) {
      setForm(detailToForm(editDetail));
    }
  }, [isEditMode, editDetail]);

  const { data: venues = [] } = useVenues();
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions(form.departmentId || undefined);
  const { data: approvers = [] } = useQuery<ApproverOption[]>({
    queryKey: ["hr-approvers"],
    queryFn: async () => {
      const res = await fetch("/api/hr/approvers");
      if (!res.ok) throw new Error("Failed to fetch approvers");
      return res.json() as Promise<ApproverOption[]>;
    },
    staleTime: 10 * 60 * 1000,
  });
  const { data: myProfile } = useMyProfile();

  function setField<K extends keyof JobPostingForm>(key: K, value: JobPostingForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addJobDescription(): void {
    setField("jobDescriptions", [...form.jobDescriptions, ""]);
  }

  function updateJobDescription(index: number, value: string): void {
    const updated = form.jobDescriptions.map((item, i) => (i === index ? value : item));
    setField("jobDescriptions", updated);
  }

  function removeJobDescription(index: number): void {
    if (form.jobDescriptions.length <= 1) return;
    setField("jobDescriptions", form.jobDescriptions.filter((_, i) => i !== index));
  }

  function handleClose(): void {
    if (!isEditMode) setForm(EMPTY_FORM);
    sigCanvasRef.current?.clear();
    onClose();
  }

  async function handleSubmit(): Promise<void> {
    if (!form.title.trim()) {
      toast.error("Judul lowongan wajib diisi");
      return;
    }

    if (!form.approverId) {
      toast.error("Penyetuju 1 wajib dipilih");
      return;
    }
    if (!form.approver2Id) {
      toast.error("Penyetuju 2 wajib dipilih");
      return;
    }
    if (form.approverId === form.approver2Id) {
      toast.error("Penyetuju 1 dan 2 harus berbeda");
      return;
    }

    const loc = form.interviewLocation;
    if ((loc === "online" || loc === "hybrid") && !form.interviewLink.trim()) {
      toast.error("Link interview wajib diisi untuk lokasi online/hybrid");
      return;
    }
    if ((loc === "offline" || loc === "hybrid") && !form.interviewVenueId) {
      toast.error("Venue wajib dipilih untuk lokasi offline/hybrid");
      return;
    }

    let signatureUrl: string | null = null;
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      signatureUrl = await uploadSignature(sigCanvasRef.current);
      if (!signatureUrl) {
        toast.error("Gagal upload tanda tangan. Coba lagi.");
        return;
      }
    }

    const filteredDescriptions = form.jobDescriptions.filter((d) => d.trim().length > 0);

    const payload = {
      title: form.title.trim(),
      employmentType:
        (form.employmentType as "permanent" | "contract" | "probation" | "intern") || undefined,
      isWalkInInterview: form.isWalkInInterview,
      companyName: form.companyName.trim() || undefined,
      submissionDate: form.submissionDate ? new Date(form.submissionDate) : undefined,
      interviewDate: form.interviewDate ? new Date(form.interviewDate) : undefined,
      departmentId: form.departmentId || undefined,
      positionId: form.positionId || undefined,
      level:
        (form.level as "entry" | "junior" | "mid" | "senior" | "lead" | "manager" | "director") ||
        undefined,
      quota: toOptionalNumber(form.quota),
      interviewLocation:
        (form.interviewLocation as "online" | "offline" | "hybrid") || undefined,
      interviewLink: form.interviewLink.trim() || undefined,
      interviewVenueId: form.interviewVenueId || undefined,
      startDate: form.startDate ? new Date(form.startDate) : undefined,
      minEducation: form.minEducation.trim() || undefined,
      minExperience: form.minExperience.trim() || undefined,
      otherQualifications: form.otherQualifications.trim() || undefined,
      jobDescriptions: filteredDescriptions.length > 0 ? filteredDescriptions : undefined,
      additionalNotes: form.additionalNotes.trim() || undefined,
      approverId: form.approverId || undefined,
      approver2Id: form.approver2Id || undefined,
      submittedBySignature: signatureUrl ?? undefined,
      location: form.location.trim() || undefined,
      salaryRangeMin: toOptionalNumber(form.salaryRangeMin),
      salaryRangeMax: toOptionalNumber(form.salaryRangeMax),
      description: form.description.trim() || undefined,
      requirements: form.requirements.trim() || undefined,
    };

    if (isEditMode && editId) {
      const result = await updateJobPostingMutation.mutateAsync({ id: editId, data: payload });
      if (result.success) {
        toast.success("Lowongan diperbarui");
        handleClose();
        return;
      }
      toast.error(result.error ?? "Gagal memperbarui lowongan");
      return;
    }

    const result = await createJobPostingMutation.mutateAsync(payload);

    if (result.success) {
      toast.success("Lowongan dibuat");
      handleClose();
      return;
    }

    toast.error(result.error ?? "Gagal membuat lowongan");
  }

  const isPending = isEditMode ? updateJobPostingMutation.isPending : createJobPostingMutation.isPending;

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title={isEditMode ? "Edit Lowongan" : "Buat Lowongan"} maxWidth="sm:max-w-2xl">
      <div className="space-y-6 pb-6">
        {/* Header fields */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-title">
                Judul <span className="text-destructive">*</span>
              </Label>
              <Input
                id="jp-title"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Misal: HR Generalist"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-employment-type">Tipe Kerja</Label>
              <select
                id="jp-employment-type"
                value={form.employmentType}
                onChange={(e) => setField("employmentType", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Pilih tipe</option>
                <option value="permanent">Permanent</option>
                <option value="contract">Kontrak</option>
                <option value="probation">Probation</option>
                <option value="intern">Magang</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="jp-walkin"
              checked={form.isWalkInInterview}
              onCheckedChange={(checked) => setField("isWalkInInterview", checked === true)}
            />
            <Label htmlFor="jp-walkin" className="cursor-pointer">
              Walk-in Interview
            </Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-company">Perusahaan</Label>
              <Input
                id="jp-company"
                value={form.companyName}
                onChange={(e) => setField("companyName", e.target.value)}
                placeholder="Nama perusahaan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-submission-date">Tanggal Pengajuan</Label>
              <Input
                id="jp-submission-date"
                type="date"
                value={form.submissionDate}
                onChange={(e) => setField("submissionDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jp-interview-date">Tanggal Interview</Label>
            <Input
              id="jp-interview-date"
              type="date"
              value={form.interviewDate}
              onChange={(e) => setField("interviewDate", e.target.value)}
            />
          </div>
        </div>

        {/* Section A */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground border-b border-border pb-2">
            A. PENGAJUAN
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-dept">Divisi</Label>
              <select
                id="jp-dept"
                value={form.departmentId}
                onChange={(e) => {
                  setField("departmentId", e.target.value);
                  setField("positionId", "");
                }}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Pilih divisi</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-pos">Posisi</Label>
              <select
                id="jp-pos"
                value={form.positionId}
                onChange={(e) => setField("positionId", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
                disabled={!form.departmentId}
              >
                <option value="">Pilih posisi</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-level">Level</Label>
              <select
                id="jp-level"
                value={form.level}
                onChange={(e) => setField("level", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Pilih level</option>
                <option value="entry">Entry</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="manager">Manager</option>
                <option value="director">Director</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-quota">Kuota</Label>
              <Input
                id="jp-quota"
                type="number"
                min={1}
                value={form.quota}
                onChange={(e) => setField("quota", e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-salary-min">Ekspektasi Gaji Min</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <Input
                  id="jp-salary-min"
                  type="number"
                  min={0}
                  value={form.salaryRangeMin}
                  onChange={(e) => setField("salaryRangeMin", e.target.value)}
                  placeholder="0"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-salary-max">Ekspektasi Gaji Maks</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <Input
                  id="jp-salary-max"
                  type="number"
                  min={0}
                  value={form.salaryRangeMax}
                  onChange={(e) => setField("salaryRangeMax", e.target.value)}
                  placeholder="0"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-interview-loc">Lokasi Interview</Label>
              <select
                id="jp-interview-loc"
                value={form.interviewLocation}
                onChange={(e) => {
                  const next = e.target.value;
                  setForm((c) => ({
                    ...c,
                    interviewLocation: next,
                    interviewLink: next === "online" || next === "hybrid" ? c.interviewLink : "",
                    interviewVenueId: next === "offline" || next === "hybrid" ? c.interviewVenueId : "",
                  }));
                }}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Pilih lokasi</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-start-date">Tanggal Mulai Kerja</Label>
              <Input
                id="jp-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
              />
            </div>
          </div>

          {(form.interviewLocation === "online" || form.interviewLocation === "hybrid") && (
            <div className="space-y-2">
              <Label htmlFor="jp-interview-link">Link Interview (Meet/Zoom)</Label>
              <Input
                id="jp-interview-link"
                value={form.interviewLink}
                onChange={(e) => setField("interviewLink", e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </div>
          )}

          {(form.interviewLocation === "offline" || form.interviewLocation === "hybrid") && (
            <div className="space-y-2">
              <Label htmlFor="jp-interview-venue">Venue Interview</Label>
              <select
                id="jp-interview-venue"
                value={form.interviewVenueId}
                onChange={(e) => setField("interviewVenueId", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Pilih venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Section B */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground border-b border-border pb-2">
            B. KUALIFIKASI
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-edu">Pendidikan Minimal</Label>
              <Input
                id="jp-edu"
                value={form.minEducation}
                onChange={(e) => setField("minEducation", e.target.value)}
                placeholder="Misal: S1 semua jurusan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-exp">Pengalaman Minimal</Label>
              <Input
                id="jp-exp"
                value={form.minExperience}
                onChange={(e) => setField("minExperience", e.target.value)}
                placeholder="Misal: 2 tahun"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jp-other-qual">Kualifikasi Lainnya</Label>
            <Textarea
              id="jp-other-qual"
              rows={3}
              value={form.otherQualifications}
              onChange={(e) => setField("otherQualifications", e.target.value)}
              placeholder="Keterampilan tambahan yang dibutuhkan"
            />
          </div>

          <div className="space-y-2">
            <Label>Deskripsi Pekerjaan</Label>
            <div className="space-y-2">
              {form.jobDescriptions.map((desc, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={desc}
                    onChange={(e) => updateJobDescription(index, e.target.value)}
                    placeholder={`Deskripsi ${index + 1}`}
                  />
                  {form.jobDescriptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeJobDescription(index)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addJobDescription}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Deskripsi
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jp-notes">Catatan Tambahan</Label>
            <Textarea
              id="jp-notes"
              rows={3}
              value={form.additionalNotes}
              onChange={(e) => setField("additionalNotes", e.target.value)}
              placeholder="Informasi tambahan untuk kandidat"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jp-approver1">Yang Menyetujui 1</Label>
              <select
                id="jp-approver1"
                value={form.approverId}
                onChange={(e) => setField("approverId", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Pilih penyetuju 1</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-approver2">Yang Menyetujui 2</Label>
              <select
                id="jp-approver2"
                value={form.approver2Id}
                onChange={(e) => setField("approver2Id", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none"
              >
                <option value="">Pilih penyetuju 2</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section C */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground border-b border-border pb-2">
            C. DIAJUKAN OLEH
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={myProfile?.fullName ?? ""}
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label>Posisi</Label>
              <Input
                value={myProfile?.position?.name ?? ""}
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Divisi</Label>
            <Input
              value={myProfile?.department?.name ?? ""}
              readOnly
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label>Tanda Tangan</Label>
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="black"
                canvasProps={{ className: "w-full", height: 160 }}
              />
            </div>
            <button
              type="button"
              onClick={() => sigCanvasRef.current?.clear()}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Hapus tanda tangan
            </button>
          </div>
        </div>

        <Button
          className="w-full rounded-full gap-2"
          onClick={handleSubmit}
          disabled={isPending}
        >
          <AddCircle weight="BoldDuotone" className="h-4 w-4" />
          {isPending ? "Menyimpan..." : isEditMode ? "Simpan Perubahan" : "Buat Lowongan"}
        </Button>
      </div>
    </Drawer>
  );
}
