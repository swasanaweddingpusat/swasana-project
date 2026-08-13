"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AddCircle, ArrowRight, Buildings, CheckCircle, ClipboardText, CloseCircle, Copy, Export, Eye, Link, Pen, Refresh, TrashBinTrash, UserMinus, UserPlus, UsersGroupRounded } from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCandidates, useHireCandidate, useMoveCandidateStage } from "@/hooks/use-candidates";
import { useEmployees } from "@/hooks/use-employees";
import { useCloseJobPosting, useJobPostings, usePublishJobPosting } from "@/hooks/use-job-postings";
import { useOnboardingTemplates, useOnboardingAssignments, useMyOnboarding, useCompleteOnboardingTask } from "@/hooks/use-onboarding";
import { useExStaff } from "@/hooks/use-ex-staff";
import { useRecruitmentRequests, useRegenerateFormLink, useRevokeFormLink } from "@/hooks/use-recruitment-requests";
import type { CandidateItem } from "@/lib/queries/candidates";
import type { ExStaffItem } from "@/lib/queries/exStaff";
import type { RecruitmentRequestItem } from "@/lib/queries/recruitmentRequests";
import type { JobPostingItem } from "@/lib/queries/jobPostings";
import type { MyOnboardingAssignment, OnboardingAssignmentItem, OnboardingTemplateItem } from "@/lib/queries/onboarding";
import { JobPostingDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/JobPostingDrawer";
import { OnboardingTemplateDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/OnboardingTemplateDrawer";
import { AssignOnboardingDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/AssignOnboardingDrawer";
import { CandidateDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/CandidateDrawer";
import { RejectCandidateDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/RejectCandidateDrawer";
import { RecruitmentRequestDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/RecruitmentRequestDrawer";
import { BlacklistDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/BlacklistDrawer";
import { RecruitmentRequestDetailDrawer } from "@/app/(private)/hrd/rekrutmen-onboarding/_components/RecruitmentRequestDetailDrawer";
import { useBlacklistEntries, useDeleteBlacklistEntry } from "@/hooks/use-blacklist";
import type { BlacklistEntryItem } from "@/lib/queries/blacklistEntries";

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  assessment: "Assessment",
  offering: "Offering",
  hired: "Hired",
  rejected: "Rejected",
};

const STAGE_OPTIONS = ["applied", "screening", "interview", "assessment", "offering"];

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function countCompletedTasks(assignment: OnboardingAssignmentItem | MyOnboardingAssignment | null | undefined): number {
  if (!assignment?.tasks) return 0;
  return assignment.tasks.filter((task) => task.isCompleted).length;
}

function countTotalTasks(assignment: OnboardingAssignmentItem | MyOnboardingAssignment | null | undefined): number {
  if (!assignment?.tasks) return 0;
  return assignment.tasks.length;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-heading font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function RekrutmenOnboardingClient() {
  const { data: jobPostings = [] } = useJobPostings();
  const { data: employeesResult } = useEmployees({ page: 1, limit: 200, status: "active" });
  const { data: candidates = [] } = useCandidates();
  const { data: templates = [] } = useOnboardingTemplates();
  const { data: assignments = [] } = useOnboardingAssignments();
  const { data: myOnboarding } = useMyOnboarding();
  const { data: exStaffList = [] } = useExStaff();
  const { data: blacklistEntries = [] } = useBlacklistEntries();
  const { data: recruitmentRequests = [] } = useRecruitmentRequests();

  const publishJobPostingMutation = usePublishJobPosting();
  const closeJobPostingMutation = useCloseJobPosting();
  const moveCandidateStageMutation = useMoveCandidateStage();
  const hireCandidateMutation = useHireCandidate();
  const completeTaskMutation = useCompleteOnboardingTask();
  const deleteBlacklistMutation = useDeleteBlacklistEntry();
  const regenerateFormLinkMutation = useRegenerateFormLink();
  const revokeFormLinkMutation = useRevokeFormLink();

  const employees = useMemo(() => employeesResult?.data ?? [], [employeesResult?.data]);

  function handleViewJobPostingCandidates(jobPostingId: string) {
    setSelectedJobPostingId(jobPostingId);
    setCandidatePostingFilter(jobPostingId);
    setActiveTab("kandidat");
  }

  const [jobPostingDrawerOpen, setJobPostingDrawerOpen] = useState(false);
  const [candidatePostingFilter, setCandidatePostingFilter] = useState("all");
  const [candidateStageFilter, setCandidateStageFilter] = useState("all");
  const [candidateStageDrafts, setCandidateStageDrafts] = useState<Record<string, string>>({});
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [candidateDrawerOpen, setCandidateDrawerOpen] = useState(false);
  const [rejectDrawerOpen, setRejectDrawerOpen] = useState(false);
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [recruitmentRequestDrawerOpen, setRecruitmentRequestDrawerOpen] = useState(false);
  const [blacklistDrawerOpen, setBlacklistDrawerOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RecruitmentRequestItem | null>(null);
  const [activeTab, setActiveTab] = useState("lowongan");
  const [_selectedJobPostingId, setSelectedJobPostingId] = useState<string | null>(null);

  useEffect(() => {
    setCandidateStageDrafts((current) => {
      const next = { ...current };
      let hasChanges = false;
      for (const candidate of candidates) {
        if (!next[candidate.id]) {
          next[candidate.id] = candidate.stage;
          hasChanges = true;
        }
      }
      return hasChanges ? next : current;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.length]);

  const visibleCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      if (candidatePostingFilter !== "all" && candidate.jobPostingId !== candidatePostingFilter) return false;
      if (candidateStageFilter !== "all" && candidate.stage !== candidateStageFilter) return false;
      return true;
    });
  }, [candidates, candidatePostingFilter, candidateStageFilter]);

  const stats = useMemo(() => {
    return {
      openJobPostings: jobPostings.filter((item) => item.status === "open").length,
      activeCandidates: candidates.filter((item) => item.stage !== "hired" && item.stage !== "rejected").length,
      activeTemplates: templates.filter((item) => item.isActive).length,
      activeAssignments: assignments.filter((item) => item.status === "in_progress").length,
    };
  }, [jobPostings, candidates, templates, assignments]);

  const totalTasks = countTotalTasks(myOnboarding);
  const completedTasks = countCompletedTasks(myOnboarding);

  async function handleMoveCandidateStage(candidateId: string) {
    const stage = candidateStageDrafts[candidateId];
    if (!stage) {
      toast.error("Tahap kandidat belum dipilih");
      return;
    }

    const result = await moveCandidateStageMutation.mutateAsync({ candidateId, stage });
    if (result.success) {
      toast.success("Tahap kandidat diperbarui");
      return;
    }

    toast.error(result.error ?? "Gagal memperbarui tahap kandidat");
  }

  async function handleHireCandidate(candidateId: string) {
    const result = await hireCandidateMutation.mutateAsync(candidateId);
    if (result.success) {
      toast.success(result.message ?? "Kandidat diterima");
      return;
    }

    toast.error(result.error ?? "Gagal menerima kandidat");
  }

  async function handleCompleteTask(taskId: string) {
    const result = await completeTaskMutation.mutateAsync(taskId);
    if (result.success) {
      toast.success("Task onboarding selesai");
      return;
    }

    toast.error(result.error ?? "Gagal menyelesaikan task");
  }

  async function handleDeleteBlacklistEntry(id: string) {
    const result = await deleteBlacklistMutation.mutateAsync(id);
    if (result.success) {
      toast.success("Data berhasil dihapus dari blacklist");
      return;
    }

    toast.error(result.error ?? "Gagal menghapus data blacklist");
  }

  async function handleRegenerateFormLink(recruitmentRequestId: string) {
    const result = await regenerateFormLinkMutation.mutateAsync(recruitmentRequestId);
    if (result.success) {
      toast.success("Link form berhasil diperbarui");
      return;
    }
    toast.error(result.error ?? "Gagal memperbarui link form");
  }

  async function handleRevokeFormLink(recruitmentRequestId: string) {
    const result = await revokeFormLinkMutation.mutateAsync(recruitmentRequestId);
    if (result.success) {
      toast.success("Link form berhasil dinonaktifkan");
      return;
    }
    toast.error(result.error ?? "Gagal menonaktifkan link form");
  }

  function handleCopyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} disalin ke clipboard`);
    }).catch(() => {
      toast.error("Gagal menyalin ke clipboard");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-foreground">Rekrutmen & Onboarding</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Kelola lowongan, kandidat, dan onboarding dari satu halaman.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">{stats.openJobPostings} lowongan aktif</Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">{stats.activeCandidates} kandidat proses</Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">{stats.activeAssignments} onboarding berjalan</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl shadow-sm"><CardContent className="flex items-start gap-3 p-5"><div className="rounded-full bg-muted p-3 text-foreground"><Buildings weight="BoldDuotone" className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Lowongan aktif</p><p className="text-2xl font-heading font-semibold">{stats.openJobPostings}</p></div></CardContent></Card>
        <Card className="rounded-2xl shadow-sm"><CardContent className="flex items-start gap-3 p-5"><div className="rounded-full bg-muted p-3 text-foreground"><UserPlus weight="BoldDuotone" className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Kandidat aktif</p><p className="text-2xl font-heading font-semibold">{stats.activeCandidates}</p></div></CardContent></Card>
        <Card className="rounded-2xl shadow-sm"><CardContent className="flex items-start gap-3 p-5"><div className="rounded-full bg-muted p-3 text-foreground"><AddCircle weight="BoldDuotone" className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Template onboarding</p><p className="text-2xl font-heading font-semibold">{stats.activeTemplates}</p></div></CardContent></Card>
        <Card className="rounded-2xl shadow-sm"><CardContent className="flex items-start gap-3 p-5"><div className="rounded-full bg-muted p-3 text-foreground"><CheckCircle weight="BoldDuotone" className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Onboarding saya</p><p className="text-2xl font-heading font-semibold">{myOnboarding ? `${completedTasks}/${totalTasks}` : "-"}</p></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-col gap-1 rounded-2xl p-1 sm:grid sm:grid-cols-3 sm:gap-0 lg:grid-cols-6">
          <TabsTrigger value="lowongan" className="rounded-xl gap-2"><Buildings weight="BoldDuotone" className="h-4 w-4" />Lowongan</TabsTrigger>
          <TabsTrigger value="kandidat" className="rounded-xl gap-2"><UserPlus weight="BoldDuotone" className="h-4 w-4" />Kandidat</TabsTrigger>
          <TabsTrigger value="onboarding" className="rounded-xl gap-2"><CheckCircle weight="BoldDuotone" className="h-4 w-4" />Onboarding</TabsTrigger>
          <TabsTrigger value="recruitment-request" className="rounded-xl gap-2"><ClipboardText weight="BoldDuotone" className="h-4 w-4" />Recruitment Request</TabsTrigger>
          <TabsTrigger value="blacklist" className="rounded-xl gap-2"><CloseCircle weight="BoldDuotone" className="h-4 w-4" />Blacklist</TabsTrigger>
          <TabsTrigger value="ex-staff" className="rounded-xl gap-2"><UserMinus weight="BoldDuotone" className="h-4 w-4" />Ex-Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="lowongan" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="rounded-full gap-2" onClick={() => setJobPostingDrawerOpen(true)}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />Buat lowongan
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2"><CardTitle className="text-lg font-heading">Daftar lowongan</CardTitle><p className="text-sm text-muted-foreground">Status lowongan, kandidat, dan aksi cepat publish/close.</p></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Lowongan</TableHead><TableHead>Status</TableHead><TableHead>Kandidat</TableHead><TableHead>Detail</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {jobPostings.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Belum ada lowongan.</TableCell></TableRow>
                    ) : jobPostings.map((posting: JobPostingItem) => (
                      <TableRow
                        key={posting.id}
                        onClick={() => handleViewJobPostingCandidates(posting.id)}
                        className="group cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <TableCell><div className="flex flex-col gap-0.5"><button onClick={(e) => { e.stopPropagation(); handleViewJobPostingCandidates(posting.id); }} className="font-medium text-foreground hover:text-primary hover:underline text-left transition-colors">{posting.title}</button><span className="text-xs text-muted-foreground">{posting.department?.name ?? posting.position?.name ?? "Umum"}</span></div></TableCell>
                        <TableCell><Badge variant={posting.status === "open" ? "default" : "secondary"} className="rounded-full">{posting.status === "open" ? "Open" : posting.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center justify-between gap-2">
                            <span>{posting._count.candidates} kandidat</span>
                            <ArrowRight weight="BoldDuotone" className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TableCell>
                        <TableCell><div className="flex flex-col gap-0.5 text-xs text-muted-foreground"><span>{posting.location ?? "Lokasi belum diisi"}</span><span>{formatCurrency(posting.salaryRangeMin ? Number(posting.salaryRangeMin) : null)} - {formatCurrency(posting.salaryRangeMax ? Number(posting.salaryRangeMax) : null)}</span><span>Open: {formatDate(posting.openDate)}</span></div></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {posting.status === "open" ? (
                              <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={async () => {
                                const result = await closeJobPostingMutation.mutateAsync(posting.id);
                                if (result.success) toast.success("Lowongan ditutup"); else toast.error(result.error ?? "Gagal menutup lowongan");
                              }} disabled={closeJobPostingMutation.isPending}><TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />Close</Button>
                            ) : (
                              <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={async () => {
                                const result = await publishJobPostingMutation.mutateAsync(posting.id);
                                if (result.success) toast.success("Lowongan dipublikasikan"); else toast.error(result.error ?? "Gagal publish lowongan");
                              }} disabled={publishJobPostingMutation.isPending}><ArrowRight weight="BoldDuotone" className="h-4 w-4" />Publish</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kandidat" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="destructive" className="rounded-full gap-2" onClick={() => setRejectDrawerOpen(true)}>
              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />Tolak Kandidat
            </Button>
            <Button className="rounded-full gap-2" onClick={() => setCandidateDrawerOpen(true)}>
              <UserPlus weight="BoldDuotone" className="h-4 w-4" />Tambah Kandidat
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <SectionTitle title="Pipeline kandidat" description="Filter kandidat berdasarkan lowongan dan tahap proses." />
                <div className="flex flex-wrap gap-2">
                  <select value={candidatePostingFilter} onChange={(event) => setCandidatePostingFilter(event.target.value)} className="h-10 rounded-full border border-input bg-background px-3 text-sm outline-none"><option value="all">Semua lowongan</option>{jobPostings.map((posting) => <option key={posting.id} value={posting.id}>{posting.title}</option>)}</select>
                  <select value={candidateStageFilter} onChange={(event) => setCandidateStageFilter(event.target.value)} className="h-10 rounded-full border border-input bg-background px-3 text-sm outline-none"><option value="all">Semua tahap</option>{Object.entries(STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Kandidat</TableHead><TableHead>Lowongan</TableHead><TableHead>Tahap</TableHead><TableHead>Rating</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleCandidates.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Belum ada kandidat untuk filter ini.</TableCell></TableRow>
                    ) : visibleCandidates.map((candidate: CandidateItem) => (
                      <TableRow key={candidate.id}>
                        <TableCell><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">{getInitials(candidate.fullName)}</div><div className="flex flex-col gap-0.5"><span className="font-medium text-foreground">{candidate.fullName}</span><span className="text-xs text-muted-foreground">{candidate.email}</span></div></div></TableCell>
                        <TableCell>{candidate.jobPosting?.title ?? "-"}</TableCell>
                        <TableCell><Badge variant={candidate.stage === "hired" ? "default" : candidate.stage === "rejected" ? "destructive" : "secondary"} className="rounded-full">{STAGE_LABELS[candidate.stage] ?? candidate.stage}</Badge></TableCell>
                        <TableCell>{candidate.rating ? `${candidate.rating}/5` : "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            <select value={candidateStageDrafts[candidate.id] ?? candidate.stage} onChange={(event) => setCandidateStageDrafts((current) => ({ ...current, [candidate.id]: event.target.value }))} className="h-10 rounded-full border border-input bg-background px-3 text-sm outline-none">{STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select>
                            <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => handleMoveCandidateStage(candidate.id)}><Pen weight="BoldDuotone" className="h-4 w-4" />Pindah tahap</Button>
                            <Button size="sm" className="rounded-full gap-1.5" onClick={() => handleHireCandidate(candidate.id)}><CheckCircle weight="BoldDuotone" className="h-4 w-4" />Hire</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full gap-2" onClick={() => setAssignDrawerOpen(true)}>
              <ArrowRight weight="BoldDuotone" className="h-4 w-4" />Tugaskan Onboarding
            </Button>
            <Button className="rounded-full gap-2" onClick={() => setTemplateDrawerOpen(true)}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />Buat Template
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2"><CardTitle className="text-lg font-heading">Template & penugasan</CardTitle><p className="text-sm text-muted-foreground">Lihat template yang tersedia dan penugasan onboarding terbaru.</p></CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {templates.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Belum ada template onboarding.</div> : templates.map((template: OnboardingTemplateItem) => (
                  <div key={template.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1"><div className="flex items-center gap-2"><p className="font-medium text-foreground">{template.name}</p>{template.isDefault ? <Badge className="rounded-full">Default</Badge> : null}</div><p className="text-sm text-muted-foreground">{template.description || "Tidak ada deskripsi"}</p></div>
                      <Badge variant={template.isActive ? "default" : "secondary"} className="rounded-full">{template.isActive ? "Aktif" : "Nonaktif"}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="rounded-full">{template._count.tasks} task</Badge><Badge variant="secondary" className="rounded-full">{template._count.assignments} assignment</Badge></div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {assignments.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Belum ada penugasan onboarding.</div> : assignments.map((assignment: OnboardingAssignmentItem) => {
                  const completed = countCompletedTasks(assignment);
                  const total = countTotalTasks(assignment);
                  return (
                    <div key={assignment.id} className="rounded-2xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3"><div className="space-y-1"><p className="font-medium text-foreground">{assignment.profile.fullName}</p><p className="text-sm text-muted-foreground">{assignment.template.name}</p></div><Badge variant={assignment.status === "completed" ? "default" : "secondary"} className="rounded-full">{assignment.status}</Badge></div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary" className="rounded-full">{completed}/{total} selesai</Badge><span>Mulai: {formatDate(assignment.startDate)}</span></div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2"><CardTitle className="text-lg font-heading">Onboarding saya</CardTitle><p className="text-sm text-muted-foreground">Task yang sedang berjalan untuk akun yang login.</p></CardHeader>
            <CardContent>
              {!myOnboarding ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Tidak ada onboarding aktif untuk akun ini.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Badge variant="secondary" className="rounded-full">{myOnboarding.template.name}</Badge><span>Mulai: {formatDate(myOnboarding.startDate)}</span><span>Selesai: {myOnboarding.completedAt ? formatDate(myOnboarding.completedAt) : "Belum selesai"}</span></div>
                  {myOnboarding.tasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Task onboarding belum dibuat.</div>
                  ) : (
                    myOnboarding.tasks.map((task) => (
                      <div key={task.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1"><div className="flex items-center gap-2"><p className="font-medium text-foreground">{task.title}</p><Badge variant={task.isCompleted ? "default" : "secondary"} className="rounded-full">{task.isCompleted ? "Selesai" : "Aktif"}</Badge></div><p className="text-sm text-muted-foreground">{task.description || "Tidak ada deskripsi"}</p><p className="text-xs text-muted-foreground">Due: {formatDate(task.dueDate)}</p></div>
                        <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => handleCompleteTask(task.id)} disabled={task.isCompleted || completeTaskMutation.isPending}><CheckCircle weight="BoldDuotone" className="h-4 w-4" />Tandai selesai</Button></div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recruitment-request" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full gap-2" onClick={() => toast.info("Fitur export belum tersedia")}>
              <Export weight="BoldDuotone" className="h-4 w-4" />Export
            </Button>
            <Button className="rounded-full gap-2" onClick={() => setRecruitmentRequestDrawerOpen(true)}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />Tambah Data
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-heading">Permintaan Rekrutmen</CardTitle>
              <p className="text-sm text-muted-foreground">Daftar permintaan rekrutmen dari setiap departemen.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Posisi</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Prioritas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal Request</TableHead>
                      <TableHead>Link Form</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recruitmentRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                          Belum ada permintaan rekrutmen.
                        </TableCell>
                      </TableRow>
                    ) : recruitmentRequests.map((req: RecruitmentRequestItem) => {
                      const formUrl = req.formLink
                        ? `${typeof window !== "undefined" ? window.location.origin : ""}/recruitment-form?token=${req.formLink.token}`
                        : null;
                      return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{req.department?.name ?? "-"}</span>
                            <span className="text-xs text-muted-foreground">{req.fpkNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>{req.position?.name ?? req.level ?? "-"}</TableCell>
                        <TableCell>{req.quota}</TableCell>
                        <TableCell>
                          <Badge
                            variant={req.priority === "urgent" ? "destructive" : "secondary"}
                            className="rounded-full"
                          >
                            {req.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}
                            className="rounded-full"
                          >
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(req.createdAt)}</TableCell>
                        <TableCell>
                          {req.formLink ? (
                            <Popover>
                              <PopoverTrigger
                                render={
                                  <Button size="sm" variant="outline" className="rounded-full gap-1.5">
                                    <Link weight="BoldDuotone" className="h-4 w-4" />
                                    <span>{req.formLink.status === "Active" ? "Aktif" : "Nonaktif"}</span>
                                  </Button>
                                }
                              />
                              <PopoverContent className="w-80" side="left" align="start">
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-foreground">Link Form Kandidat</span>
                                    <Badge variant={req.formLink.status === "Active" ? "default" : "secondary"} className="rounded-full text-xs">
                                      {req.formLink.status === "Active" ? "Aktif" : "Nonaktif"}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">URL Pendaftaran</span>
                                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
                                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{formUrl}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 shrink-0 rounded-full p-0"
                                        onClick={() => handleCopyToClipboard(formUrl ?? "", "URL")}
                                      >
                                        <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-xs text-muted-foreground">Kode Akses</span>
                                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
                                      <span className="flex-1 font-mono text-sm font-semibold tracking-widest text-foreground">{req.formLink.accessCode}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 shrink-0 rounded-full p-0"
                                        onClick={() => handleCopyToClipboard(req.formLink?.accessCode ?? "", "Kode akses")}
                                      >
                                        <Copy weight="BoldDuotone" className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <UsersGroupRounded weight="BoldDuotone" className="h-3.5 w-3.5" />
                                    <span>{req.formLink._count.submissions} pendaftar</span>
                                    {req.formLink.expiresAt ? (
                                      <span className="ml-auto">Exp: {formatDate(req.formLink.expiresAt)}</span>
                                    ) : null}
                                  </div>
                                  <div className="flex gap-2 border-t border-border pt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 rounded-full gap-1.5"
                                      onClick={() => handleRegenerateFormLink(req.id)}
                                      disabled={regenerateFormLinkMutation.isPending}
                                    >
                                      <Refresh weight="BoldDuotone" className="h-3.5 w-3.5" />
                                      Regenerate
                                    </Button>
                                    {req.formLink.status === "Active" ? (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex-1 rounded-full gap-1.5"
                                        onClick={() => handleRevokeFormLink(req.id)}
                                        disabled={revokeFormLinkMutation.isPending}
                                      >
                                        <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                                        Nonaktifkan
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full gap-1.5 text-muted-foreground"
                              onClick={() => handleRegenerateFormLink(req.id)}
                              disabled={regenerateFormLinkMutation.isPending}
                            >
                              <Link weight="BoldDuotone" className="h-4 w-4" />
                              Buat link
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full gap-1.5"
                            onClick={() => setSelectedRequest(req)}
                          >
                            <Eye weight="BoldDuotone" className="h-4 w-4" />
                            Lihat Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blacklist" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="rounded-full gap-2" onClick={() => setBlacklistDrawerOpen(true)}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />Tambah Blacklist
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-heading">Daftar Blacklist</CardTitle>
              <p className="text-sm text-muted-foreground">Kandidat atau mantan karyawan yang masuk daftar blacklist beserta alasan.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Alasan</TableHead>
                      <TableHead>Tanggal Blacklist</TableHead>
                      <TableHead>Ditambahkan oleh</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blacklistEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          Belum ada data blacklist.
                        </TableCell>
                      </TableRow>
                    ) : blacklistEntries.map((entry: BlacklistEntryItem) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{entry.fullName}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.email ?? "-"}</TableCell>
                        <TableCell className="max-w-60 text-sm">{entry.reason}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(entry.blacklistedAt)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.blacklistedBy?.fullName ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-full gap-1.5"
                              onClick={() => handleDeleteBlacklistEntry(entry.id)}
                              disabled={deleteBlacklistMutation.isPending}
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />Hapus
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ex-staff" className="mt-4 space-y-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-heading">Daftar Ex-Staff</CardTitle>
              <p className="text-sm text-muted-foreground">Mantan karyawan yang sudah resign, berakhir kontrak, atau diterminasi.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Posisi Terakhir</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Tanggal Keluar</TableHead>
                      <TableHead>Alasan Keluar</TableHead>
                      <TableHead>Eligible Rehire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exStaffList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          Belum ada data ex-staff.
                        </TableCell>
                      </TableRow>
                    ) : exStaffList.map((item: ExStaffItem) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{item.fullName ?? "-"}</span>
                            <span className="text-xs text-muted-foreground">{item.email ?? "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.position?.name ?? "-"}</TableCell>
                        <TableCell>{item.department?.name ?? "-"}</TableCell>
                        <TableCell>{formatDate(item.resignDate)}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell><Badge className="rounded-full">Ya</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <JobPostingDrawer
        isOpen={jobPostingDrawerOpen}
        onClose={() => setJobPostingDrawerOpen(false)}
      />
      <OnboardingTemplateDrawer
        isOpen={templateDrawerOpen}
        onClose={() => setTemplateDrawerOpen(false)}
      />
      <AssignOnboardingDrawer
        isOpen={assignDrawerOpen}
        onClose={() => setAssignDrawerOpen(false)}
        employees={employees}
        templates={templates}
      />
      <CandidateDrawer
        isOpen={candidateDrawerOpen}
        onClose={() => setCandidateDrawerOpen(false)}
        jobPostings={jobPostings}
      />
      <RejectCandidateDrawer
        isOpen={rejectDrawerOpen}
        onClose={() => setRejectDrawerOpen(false)}
        candidates={candidates}
      />
      <RecruitmentRequestDrawer
        isOpen={recruitmentRequestDrawerOpen}
        onClose={() => setRecruitmentRequestDrawerOpen(false)}
      />
      <BlacklistDrawer
        isOpen={blacklistDrawerOpen}
        onClose={() => setBlacklistDrawerOpen(false)}
      />
      <RecruitmentRequestDetailDrawer
        open={selectedRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
          }
        }}
        request={selectedRequest}
      />
    </div>
  );
}
