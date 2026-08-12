"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  User,
  Letter,
  Phone,
  SquareAcademicCap,
  Buildings3,
  ClipboardText,
  Calendar,
  DownloadMinimalistic,
  UsersGroupRounded,
  CheckCircle,
  CloseCircle,
  ClockCircle,
  MapPoint,
  CaseMinimalistic,
  DocumentText,
} from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidateSubmissions } from "@/hooks/use-candidate-submissions";
import type { RecruitmentRequestItem } from "@/lib/queries/recruitmentRequests";
import type { CandidateSubmissionItem } from "@/lib/queries/candidateSubmissions";

interface RecruitmentRequestDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RecruitmentRequestItem | null;
}

function resolvePhotoUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (!base) return null;
  return `${base}/${key}`;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}): ReactNode {
  if (!value || value === "-") return null;
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-xl bg-secondary shrink-0">{icon}</div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground break-words">
          {value}
        </div>
      </div>
    </div>
  );
}

function ApproverRow({
  label,
  approver,
  status,
}: {
  label: string;
  approver: { fullName: string | null } | null | undefined;
  status: string;
}): ReactNode {
  if (!approver) return null;

  let icon: ReactNode;
  let statusLabel: string;
  let badgeVariant: "default" | "secondary" | "destructive";

  if (status === "approved") {
    icon = <CheckCircle weight="BoldDuotone" className="h-5 w-5 text-green-600" />;
    statusLabel = "Disetujui";
    badgeVariant = "default";
  } else if (status === "rejected") {
    icon = <CloseCircle weight="BoldDuotone" className="h-5 w-5 text-destructive" />;
    statusLabel = "Ditolak";
    badgeVariant = "destructive";
  } else {
    icon = <ClockCircle weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />;
    statusLabel = "Menunggu";
    badgeVariant = "secondary";
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">
          {approver.fullName ?? "-"}
        </p>
      </div>
      <Badge variant={badgeVariant} className="rounded-full text-xs shrink-0">
        {statusLabel}
      </Badge>
    </div>
  );
}

function CandidateCardSkeleton(): ReactNode {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

function CandidateCard({
  submission,
}: {
  submission: CandidateSubmissionItem;
}): ReactNode {
  const photoUrl = resolvePhotoUrl(submission.photoUrl);
  const cvUrl = resolvePhotoUrl(submission.cvUrl);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={submission.fullName}
            width={48}
            height={48}
            className="h-12 w-12 rounded-2xl object-cover shrink-0"
            unoptimized
          />
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
            <User weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-foreground truncate">
            {submission.fullName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dikirim {formatDate(submission.submittedAt)}
          </p>
        </div>
        {cvUrl && (
          <a href={cvUrl} target="_blank" rel="noopener noreferrer" download>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5 shrink-0"
            >
              <DownloadMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5" />
              CV
            </Button>
          </a>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Letter weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground truncate">{submission.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-foreground">{submission.phoneNumber}</span>
        </div>
        {(submission.lastEducation ?? submission.major) && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <SquareAcademicCap weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground truncate">
              {[submission.lastEducation, submission.major].filter(Boolean).join(" — ")}
            </span>
          </div>
        )}
        {submission.workExperienceYears !== null && submission.workExperienceYears !== undefined && (
          <div className="flex items-center gap-2">
            <CaseMinimalistic weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">
              {submission.workExperienceYears} tahun pengalaman
            </span>
          </div>
        )}
        {submission.birthDate && (
          <div className="flex items-center gap-2">
            <Calendar weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">
              {submission.birthPlace ? `${submission.birthPlace}, ` : ""}
              {formatDate(submission.birthDate)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RecruitmentRequestDetailDrawer({
  open,
  onOpenChange,
  request,
}: RecruitmentRequestDetailDrawerProps): ReactNode {
  const { data: submissions = [], isLoading } = useCandidateSubmissions(
    request?.id ?? null
  );

  if (!request) return null;

  const statusVariant =
    request.status === "approved"
      ? "default"
      : request.status === "rejected"
        ? "destructive"
        : "secondary";
  const statusLabels: Record<string, string> = {
    pending: "Pending",
    approved: "Disetujui",
    rejected: "Ditolak",
    open: "Open",
    closed: "Closed",
  };
  const priorityLabels: Record<string, string> = {
    low: "Rendah",
    medium: "Sedang",
    high: "Tinggi",
    urgent: "Urgent",
  };

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Detail Permintaan Rekrutmen"
      maxWidth="sm:max-w-xl"
    >
      <div className="space-y-2 pb-4">
        {/* Header badges */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Badge variant={statusVariant} className="rounded-full text-xs">
            {statusLabels[request.status] ?? request.status}
          </Badge>
          <Badge
            variant={request.priority === "urgent" ? "destructive" : "secondary"}
            className="rounded-full text-xs"
          >
            {priorityLabels[request.priority] ?? request.priority}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono ml-auto">
            {request.fpkNumber}
          </span>
        </div>

        {/* Accordion sections */}
        <Accordion defaultValue={[0, 1, 2]}>
          {/* 1. Approval Status */}
          <AccordionItem>
            <AccordionTrigger className="text-sm font-semibold">
              <div className="flex items-center gap-2">
                <CheckCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                Approval Status
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <ApproverRow
                  label="Approver 1"
                  approver={request.approver1}
                  status={request.status}
                />
                <ApproverRow
                  label="Approver 2"
                  approver={request.approver2}
                  status={request.approver1 ? request.status : "pending"}
                />

                {!request.approver1 && !request.approver2 && (
                  <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      Belum ada approver yang ditentukan
                    </p>
                  </div>
                )}

                {request.rejectionReason && (
                  <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 space-y-1">
                    <p className="text-xs font-semibold text-destructive">Alasan Penolakan</p>
                    <p className="text-sm text-foreground">{request.rejectionReason}</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Detail */}
          <AccordionItem>
            <AccordionTrigger className="text-sm font-semibold">
              <div className="flex items-center gap-2">
                <DocumentText weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                Detail
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
                  <InfoRow
                    icon={<ClipboardText weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Posisi"
                    value={request.position?.name ?? request.level ?? "-"}
                  />
                  <InfoRow
                    icon={<Buildings3 weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Departemen"
                    value={request.department?.name}
                  />
                  <InfoRow
                    icon={<UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Kuota"
                    value={`${request.quota} orang`}
                  />
                  <InfoRow
                    icon={<CaseMinimalistic weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Gaji"
                    value={formatCurrency(request.salary)}
                  />
                  <InfoRow
                    icon={<MapPoint weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Lokasi Kerja"
                    value={request.workLocation}
                  />
                  <InfoRow
                    icon={<MapPoint weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Lokasi Interview"
                    value={request.interviewLocation}
                  />
                  <InfoRow
                    icon={<Calendar weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Tanggal Mulai"
                    value={formatDate(request.startDate)}
                  />
                  <InfoRow
                    icon={<Calendar weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                    label="Tanggal Dokumen"
                    value={formatDate(request.documentDate)}
                  />
                </div>

                {/* Qualifications */}
                {(request.minEducation ?? request.minExperience ?? request.otherQualifications) && (
                  <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Kualifikasi
                    </p>
                    <InfoRow
                      icon={<SquareAcademicCap weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                      label="Pendidikan Minimum"
                      value={request.minEducation}
                    />
                    <InfoRow
                      icon={<CaseMinimalistic weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
                      label="Pengalaman Minimum"
                      value={request.minExperience}
                    />
                    {request.otherQualifications && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Kualifikasi Lainnya</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {request.otherQualifications}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Job Descriptions */}
                {request.jobDescriptions && request.jobDescriptions.length > 0 && (
                  <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Deskripsi Pekerjaan
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {request.jobDescriptions.map((desc, i) => (
                        <li key={i} className="text-sm text-foreground">{desc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Additional Notes */}
                {request.additionalNotes && request.additionalNotes.length > 0 && (
                  <div className="bg-muted/30 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Catatan Tambahan
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {request.additionalNotes.map((note, i) => (
                        <li key={i} className="text-sm text-foreground">{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Additional info */}
                {(request.isWalkinInterview || request.company || request.trainingCompanion) && (
                  <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
                    {request.isWalkinInterview && (
                      <Badge variant="secondary" className="rounded-full text-xs">
                        Walk-in Interview
                      </Badge>
                    )}
                    {request.company && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Perusahaan</p>
                        <p className="text-sm font-medium text-foreground">{request.company}</p>
                      </div>
                    )}
                    {request.trainingCompanion && (
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Pendamping Training</p>
                        <p className="text-sm font-medium text-foreground">{request.trainingCompanion}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
                  {request.requestedBy && (
                    <p>Diminta oleh: {request.requestedBy.fullName ?? "-"}</p>
                  )}
                  <p>Dibuat: {formatDate(request.createdAt)}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* 3. List Kandidat */}
          <AccordionItem>
            <AccordionTrigger className="text-sm font-semibold">
              <div className="flex items-center gap-2">
                <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                List Kandidat
                {!isLoading && (
                  <Badge variant="secondary" className="rounded-full text-xs ml-1">
                    {submissions.length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {isLoading ? (
                  <>
                    <CandidateCardSkeleton />
                    <CandidateCardSkeleton />
                    <CandidateCardSkeleton />
                  </>
                ) : submissions.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="p-4 rounded-full bg-muted">
                      <UsersGroupRounded
                        weight="BoldDuotone"
                        className="h-8 w-8 text-muted-foreground"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Belum ada kandidat yang mendaftar
                    </p>
                  </div>
                ) : (
                  submissions.map((submission) => (
                    <CandidateCard key={submission.id} submission={submission} />
                  ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Drawer>
  );
}
