"use client";

import { useState } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  CheckCircle,
  Play,
  DangerCircle,
  InfoCircle,
  DocumentText,
  WalletMoney,
  RefreshCircle,
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
  onFinalize?: (id: string) => void;
  onRunCalc?: (result: KpiCalculationResultItem) => void;
  isFinalizing?: boolean;
  isRunningCalc?: boolean;
  onMarkStagePaid?: (resultId: string, stage: 1 | 2) => void;
  isMarkingStagePaid?: boolean;
  onRecomputeStagedPayment?: (resultId: string) => void;
  isRecomputing?: boolean;
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
  onFinalize = () => {},
  onRunCalc = () => {},
  isFinalizing = false,
  isRunningCalc = false,
  onMarkStagePaid,
  isMarkingStagePaid = false,
  onRecomputeStagedPayment,
  isRecomputing = false,
}: ResultDetailDrawerProps) {
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmStage, setConfirmStage] = useState<1 | 2 | null>(null);

  const hasMissing = result.missingDataReasons.length > 0;
  const { label: statusLabel, variant: statusVariant } = formatKpiStatus(result.status);
  const canFinalize = result.status === "SIMULATED" && !hasMissing;
  const canRunCalc = result.status === "DRAFT";
  const periodDate = new Date(result.period);
  const periodLabel = `${MONTHS[periodDate.getMonth()]} ${periodDate.getFullYear()}`;
  const hasData = result.netAmount != null;

  // Staged payout (Tahap 1/2) is only ever disbursed against a locked-in
  // (FINALIZED) result — the numbers on a DRAFT/SIMULATED row can still
  // change, so marking a stage "paid" before finalization is blocked here
  // even though the server action itself doesn't enforce that gate.
  const canPayStages = result.status === "FINALIZED";
  const stage2ClawbackNum = result.stage2ClawbackAmount != null ? Number(result.stage2ClawbackAmount) : 0;

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

          {/* Skema Pembayaran Bertahap (Tahap 1/2) — opt-in per achievement schema */}
          {result.stage1Total != null && (
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                <WalletMoney weight="BoldDuotone" className="h-4 w-4" />
                Skema Pembayaran Bertahap
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Tahap 1</p>
                  <p className="text-sm font-semibold tabular-nums">{formatRupiah(result.stage1Total)}</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant={result.stage1PaidAt ? "default" : "secondary"} className="rounded-full">
                    {result.stage1PaidAt ? "Cair" : "Menunggu"}
                  </Badge>
                  {result.stage1PaidAt ? (
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(result.stage1PaidAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      {result.stage1PaidBy?.fullName ? ` · ${result.stage1PaidBy.fullName}` : ""}
                    </p>
                  ) : (
                    canPayStages && (
                      <PermissionGate module="kpi-insentif" action="pay">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-7 text-xs"
                          onClick={() => setConfirmStage(1)}
                          disabled={isMarkingStagePaid}
                        >
                          Tandai Lunas
                        </Button>
                      </PermissionGate>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-start justify-between gap-3 border-t pt-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Tahap 2</p>
                  <p className="text-sm font-semibold tabular-nums">{formatRupiah(result.stage2Total)}</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant={result.stage2PaidAt ? "default" : "secondary"} className="rounded-full">
                    {result.stage2PaidAt ? "Cair" : "Menunggu"}
                  </Badge>
                  {result.stage2PaidAt ? (
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(result.stage2PaidAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      {result.stage2PaidBy?.fullName ? ` · ${result.stage2PaidBy.fullName}` : ""}
                    </p>
                  ) : !result.stage1PaidAt ? (
                    <p className="text-[11px] text-muted-foreground">Tahap 1 harus lunas dulu</p>
                  ) : (
                    canPayStages && (
                      <div className="flex items-center justify-end gap-1">
                        {onRecomputeStagedPayment && (
                          <PermissionGate module="kpi-simulation" action="run">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full h-7 text-xs gap-1 px-2"
                              onClick={() => onRecomputeStagedPayment(result.id)}
                              disabled={isRecomputing}
                            >
                              <RefreshCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                              {isRecomputing ? "..." : "Re-evaluasi"}
                            </Button>
                          </PermissionGate>
                        )}
                        <PermissionGate module="kpi-insentif" action="pay">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-7 text-xs"
                            onClick={() => setConfirmStage(2)}
                            disabled={isMarkingStagePaid}
                          >
                            Tandai Lunas
                          </Button>
                        </PermissionGate>
                      </div>
                    )
                  )}
                </div>
              </div>

              {stage2ClawbackNum > 0 && (
                <p className="text-xs text-destructive">
                  Potongan pembatalan: {formatRupiah(result.stage2ClawbackAmount)}
                </p>
              )}
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
                onClick={() => setConfirmFinalize(true)}
                disabled={isFinalizing}
              >
                <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                {isFinalizing ? "Finalisasi..." : "Finalisasi"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Confirm: finalize (one-way — locks the result, no un-finalize action exists) */}
      <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalisasi Hasil KPI</AlertDialogTitle>
            <AlertDialogDescription>
              Hasil kalkulasi {result.profile.fullName ?? "karyawan ini"} untuk periode {periodLabel} akan
              dikunci dan tidak bisa dihitung ulang setelah difinalisasi. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={isFinalizing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() => {
                setConfirmFinalize(false);
                onFinalize(result.id);
              }}
              disabled={isFinalizing}
            >
              {isFinalizing ? "Finalisasi..." : "Ya, Finalisasi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: mark stage paid (one-way — no un-mark-paid action exists) */}
      <AlertDialog open={confirmStage !== null} onOpenChange={(open) => { if (!open) setConfirmStage(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai Tahap {confirmStage} Lunas</AlertDialogTitle>
            <AlertDialogDescription>
              Menandai Tahap {confirmStage} sebagai lunas tidak dapat dibatalkan setelahnya. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={isMarkingStagePaid}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() => {
                const stage = confirmStage;
                setConfirmStage(null);
                if (stage) onMarkStagePaid?.(result.id, stage);
              }}
              disabled={isMarkingStagePaid}
            >
              {isMarkingStagePaid ? "Menandai..." : "Ya, Tandai Lunas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}
