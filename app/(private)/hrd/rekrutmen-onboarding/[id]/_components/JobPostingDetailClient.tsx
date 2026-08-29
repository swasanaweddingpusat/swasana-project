"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AltArrowLeft,
  Buildings,
  CheckCircle,
  ClipboardCheck,
  CloseCircle,
  Eye,
  ListCheck,
  RefreshCircle,
  UserCircle,
} from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useApproveJobPosting,
  useJobPostingDetail,
  useRejectJobPosting,
  useResubmitJobPosting,
} from "@/hooks/use-job-postings";
import {
  CandidateDetailSheet,
  type CandidateSheetRow,
} from "@/app/(private)/hrd/rekrutmen-onboarding/_components/CandidateDetailSheet";

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: "Tetap",
  contract: "Kontrak",
  probation: "Percobaan",
  intern: "Magang",
};

const LEVEL_LABELS: Record<string, string> = {
  entry: "Entry",
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  lead: "Lead",
  manager: "Manager",
  director: "Director",
};

const INTERVIEW_LOCATION_LABELS: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  hybrid: "Hybrid",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu Persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  assessment: "Assessment",
  offering: "Offering",
  hired: "Hired",
  rejected: "Rejected",
};

function approvalBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

function overallApprovalStatus(
  s1: string,
  s2: string,
): "approved" | "rejected" | "pending" {
  if (s1 === "rejected" || s2 === "rejected") return "rejected";
  if (s1 === "approved" && s2 === "approved") return "approved";
  return "pending";
}

function candidateStatusLabel(stage: string): string {
  if (stage === "hired") return "Diterima";
  if (stage === "rejected") return "Ditolak";
  return "Dalam Proses";
}

function candidateStatusVariant(stage: string): "default" | "secondary" | "destructive" {
  if (stage === "hired") return "default";
  if (stage === "rejected") return "destructive";
  return "secondary";
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: { toString(): string } | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value.toString());
  if (Number.isNaN(numeric)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value ?? "-"}</span>
    </div>
  );
}

type CandidateRow = CandidateSheetRow;

function ApprovalSlotActions({
  slot,
  canAct,
  rejectMode,
  rejectNote,
  isBusy,
  onSetRejectMode,
  onSetRejectNote,
  onApprove,
  onReject,
}: {
  slot: 1 | 2;
  canAct: boolean;
  rejectMode: boolean;
  rejectNote: string;
  isBusy: boolean;
  onSetRejectMode: (v: boolean) => void;
  onSetRejectNote: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!canAct) return null;
  return (
    <>
      <Separator />
      {rejectMode ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reject-note-${slot}`}>Alasan Penolakan</Label>
            <Textarea
              id={`reject-note-${slot}`}
              value={rejectNote}
              onChange={(event) => onSetRejectNote(event.target.value)}
              placeholder="Jelaskan alasan penolakan lowongan ini..."
              className="rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              className="rounded-full gap-1.5"
              onClick={onReject}
              disabled={isBusy}
            >
              <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
              Konfirmasi Tolak
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => { onSetRejectMode(false); onSetRejectNote(""); }}
              disabled={isBusy}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            className="rounded-full gap-1.5"
            onClick={onApprove}
            disabled={isBusy}
          >
            <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
            Setujui
          </Button>
          <Button
            variant="destructive"
            className="rounded-full gap-1.5"
            onClick={() => onSetRejectMode(true)}
            disabled={isBusy}
          >
            <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
            Tolak
          </Button>
        </div>
      )}
    </>
  );
}

function CandidateTable({
  candidates,
  onSelect,
}: {
  candidates: CandidateRow[];
  onSelect: (c: CandidateRow) => void;
}) {
  if (!candidates || candidates.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada kandidat.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">No</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Bergabung Tgl</TableHead>
            <TableHead>Gaji Diharapkan</TableHead>
            <TableHead>View Status</TableHead>
            <TableHead>Tahap Proses</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((c, idx) => (
            <TableRow
              key={c.id}
              className="cursor-pointer hover:bg-accent"
              onClick={() => onSelect(c)}
            >
              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{c.fullName}</span>
                  <span className="text-xs text-muted-foreground">{c.email}</span>
                </div>
              </TableCell>
              <TableCell>{formatDate(c.createdAt)}</TableCell>
              <TableCell>{formatCurrency(c.expectedSalary)}</TableCell>
              <TableCell>
                <Badge variant={c.viewed ? "default" : "secondary"} className="rounded-full">
                  {c.viewed ? "Sudah dilihat" : "Belum dilihat"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="rounded-full">
                  {STAGE_LABELS[c.stage] ?? c.stage}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={candidateStatusVariant(c.stage)} className="rounded-full">
                  {candidateStatusLabel(c.stage)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function JobPostingDetailClient({ id }: { id: string }) {
  const { data: posting, isLoading, isError } = useJobPostingDetail(id);
  const { user } = useCurrentUser();

  const approveMutation = useApproveJobPosting();
  const rejectMutation = useRejectJobPosting();
  const resubmitMutation = useResubmitJobPosting();

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null);
  const [rejectMode1, setRejectMode1] = useState(false);
  const [rejectNote1, setRejectNote1] = useState("");
  const [rejectMode2, setRejectMode2] = useState(false);
  const [rejectNote2, setRejectNote2] = useState("");

  const backLink = "/hrd/rekrutmen-onboarding";

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Memuat detail lowongan...
        </CardContent>
      </Card>
    );
  }

  if (isError || !posting) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">Lowongan tidak ditemukan.</p>
          <Link href={backLink} className={cn(buttonVariants({ variant: "outline" }), "rounded-full gap-2")}>
            <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
            Kembali ke daftar
          </Link>
        </CardContent>
      </Card>
    );
  }

  const profileId = user?.profileId ?? null;
  const isAdmin = user?.isSuperAdmin ?? false;
  const overallStatus = overallApprovalStatus(posting.approvalStatus, posting.approvalStatus2 ?? "pending");

  // Slot 1 action rights
  const canActSlot1 =
    posting.approvalStatus === "pending" &&
    (posting.approver?.id === profileId || (isAdmin && posting.approver?.id !== profileId && posting.approver2?.id !== profileId));
  // Slot 2 action rights — only after slot 1 approved
  const canActSlot2 =
    posting.approvalStatus === "approved" &&
    (posting.approvalStatus2 ?? "pending") === "pending" &&
    (posting.approver2?.id === profileId || (isAdmin && posting.approver?.id !== profileId && posting.approver2?.id !== profileId));

  const canResubmit = overallStatus === "rejected";

  const descriptions = Array.isArray(posting.jobDescriptions)
    ? (posting.jobDescriptions as string[])
    : [];

  const isBusy = approveMutation.isPending || rejectMutation.isPending || resubmitMutation.isPending;

  async function handleApproveSlot(slot: 1 | 2) {
    const result = await approveMutation.mutateAsync({ id });
    if (result.success) {
      toast.success(`Lowongan disetujui (penyetuju ${slot})`);
      if (slot === 1) { setRejectMode1(false); setRejectNote1(""); }
      if (slot === 2) { setRejectMode2(false); setRejectNote2(""); }
      return;
    }
    toast.error(result.error ?? "Gagal menyetujui lowongan");
  }

  async function handleRejectSlot(slot: 1 | 2) {
    const note = slot === 1 ? rejectNote1 : rejectNote2;
    if (!note.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    const result = await rejectMutation.mutateAsync({ id, note: note.trim() });
    if (result.success) {
      toast.success(`Lowongan ditolak (penyetuju ${slot})`);
      if (slot === 1) { setRejectMode1(false); setRejectNote1(""); }
      if (slot === 2) { setRejectMode2(false); setRejectNote2(""); }
      return;
    }
    toast.error(result.error ?? "Gagal menolak lowongan");
  }

  async function handleResubmit() {
    const result = await resubmitMutation.mutateAsync(id);
    if (result.success) {
      toast.success("Lowongan diajukan ulang");
      return;
    }
    toast.error(result.error ?? "Gagal mengajukan ulang lowongan");
  }

  const interviewCandidates = (posting.candidates ?? []).filter(
    (c) => c.stage === "interview"
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-3">
        <Link href={backLink} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit rounded-full gap-1.5 px-3")}>
          <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
          Kembali
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-heading font-semibold text-foreground">{posting.title}</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Buildings weight="BoldDuotone" className="h-4 w-4" />
              {posting.companyName ?? posting.brand?.name ?? "Perusahaan belum diisi"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={posting.status === "open" ? "default" : "secondary"}
              className="rounded-full px-3 py-1"
            >
              {STATUS_LABELS[posting.status] ?? posting.status}
            </Badge>
            <Badge
              variant={approvalBadgeVariant(overallStatus)}
              className="rounded-full px-3 py-1"
            >
              {APPROVAL_STATUS_LABELS[overallStatus] ?? overallStatus}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="master" className="w-full">
        <TabsList className="flex h-auto w-full rounded-2xl p-1 sm:grid sm:grid-cols-2">
          <TabsTrigger value="master" className="rounded-xl gap-2">
            <ListCheck weight="BoldDuotone" className="h-4 w-4" />
            Master Data
          </TabsTrigger>
          <TabsTrigger value="interview" className="rounded-xl gap-2">
            <UserCircle weight="BoldDuotone" className="h-4 w-4" />
            Interview
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Master Data ── */}
        <TabsContent value="master" className="mt-4">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-2 sm:p-4">
              <Accordion defaultValue={["approval", "detail", "kandidat"]}>

                {/* Accordion 1: Approval Status */}
                <AccordionItem value="approval">
                  <AccordionTrigger className="px-2 text-base font-heading font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <ClipboardCheck weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
                      Approval Status
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <div className="flex flex-col gap-6 pt-2">
                      {/* Slot 1 */}
                      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
                        <p className="text-sm font-semibold text-foreground">Penyetuju 1</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <InfoRow
                            label="Approval Status 1"
                            value={
                              <Badge variant={approvalBadgeVariant(posting.approvalStatus)} className="rounded-full">
                                {APPROVAL_STATUS_LABELS[posting.approvalStatus] ?? posting.approvalStatus}
                              </Badge>
                            }
                          />
                          <InfoRow label="Approval By 1" value={posting.approver?.fullName ?? "Belum ditentukan"} />
                          {posting.approvalStatus !== "pending" ? (
                            <>
                              <InfoRow label="Approval At 1" value={formatDateTime(posting.approvedAt)} />
                              <InfoRow
                                label="Approval Reason 1"
                                value={posting.approvalNote ?? "-"}
                              />
                            </>
                          ) : null}
                        </div>
                        <ApprovalSlotActions
                          slot={1}
                          canAct={canActSlot1}
                          rejectMode={rejectMode1}
                          rejectNote={rejectNote1}
                          isBusy={isBusy}
                          onSetRejectMode={setRejectMode1}
                          onSetRejectNote={setRejectNote1}
                          onApprove={() => handleApproveSlot(1)}
                          onReject={() => handleRejectSlot(1)}
                        />
                      </div>

                      {/* Slot 2 */}
                      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
                        <p className="text-sm font-semibold text-foreground">Penyetuju 2</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <InfoRow
                            label="Approval Status 2"
                            value={
                              <Badge variant={approvalBadgeVariant(posting.approvalStatus2 ?? "pending")} className="rounded-full">
                                {APPROVAL_STATUS_LABELS[posting.approvalStatus2 ?? "pending"] ?? (posting.approvalStatus2 ?? "pending")}
                              </Badge>
                            }
                          />
                          <InfoRow label="Approval By 2" value={posting.approver2?.fullName ?? "Belum ditentukan"} />
                          {(posting.approvalStatus2 ?? "pending") !== "pending" ? (
                            <>
                              <InfoRow label="Approval At 2" value={formatDateTime(posting.approvedAt2)} />
                              <InfoRow
                                label="Approval Reason 2"
                                value={posting.approvalNote2 ?? "-"}
                              />
                            </>
                          ) : null}
                        </div>
                        {posting.approvalStatus === "pending" && !canActSlot2 ? (
                          <p className="text-xs text-muted-foreground">
                            Menunggu persetujuan penyetuju pertama.
                          </p>
                        ) : null}
                        <ApprovalSlotActions
                          slot={2}
                          canAct={canActSlot2}
                          rejectMode={rejectMode2}
                          rejectNote={rejectNote2}
                          isBusy={isBusy}
                          onSetRejectMode={setRejectMode2}
                          onSetRejectNote={setRejectNote2}
                          onApprove={() => handleApproveSlot(2)}
                          onReject={() => handleRejectSlot(2)}
                        />
                      </div>

                      {/* Resubmit */}
                      {canResubmit ? (
                        <>
                          <Separator />
                          <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">
                              Lowongan ini ditolak. Perbaiki data lalu ajukan ulang untuk ditinjau kembali.
                            </p>
                            <Button
                              variant="outline"
                              className="w-fit rounded-full gap-1.5"
                              onClick={handleResubmit}
                              disabled={isBusy}
                            >
                              <RefreshCircle weight="BoldDuotone" className="h-4 w-4" />
                              Ajukan Ulang
                            </Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Accordion 2: Detail */}
                <AccordionItem value="detail">
                  <AccordionTrigger className="px-2 text-base font-heading font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <ClipboardCheck weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
                      Detail
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <div className="flex flex-col gap-6 pt-2">
                      {/* Info utama */}
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <InfoRow label="Departemen" value={posting.department?.name} />
                        <InfoRow label="Posisi" value={posting.position?.name} />
                        <InfoRow label="Level" value={posting.level ? LEVEL_LABELS[posting.level] : "-"} />
                        <InfoRow label="Lokasi" value={posting.location} />
                        <InfoRow
                          label="Tipe Pekerjaan"
                          value={posting.employmentType ? EMPLOYMENT_TYPE_LABELS[posting.employmentType] : "-"}
                        />
                        <InfoRow label="Kuota" value={posting.quota ?? "-"} />
                        <InfoRow
                          label="Rentang Gaji"
                          value={`${formatCurrency(posting.salaryRangeMin)} - ${formatCurrency(posting.salaryRangeMax)}`}
                        />
                        <InfoRow label="Tanggal Pengajuan" value={formatDate(posting.submissionDate)} />
                        <InfoRow label="Tanggal Interview" value={formatDate(posting.interviewDate)} />
                        <InfoRow label="Tanggal Mulai Kerja" value={formatDate(posting.startDate)} />
                        <InfoRow label="Pendidikan Minimum" value={posting.minEducation} />
                        <InfoRow label="Pengalaman Minimum" value={posting.minExperience} />
                      </div>

                      {/* Lokasi & Interview */}
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lokasi & Interview</p>
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                          <InfoRow
                            label="Tipe Lokasi Interview"
                            value={posting.interviewLocation ? INTERVIEW_LOCATION_LABELS[posting.interviewLocation] : "-"}
                          />
                          {posting.interviewLink ? (
                            <InfoRow
                              label="Link Interview"
                              value={
                                <a
                                  href={posting.interviewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline underline-offset-4 hover:text-foreground"
                                >
                                  {posting.interviewLink}
                                </a>
                              }
                            />
                          ) : null}
                          {posting.interviewVenue ? (
                            <InfoRow label="Venue Interview" value={posting.interviewVenue.name} />
                          ) : null}
                          <InfoRow label="Walk-in Interview" value={posting.isWalkInInterview ? "Ya" : "Tidak"} />
                        </div>
                      </div>

                      {/* Deskripsi & Kualifikasi */}
                      {(posting.description || posting.requirements || posting.otherQualifications || descriptions.length > 0 || posting.additionalNotes) ? (
                        <div className="flex flex-col gap-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deskripsi & Kualifikasi</p>
                          {posting.description ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Deskripsi</span>
                              <p className="whitespace-pre-line text-sm text-foreground">{posting.description}</p>
                            </div>
                          ) : null}
                          {posting.requirements ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Persyaratan</span>
                              <p className="whitespace-pre-line text-sm text-foreground">{posting.requirements}</p>
                            </div>
                          ) : null}
                          {descriptions.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Uraian Pekerjaan</span>
                              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                                {descriptions.map((desc, index) => (
                                  <li key={index}>{desc}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {posting.otherQualifications ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Kualifikasi Lain</span>
                              <p className="whitespace-pre-line text-sm text-foreground">{posting.otherQualifications}</p>
                            </div>
                          ) : null}
                          {posting.additionalNotes ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Catatan Tambahan</span>
                              <p className="whitespace-pre-line text-sm text-foreground">{posting.additionalNotes}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Accordion 3: List Kandidat */}
                <AccordionItem value="kandidat" className="border-b-0">
                  <AccordionTrigger className="px-2 text-base font-heading font-semibold hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Eye weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
                      List Kandidat
                      <Badge variant="secondary" className="rounded-full ml-1">
                        {(posting.candidates ?? []).length}
                      </Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <div className="pt-2">
                      <CandidateTable
                        candidates={posting.candidates ?? []}
                        onSelect={setSelectedCandidate}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Interview ── */}
        <TabsContent value="interview" className="mt-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Kandidat Interview</CardTitle>
              <p className="text-sm text-muted-foreground">
                Kandidat yang berada di tahap interview.
              </p>
            </CardHeader>
            <CardContent>
              {interviewCandidates.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Belum ada kandidat tahap interview.
                </p>
              ) : (
                <CandidateTable
                  candidates={interviewCandidates}
                  onSelect={setSelectedCandidate}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CandidateDetailSheet
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  );
}
