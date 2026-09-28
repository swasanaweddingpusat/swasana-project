"use client";

import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Play,
  DangerCircle,
  InfoCircle,
  DocumentText,
} from "@solar-icons/react";
import {
  formatRupiah,
  formatPct,
  formatKpiStatus,
  formatMissingReason,
} from "@/lib/utils/kpiFormatters";
import type { KpiCalculationResultItem } from "@/types/kpiInsentif";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface ResultDetailDrawerProps {
  result: KpiCalculationResultItem;
  isOpen: boolean;
  onClose: () => void;
  onFinalize: (id: string) => void;
  onRunCalc: (result: KpiCalculationResultItem) => void;
  isFinalizing: boolean;
  isRunningCalc: boolean;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right">{value ?? "-"}</span>
    </div>
  );
}

export function ResultDetailDrawer({
  result,
  isOpen,
  onClose,
  onFinalize,
  onRunCalc,
  isFinalizing,
  isRunningCalc,
}: ResultDetailDrawerProps) {
  const hasMissing = result.missingDataReasons.length > 0;
  const { label: statusLabel, variant: statusVariant } = formatKpiStatus(result.status);
  const canFinalize = result.status === "SIMULATED" && !hasMissing;
  const canRunCalc = result.status === "DRAFT";
  const periodDate = new Date(result.period);
  const periodLabel = `${MONTHS[periodDate.getMonth()]} ${periodDate.getFullYear()}`;
  const hasData = result.netAmount != null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Detail — ${result.profile.fullName ?? "Karyawan"}`}
      maxWidth="sm:max-w-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 space-y-4 overflow-y-auto pb-2">
          {/* Header info */}
          <div className="rounded-2xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{result.profile.fullName ?? "-"}</p>
                <p className="text-xs text-muted-foreground">
                  {result.venue?.name ?? "Semua Venue"}
                </p>
                <p className="text-xs text-muted-foreground">Periode: {periodLabel}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={statusVariant} className="rounded-full">{statusLabel}</Badge>
                {result.status === "SIMULATED" && (
                  <span className="text-[10px] text-muted-foreground font-semibold">DATA SIMULASI</span>
                )}
                {result.grade && (
                  <span className="text-xs font-semibold">Grade: {result.grade}</span>
                )}
              </div>
            </div>
          </div>

          {/* Missing data */}
          {hasMissing && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <DangerCircle weight="BoldDuotone" className="h-4 w-4" />
                Data Belum Lengkap
              </div>
              <ul className="space-y-1">
                {result.missingDataReasons.map((reason) => (
                  <li key={reason} className="text-xs text-destructive/80 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">•</span>
                    {formatMissingReason(reason)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Calculation Summary */}
          {hasData && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                <DocumentText weight="BoldDuotone" className="h-4 w-4" />
                Ringkasan Kalkulasi
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Capaian (%)</p>
                <InfoRow label="Dealing" value={formatPct(result.dealingAchievementPct)} />
                <InfoRow label="Omset" value={formatPct(result.omsetAchievementPct)} />
                <InfoRow label="Homebase" value={formatPct(result.homebaseAchievementPct)} />
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Realisasi</p>
                <InfoRow label="Total Dealing" value={result.realDealingTotal} />
                <InfoRow label="Total Omset" value={formatRupiah(result.realOmsetTotal)} />
                <InfoRow label="Homebase" value={result.realHomebase} />
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Hasil Akhir</p>
                <InfoRow label="Komisi Dasar" value={formatRupiah(result.baseCommissionTotal)} />
                <InfoRow label="Total Bonus" value={formatRupiah(result.totalBonus)} />
                <InfoRow label="Gross" value={formatRupiah(result.grossAmount)} />
                <InfoRow label="Potongan" value={formatRupiah(result.deductionAmount)} />
                <div className="flex items-baseline justify-between gap-3 pt-2">
                  <span className="text-sm font-semibold">Total Bersih</span>
                  <span className="text-lg font-semibold font-heading text-foreground">{formatRupiah(result.netAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {!hasData && (
            <div className="rounded-2xl border bg-muted/20 p-8 text-center space-y-2">
              <InfoCircle weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Belum ada hasil kalkulasi</p>
              <p className="text-xs text-muted-foreground">Jalankan kalkulasi untuk melihat breakdown</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(canRunCalc || canFinalize) && (
          <div className="sticky bottom-0 bg-background border-t border-border pt-4 mt-4 flex items-center gap-3">
            {canRunCalc && (
              <Button
                variant="outline"
                className="flex-1 rounded-full gap-1.5"
                onClick={() => onRunCalc(result)}
                disabled={isRunningCalc}
              >
                <Play weight="BoldDuotone" className="h-4 w-4" />
                {isRunningCalc ? "Menghitung..." : "Jalankan Kalkulasi"}
              </Button>
            )}
            {canFinalize && (
              <Button
                className="flex-1 rounded-full gap-1.5"
                onClick={() => onFinalize(result.id)}
                disabled={isFinalizing}
              >
                <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                {isFinalizing ? "Finalisasi..." : "Finalisasi"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
