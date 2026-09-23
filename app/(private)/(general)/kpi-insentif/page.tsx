import { Metadata } from "next";
import Link from "next/link";
import { ChartSquare, ClipboardList, CupStar, UserHands } from "@solar-icons/react";
import { requirePagePermission } from "@/lib/require-page-permission";
import { getCalculationResults, getKpiMasters } from "@/lib/queries/kpiInsentif";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard KPI & Insentif" };

const shortcuts = [
  { href: "/kpi-insentif/kpi-saya", label: "KPI Saya", description: "Target dan hasil penilaian pribadi", icon: UserHands },
  { href: "/kpi-insentif/konfigurasi", label: "Master & Template", description: "Indikator, skema, dan master KPI", icon: ClipboardList },
  { href: "/kpi-insentif/penugasan", label: "Penugasan Target", description: "Assignment per karyawan dan periode", icon: CupStar },
  { href: "/kpi-insentif/simulasi", label: "Review & Simulasi", description: "Kalkulasi dan pemeriksaan hasil", icon: ChartSquare },
];

export default async function Page() {
  await requirePagePermission("kpi-insentif");
  const [masters, results] = await Promise.all([
    getKpiMasters({}),
    getCalculationResults({}),
  ]);

  const pendingReview = results.filter((result) => result.status === "PENDING_REVIEW").length;
  const finalized = results.filter((result) => result.status === "FINALIZED").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Dashboard KPI &amp; Insentif</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan template, assignment, review, dan hasil penilaian.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Template aktif", value: masters.filter((master) => !master.isDraft).length },
          { label: "Menunggu review", value: pendingReview },
          { label: "Hasil final", value: finalized },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 font-heading text-3xl font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shortcuts.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent")}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon weight="BoldDuotone" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
