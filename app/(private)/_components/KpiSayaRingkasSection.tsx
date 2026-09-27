import Link from "next/link";
import { Target, CupStar } from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { SummaryCard } from "@/components/shared/SummaryCard";
import {
  formatRupiah,
  formatKpiStatus,
  achievementColorClass,
  clampPct,
} from "@/lib/utils/kpiFormatters";
import type { KpiSayaSummary } from "@/lib/queries/kpiInsentif";

function MiniProgressBar({ label, pct }: { label: string; pct: number | null }) {
  const pctNum = clampPct(pct);
  const fillClass = achievementColorClass(pct);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{pct != null ? `${pct.toFixed(0)}%` : "-"}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${pctNum}%` }} />
      </div>
    </div>
  );
}

export function KpiSayaRingkasSection({ summary }: { summary: KpiSayaSummary }) {
  const statusInfo = formatKpiStatus(summary.status);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
          <Target weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
          KPI Saya
        </h2>
        <Link href="/kpi-insentif/kpi-saya" className="text-sm font-medium text-primary hover:underline">
          Lihat Detail
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Grade" value={summary.grade ?? "—"} />
        <SummaryCard label="Status" value={statusInfo.label} />
        <SummaryCard label="Total Bersih" value={formatRupiah(summary.netAmount)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniProgressBar label="Dealing" pct={summary.dealingAchievementPct} />
        <MiniProgressBar label="Omset" pct={summary.omsetAchievementPct} />
        <MiniProgressBar label="Homebase" pct={summary.homebaseAchievementPct} />
      </div>

      {summary.stage1Total != null && (
        <div className="flex items-center gap-4 border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">
            Tahap 1:{" "}
            <span className={summary.stage1PaidAt ? "font-medium text-primary" : "text-muted-foreground"}>
              {summary.stage1PaidAt ? "Cair" : "Menunggu"}
            </span>
          </span>
          {summary.stage2Total != null && (
            <span className="text-muted-foreground">
              Tahap 2:{" "}
              <span className={summary.stage2PaidAt ? "font-medium text-primary" : "text-muted-foreground"}>
                {summary.stage2PaidAt ? "Cair" : "Menunggu"}
              </span>
            </span>
          )}
        </div>
      )}

      {summary.awardsWon.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {summary.awardsWon.map((a) => (
            <Badge key={a.id} variant="secondary" className="rounded-full gap-1">
              <CupStar weight="BoldDuotone" className="h-3.5 w-3.5" />
              {a.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
