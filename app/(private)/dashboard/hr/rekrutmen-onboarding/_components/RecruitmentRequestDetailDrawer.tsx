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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCandidateSubmissions } from "@/hooks/use-candidate-submissions";
import type { RecruitmentRequestItem } from "@/lib/queries/recruitmentRequests";

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

function SkeletonRows(): ReactNode {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
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
      maxWidth="sm:max-w-2xl"
      paddingX="px-3 sm:px-5"
    >
      <div className="space-y-4 pb-4">
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

        {/* Tabs */}
        <Tabs defaultValue="master-data" className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-xl">
            <TabsTrigger value="master-data" className="rounded-xl gap-2 text-xs sm:text-sm">
              <DocumentText weight="BoldDuotone" className="h-4 w-4" />
              Master Data
            </TabsTrigger>
            <TabsTrigger value="interview" className="rounded-xl gap-2 text-xs sm:text-sm">
              <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />
              Interview
              {!isLoading && submissions.length > 0 && (
                <Badge variant="secondary" className="rounded-full text-[10px] px-1.5 py-0 ml-1">
                  {submissions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Master Data — 3 Accordions */}
          <TabsContent value="master-data" className="mt-4">
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
                    <ClipboardText weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
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
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-border p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                            <div className="space-y-1.5 flex-1">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-44" />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : submissions.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <div className="p-4 rounded-full bg-muted">
                          <UsersGroupRounded weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Belum ada kandidat yang mendaftar
                        </p>
                      </div>
                    ) : (
                      submissions.map((s) => {
                        const photoUrl = resolvePhotoUrl(s.photoUrl);
                        return (
                          <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:bg-muted/30 transition-colors">
                            {photoUrl ? (
                              <Image
                                src={photoUrl}
                                alt={s.fullName}
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-xl object-cover shrink-0"
                                unoptimized
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                                <User weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{s.fullName}</p>
                              <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDate(s.submittedAt)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* Tab 2: Interview — Table */}
          <TabsContent value="interview" className="mt-4">
            <div className="rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Data Kandidat</h3>
                  {!isLoading && (
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {submissions.length} pendaftar
                    </Badge>
                  )}
                </div>
              </div>

              {isLoading ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kontak</TableHead>
                      <TableHead>Pendidikan</TableHead>
                      <TableHead>Pengalaman</TableHead>
                      <TableHead>Tanggal Daftar</TableHead>
                      <TableHead className="text-right">CV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SkeletonRows />
                  </TableBody>
                </Table>
              ) : submissions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="p-4 rounded-full bg-muted">
                    <UsersGroupRounded weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Belum ada kandidat yang mendaftar
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kontak</TableHead>
                        <TableHead>Pendidikan</TableHead>
                        <TableHead>Pengalaman</TableHead>
                        <TableHead>Tanggal Daftar</TableHead>
                        <TableHead className="text-right pr-4">CV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((s) => {
                        const photoUrl = resolvePhotoUrl(s.photoUrl);
                        const cvUrl = resolvePhotoUrl(s.cvUrl);
                        return (
                          <TableRow key={s.id}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                {photoUrl ? (
                                  <Image
                                    src={photoUrl}
                                    alt={s.fullName}
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 rounded-lg object-cover shrink-0"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                    <User weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="leading-tight min-w-0">
                                  <p className="font-medium text-foreground truncate">{s.fullName}</p>
                                  {s.birthPlace && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                      {s.birthPlace}{s.birthDate ? `, ${formatDate(s.birthDate)}` : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Letter weight="BoldDuotone" className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs text-foreground truncate max-w-36">{s.email}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Phone weight="BoldDuotone" className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs text-foreground">{s.phoneNumber}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <div className="space-y-0.5">
                                {s.lastEducation && (
                                  <p className="text-xs">{s.lastEducation}</p>
                                )}
                                {s.major && (
                                  <p className="text-xs text-foreground">{s.major}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {s.workExperienceYears !== null && s.workExperienceYears !== undefined
                                ? `${s.workExperienceYears} tahun`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {formatDate(s.submittedAt)}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              {cvUrl ? (
                                <a href={cvUrl} target="_blank" rel="noopener noreferrer" download>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full gap-1.5 text-xs"
                                  >
                                    <DownloadMinimalistic weight="BoldDuotone" className="h-3.5 w-3.5" />
                                    Unduh
                                  </Button>
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Drawer>
  );
}
