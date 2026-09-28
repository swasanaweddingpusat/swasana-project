"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target,
  ChartSquare,
  WalletMoney,
  MoneyBag,
  Buildings2,
  InfoCircle,
  MedalStar,
  Graph,
  ListCheck,
} from "@solar-icons/react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useAssignments, useCalculationResults } from "@/hooks/useKpiInsentif";
import { formatRupiah, formatPct, formatKpiStatus } from "@/lib/utils/kpiFormatters";
import type { KpiCalculationResultItem, KpiAssignmentItem } from "@/types/kpiInsentif";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function buildPeriodKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Returns a color class string based on achievement percentage
function achievementColorClass(pct: string | null | undefined): string {
  if (!pct) return "bg-muted";
  const n = parseFloat(pct);
  if (Number.isNaN(n)) return "bg-muted";
  if (n >= 100) return "bg-primary";
  if (n >= 70) return "bg-ring";
  return "bg-destructive";
}

function achievementTextClass(pct: string | null | undefined): string {
  if (!pct) return "text-muted-foreground";
  const n = parseFloat(pct);
  if (Number.isNaN(n)) return "text-muted-foreground";
  if (n >= 100) return "text-primary";
  if (n >= 70) return "text-ring";
  return "text-destructive";
}

function clampPct(pct: string | null | undefined): number {
  if (!pct) return 0;
  const n = parseFloat(pct);
  if (Number.isNaN(n)) return 0;
  return Math.min(n, 100);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

function AchievementRow({
  label,
  real,
  target,
  pct,
  isRupiah,
}: {
  label: string;
  real: string | number | null;
  target: string | number | null;
  pct: string | null;
  isRupiah: boolean;
}) {
  const pctNum = clampPct(pct);
  const fillClass = achievementColorClass(pct);
  const textClass = achievementTextClass(pct);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-semibold tabular-nums text-xs ${textClass}`}>
          {pct ? formatPct(pct) : "-"}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Realisasi:{" "}
          <span className="font-medium text-foreground">
            {isRupiah ? formatRupiah(real) : (real ?? "-")}
          </span>
        </span>
        <span className="text-border">·</span>
        <span>
          Target:{" "}
          <span className="font-medium text-foreground">
            {isRupiah ? formatRupiah(target) : (target ?? "-")}
          </span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fillClass}`}
          style={{ width: `${pctNum}%` }}
        />
      </div>
    </div>
  );
}

function AssignmentRow({ item }: { item: KpiAssignmentItem }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b last:border-0">
      <div className="space-y-0.5 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.kpiMaster.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.venue?.name ?? "Semua Venue"}
          {" · "}
          <span className="capitalize">{item.kpiMaster.businessRole}</span>
        </p>
        {item.notes && (
          <p className="text-xs text-muted-foreground italic">{item.notes}</p>
        )}
      </div>
      <div className="shrink-0 text-right space-y-1">
        {item.targetQty != null ? (
          <p className="text-sm font-semibold tabular-nums">{item.targetQty} unit</p>
        ) : item.targetPrice != null ? (
          <p className="text-sm font-semibold tabular-nums">{formatRupiah(item.targetPrice)}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Pakai target master</p>
        )}
        <Badge
          variant={item.isDraft ? "secondary" : "default"}
          className="rounded-full text-xs"
        >
          {item.isDraft ? "Draft" : "Aktif"}
        </Badge>
      </div>
    </div>
  );
}

function FinancialRow({
  label,
  value,
  variant,
  large,
}: {
  label: string;
  value: string | null;
  variant?: "destructive" | "normal";
  large?: boolean;
}) {
  const valueClass = large
    ? "font-heading text-xl font-bold text-foreground"
    : variant === "destructive"
    ? "text-sm font-semibold tabular-nums text-destructive"
    : "text-sm font-semibold tabular-nums text-foreground";

  return (
    <div className={`flex items-center justify-between gap-2 py-2.5 border-b last:border-0 ${large ? "py-3" : ""}`}>
      <span className={large ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground"}>
        {label}
      </span>
      <span className={valueClass}>{formatRupiah(value)}</span>
    </div>
  );
}

// ─── Result section (per venue result) ──────────────────────────────────────

function ResultSection({ result, month, year }: { result: KpiCalculationResultItem; month: number; year: number }) {
  const statusInfo = formatKpiStatus(result.status);
  const deductionNum = result.deductionAmount != null ? Number(result.deductionAmount) : 0;
  const gradeLabel = result.grade ?? "—";

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MedalStar weight="BoldDuotone" className="h-3.5 w-3.5" />
            Grade
          </p>
          <p className={`font-heading text-4xl font-bold ${result.grade ? "text-foreground" : "text-muted-foreground/40"}`}>
            {gradeLabel}
          </p>
          <p className="text-xs text-muted-foreground">{MONTHS[month - 1]} {year}</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MoneyBag weight="BoldDuotone" className="h-3.5 w-3.5" />
            Saldo Bonus
          </p>
          <p className="font-heading text-xl font-bold text-foreground tabular-nums">
            {formatRupiah(result.totalBonus)}
          </p>
          <p className="text-xs text-muted-foreground">Bonus bulan ini</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <WalletMoney weight="BoldDuotone" className="h-3.5 w-3.5" />
            Total Bersih
          </p>
          <p className="font-heading text-xl font-bold text-foreground tabular-nums">
            {formatRupiah(result.netAmount)}
          </p>
          <p className="text-xs text-muted-foreground">Insentif bulan ini</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ChartSquare weight="BoldDuotone" className="h-3.5 w-3.5" />
            Status
          </p>
          <div className="pt-1">
            <Badge variant={statusInfo.variant} className="rounded-full">
              {statusInfo.label}
            </Badge>
          </div>
          {result.finalizedAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(result.finalizedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Buildings2 weight="BoldDuotone" className="h-3.5 w-3.5" />
            Venue
          </p>
          <p className="text-sm font-semibold text-foreground">
            {result.venue?.name ?? "Semua Venue"}
          </p>
        </div>
      </div>

      {/* Achievement progress */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Graph weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            Pencapaian Target
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <AchievementRow
            label="Dealing"
            real={result.realDealingTotal}
            target={result.targetDealingTotal}
            pct={result.dealingAchievementPct}
            isRupiah={false}
          />
          <AchievementRow
            label="Omset"
            real={result.realOmsetTotal}
            target={result.targetOmsetTotal}
            pct={result.omsetAchievementPct}
            isRupiah={true}
          />
          <AchievementRow
            label="Homebase"
            real={result.realHomebase}
            target={result.targetHomebase}
            pct={result.homebaseAchievementPct}
            isRupiah={false}
          />
        </CardContent>
      </Card>

      {/* Financial breakdown */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <WalletMoney weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            Rincian Insentif
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <FinancialRow label="Komisi Dasar" value={result.baseCommissionTotal} />
          <FinancialRow label="Total Bonus" value={result.totalBonus} />
          <FinancialRow label="Gross" value={result.grossAmount} />
          {deductionNum > 0 && (
            <FinancialRow label="Potongan" value={result.deductionAmount} variant="destructive" />
          )}
          <FinancialRow label="Total Bersih" value={result.netAmount} large />
        </CardContent>
      </Card>

      {/* Missing data reasons */}
      {result.missingDataReasons.length > 0 && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 flex items-start gap-2">
          <InfoCircle weight="BoldDuotone" className="h-4 w-4 mt-0.5 shrink-0 text-destructive/70" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-destructive/80">Data belum lengkap:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {result.missingDataReasons.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function KpiSayaClient() {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const { user, isLoading: userLoading } = useCurrentUser();
  const profileId = user?.profileId;
  const period = buildPeriodKey(filterMonth, filterYear);

  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(
    { profileId: profileId ?? "none", period }
  );

  const { data: results = [], isLoading: resultsLoading } = useCalculationResults(
    profileId ? { profileId, period } : undefined
  );

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const isLoading = userLoading || assignmentsLoading || resultsLoading;
  const userName = user?.name ?? "Kamu";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Target weight="BoldDuotone" className="h-6 w-6 text-muted-foreground" />
            KPI Saya
          </h1>
          <p className="text-sm text-muted-foreground">
            Pencapaian KPI & insentif untuk{" "}
            <span className="font-medium text-foreground">{userName}</span>
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="rounded-full w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="rounded-full w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <SummaryCardSkeleton key={i} />)}
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="space-y-6">
          {/* KPI results — one section per venue result */}
          {results.length > 0 ? (
            results.map((result) => (
              <ResultSection
                key={result.id}
                result={result}
                month={filterMonth}
                year={filterYear}
              />
            ))
          ) : (
            <div className="rounded-2xl border bg-card p-10 shadow-sm flex flex-col items-center gap-3 text-center">
              <ChartSquare weight="BoldDuotone" className="h-12 w-12 text-muted-foreground/30" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">
                  Belum ada data KPI untuk periode ini
                </p>
                <p className="text-xs text-muted-foreground">
                  {MONTHS[filterMonth - 1]} {filterYear} · KPI belum dihitung atau belum ada penugasan
                </p>
              </div>
            </div>
          )}

          {/* Assignments section */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ListCheck weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                Penugasan KPI Saya
                {assignments.length > 0 && (
                  <Badge variant="secondary" className="rounded-full ml-auto text-xs">
                    {assignments.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {assignments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <Target weight="BoldDuotone" className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Tidak ada penugasan untuk periode ini</p>
                </div>
              ) : (
                <div>
                  {assignments.map((item) => (
                    <AssignmentRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
