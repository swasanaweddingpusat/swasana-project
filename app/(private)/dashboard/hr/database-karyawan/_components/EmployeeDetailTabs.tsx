"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEmployeeDetail } from "@/hooks/use-employees";
import { PersonalInfoSection } from "./PersonalInfoSection";
import { EmploymentSection } from "./EmploymentSection";
import { PayrollSection } from "./PayrollSection";
import { DocumentsSection } from "./DocumentsSection";
import { HistorySection } from "./HistorySection";
import {
  AltArrowLeft,
  UserRounded,
  CaseMinimalistic,
  WalletMoney,
  Document,
  ClipboardList,
} from "@solar-icons/react";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  active: { label: "Aktif", variant: "default" },
  inactive: { label: "Tidak Aktif", variant: "secondary" },
  suspended: { label: "Suspended", variant: "destructive" },
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Kontrak",
  probation: "Probation",
  intern: "Magang",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EmployeeDetailTabsProps {
  employeeId: string;
}

export function EmployeeDetailTabs({ employeeId }: EmployeeDetailTabsProps) {
  const { data, isLoading, isError } = useEmployeeDetail(employeeId);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError || !data) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <UserRounded
            weight="BoldDuotone"
            className="h-12 w-12 text-muted-foreground/40"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Karyawan tidak ditemukan atau terjadi kesalahan.
          </p>
          <Link
            href="/dashboard/hr/database-karyawan"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
            Kembali ke daftar
          </Link>
        </CardContent>
      </Card>
    );
  }

  const statusBadge = STATUS_BADGE[data.status] ?? STATUS_BADGE.active;
  const empTypeLabel = data.employmentType
    ? EMPLOYMENT_LABELS[data.employmentType] ?? data.employmentType
    : null;

  return (
    <>
      {/* ─── Header Card ──────────────────────────────────────────────── */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4">
            {/* Back link */}
            <Link
              href="/dashboard/hr/database-karyawan"
              className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
              Kembali ke daftar
            </Link>

            {/* Profile row */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={data.avatarUrl ?? undefined}
                  alt={data.fullName ?? ""}
                />
                <AvatarFallback className="text-lg">
                  {getInitials(data.fullName ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-xl font-semibold tracking-tight">
                    {data.fullName ?? "-"}
                  </h1>
                  <Badge variant="outline" className="rounded-full">
                    #{data.employeeNumber}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadge.variant} className="rounded-full">
                    {statusBadge.label}
                  </Badge>
                  {empTypeLabel && (
                    <Badge variant="outline" className="rounded-full">
                      {empTypeLabel}
                    </Badge>
                  )}
                </div>
                {(data.department || data.position) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.department?.name ?? "-"}
                    {data.position ? ` > ${data.position.name}` : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="rounded-xl">
          <TabsTrigger value="personal" className="rounded-xl gap-1.5">
            <UserRounded weight="BoldDuotone" className="h-4 w-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="kepegawaian" className="rounded-xl gap-1.5">
            <CaseMinimalistic weight="BoldDuotone" className="h-4 w-4" />
            Kepegawaian
          </TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-xl gap-1.5">
            <WalletMoney weight="BoldDuotone" className="h-4 w-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="dokumen" className="rounded-xl gap-1.5">
            <Document weight="BoldDuotone" className="h-4 w-4" />
            Dokumen
          </TabsTrigger>
          <TabsTrigger value="riwayat" className="rounded-xl gap-1.5">
            <ClipboardList weight="BoldDuotone" className="h-4 w-4" />
            Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <PersonalInfoSection employee={data} />
        </TabsContent>

        <TabsContent value="kepegawaian" className="mt-4">
          <EmploymentSection employee={data} />
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <PayrollSection employee={data} />
        </TabsContent>

        <TabsContent value="dokumen" className="mt-4">
          <DocumentsSection employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4">
          <HistorySection employeeId={employeeId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-32 rounded-lg" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48 rounded-lg" />
                <Skeleton className="h-5 w-32 rounded-lg" />
                <Skeleton className="h-4 w-40 rounded-lg" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
