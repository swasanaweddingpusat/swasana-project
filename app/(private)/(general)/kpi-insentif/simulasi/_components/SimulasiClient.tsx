// FILE: app/(private)/(general)/kpi-insentif/simulasi/_components/SimulasiClient.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCircle,
  Filter,
  DangerCircle,
  InfoCircle,
  CheckCircle,
  Play,
} from "@solar-icons/react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";
import { useCalculationResults, useSaveCalculationResult, useFinalizeResult } from "@/hooks/useKpiInsentif";
import { useVenues } from "@/hooks/use-venues";
import {
  formatRupiah,
  formatKpiStatus,
  formatMissingReason,
} from "@/lib/utils/kpiFormatters";
import type { KpiCalculationResultItem } from "@/types/kpiInsentif";
import { ResultDetailDrawer } from "./ResultDetailDrawer";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Semua Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SIMULATED", label: "Simulasi" },
  { value: "PENDING_REVIEW", label: "Menunggu Review" },
  { value: "FINALIZED", label: "Final" },
];

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold font-heading text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SimulasiClient() {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRole, setFilterRole] = useState("all");
  const [filterVenueId, setFilterVenueId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedResult, setSelectedResult] = useState<KpiCalculationResultItem | null>(null);

  const { data: venues = [] } = useVenues();
  const period = `${filterYear}-${String(filterMonth).padStart(2, "0")}`;

  const { data: results = [], isLoading, refetch } = useCalculationResults({
    period,
    businessRole: filterRole !== "all" ? filterRole : undefined,
    venueId: filterVenueId !== "all" ? filterVenueId : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
  });

  const saveCalcMutation = useSaveCalculationResult();
  const finalizeMutation = useFinalizeResult();

  const filtered = results.filter((r) => {
    if (!search.trim()) return true;
    return (r.profile.fullName ?? "").toLowerCase().includes(search.toLowerCase());
  });
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  // Summary stats
  const totalKaryawan = filtered.length;
  const totalBonus = filtered.reduce((sum, r) => {
    return sum + (r.netAmount != null ? Number(r.netAmount) : 0);
  }, 0);
  const menungguKonfirmasi = filtered.filter((r) => r.status === "SIMULATED").length;
  const belumBisaFinalisasi = filtered.filter(
    (r) => r.missingDataReasons.length > 0
  ).length;

  async function handleRunCalc(result: KpiCalculationResultItem) {
    const d = new Date(result.period);
    const res = await saveCalcMutation.mutateAsync({
      profileId: result.profileId,
      periodMonth: d.getMonth() + 1,
      periodYear: d.getFullYear(),
      venueId: result.venueId,
    });
    if (res.success) {
      toast.success("Kalkulasi berhasil dijalankan");
    } else {
      toast.error(res.error ?? "Gagal menjalankan kalkulasi");
    }
  }

  async function handleFinalize(id: string) {
    const res = await finalizeMutation.mutateAsync(id);
    if (res.success) {
      toast.success("Hasil berhasil difinalisasi");
    } else {
      toast.error(res.error ?? "Gagal finalisasi");
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title="Simulasi & Rekonsiliasi KPI"
          description="Hitung, review, dan finalisasi hasil KPI per periode"
        />

        {/* Filter Bar */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Filter weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />

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

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="rounded-full w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterVenueId} onValueChange={setFilterVenueId}>
              <SelectTrigger className="rounded-full w-36">
                <SelectValue placeholder="Semua Venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Venue</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="rounded-full w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="search"
              placeholder="Cari nama..."
              className="rounded-full h-8 text-sm w-40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCircle weight="BoldDuotone" className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total Karyawan" value={totalKaryawan} />
          <SummaryCard
            label="Total Bonus (Bersih)"
            value={formatRupiah(totalBonus)}
            sub="Semua status"
          />
          <SummaryCard
            label="Menunggu Konfirmasi"
            value={menungguKonfirmasi}
            sub="Status SIMULASI"
          />
          <SummaryCard
            label="Belum Dapat Difinalisasi"
            value={belumBisaFinalisasi}
            sub="Ada data kurang"
          />
        </div>

        {/* Main Table */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-left font-semibold whitespace-nowrap">Nama</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Venue</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Dealing</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Omset</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Homebase</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Komisi</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Bonus</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Bersih</th>
                  <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Grade</th>
                  <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Status</th>
                  <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-muted-foreground">
                      Memuat data...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <InfoCircle weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          Belum ada data kalkulasi untuk periode{" "}
                          {MONTHS[filterMonth - 1]} {filterYear}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const hasMissing = r.missingDataReasons.length > 0;
                    const { label: statusLabel, variant: statusVariant } = formatKpiStatus(r.status);

                    return (
                      <tr
                        key={r.id}
                        className="border-b transition-colors cursor-pointer hover:bg-accent/30"
                        onClick={() => setSelectedResult(r)}
                      >
                        <td className="sticky left-0 z-10 px-4 py-3 bg-card whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {hasMissing && (
                              <Tooltip>
                                <TooltipTrigger render={<DangerCircle weight="BoldDuotone" className="h-4 w-4 text-destructive shrink-0" />} />
                                <TooltipContent className="max-w-xs space-y-1">
                                  {r.missingDataReasons.map((reason) => (
                                    <p key={reason} className="text-xs">{formatMissingReason(reason)}</p>
                                  ))}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <p className="font-medium text-sm">{r.profile.fullName ?? "-"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {r.venue?.name ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.realDealingTotal ?? "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(r.realOmsetTotal)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.realHomebase ?? "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(r.baseCommissionTotal)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatRupiah(r.totalBonus)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold">{formatRupiah(r.netAmount)}</td>
                        <td className="px-3 py-3 text-center font-semibold">{r.grade ?? "-"}</td>
                        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Badge variant={statusVariant} className="rounded-full text-xs">
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {r.status === "DRAFT" && (
                              <Tooltip>
                                <TooltipTrigger render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full"
                                    onClick={() => handleRunCalc(r)}
                                    disabled={saveCalcMutation.isPending}
                                  >
                                    <Play weight="BoldDuotone" className="h-3.5 w-3.5" />
                                  </Button>
                                } />
                                <TooltipContent>Jalankan Kalkulasi</TooltipContent>
                              </Tooltip>
                            )}
                            {r.status === "SIMULATED" && !hasMissing && (
                              <Tooltip>
                                <TooltipTrigger render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary"
                                    onClick={() => handleFinalize(r.id)}
                                    disabled={finalizeMutation.isPending}
                                  >
                                    <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                                  </Button>
                                } />
                                <TooltipContent>Finalisasi</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {selectedResult && (
        <ResultDetailDrawer
          result={selectedResult}
          isOpen={!!selectedResult}
          onClose={() => setSelectedResult(null)}
          onFinalize={handleFinalize}
          onRunCalc={handleRunCalc}
          isFinalizing={finalizeMutation.isPending}
          isRunningCalc={saveCalcMutation.isPending}
        />
      )}
    </TooltipProvider>
  );
}
