"use client";

import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGuestbookFunnelReport } from "@/hooks/use-guestbook";
import type { GuestbookFunnelReport, GuestbookProspectBreakdown } from "@/lib/queries/guestbookEntries";

interface GuestbookFunnelReportSectionProps {
  dateRange: DateRange | undefined;
  venueIds: string[];
  hostId?: string;
}

type CellTone = "default" | "primary" | "secondary" | "destructive";

const CELL_TONE_CLASSNAMES: Record<CellTone, string> = {
  default: "border-border bg-card text-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
  secondary: "border-border bg-secondary text-secondary-foreground",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
};

function formatPct(value: number): string {
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString("id-ID");
}

function RatioCell({
  label,
  value,
  denominator,
  numerator,
}: {
  label: string;
  value: number;
  denominator: number;
  numerator: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center border-r border-border px-3 py-3 text-center last:border-r-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold text-primary">{formatPct(value)}</p>
      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
        {formatCount(numerator)} / {formatCount(denominator)}
      </p>
    </div>
  );
}

function DataCell({ label, value, tone = "default" }: { label: string; value: number; tone?: CellTone }) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-between gap-2 rounded-xl border p-3", CELL_TONE_CLASSNAMES[tone])}>
      <p className="text-xs font-medium leading-snug opacity-75">{label}</p>
      <p className="font-heading text-xl font-semibold tabular-nums">{formatCount(value)}</p>
    </div>
  );
}

function RatioGrid({
  report,
  ads,
  totalAdsUrl = 0,
}: {
  report: GuestbookFunnelReport;
  ads: boolean;
  totalAdsUrl?: number;
}) {
  const visitCount = report.visitVenue;
  const databaseCount = ads ? totalAdsUrl : report.database;
  const databaseToVisitPct = databaseCount > 0 ? (visitCount / databaseCount) * 100 : 0;
  const databaseToDealPct = databaseCount > 0 ? (report.deal / databaseCount) * 100 : 0;

  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-xl border bg-muted/30">
      <RatioCell
        label={ads ? "Ads URL → Visit Venue" : "Database → Visit"}
        value={databaseToVisitPct}
        denominator={databaseCount}
        numerator={visitCount}
      />
      <RatioCell
        label="Visit → Deal"
        value={report.visitToDealPct}
        denominator={visitCount}
        numerator={report.deal}
      />
      <RatioCell
        label={ads ? "Ads URL → Deal" : "Database → Deal"}
        value={databaseToDealPct}
        denominator={databaseCount}
        numerator={report.deal}
      />
    </div>
  );
}

function FunnelCells({ report, includeDatabase }: { report: GuestbookFunnelReport; includeDatabase: boolean }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", includeDatabase && "2xl:grid-cols-7")}>
      {includeDatabase ? <DataCell label="Database" value={report.database} tone="primary" /> : null}
      <DataCell label="Online Meeting" value={report.onlineMeeting} tone="secondary" />
      <DataCell label="Belum Visit" value={report.belumVisit} />
      <DataCell label="Visit Venue" value={report.visitVenue} tone="secondary" />
      <DataCell label="Tidak Jadi Visit (Lost)" value={report.tidakJadiVisitLost} tone="destructive" />
      <DataCell label="Deal" value={report.deal} tone="primary" />
      <DataCell label="No Deal (Lost)" value={report.noDealLost} tone="destructive" />
    </div>
  );
}

function AdsDatabaseBreakdown({ breakdown, total }: { breakdown: GuestbookProspectBreakdown; total: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Database</p>
        <p className="text-xs text-muted-foreground">Status prospek sesuai filter tanggal</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <DataCell label="Cold Prospek" value={breakdown.cold} />
        <DataCell label="Warm Prospek" value={breakdown.warm} />
        <DataCell label="Hot Prospek" value={breakdown.hot} />
        <DataCell label="No Response" value={breakdown.noResponse} />
        <DataCell label="Total Ads URL" value={total} tone="primary" />
      </div>
    </div>
  );
}

function PerformanceCard({
  title,
  description,
  report,
  ads = false,
  prospectBreakdown,
  totalAdsUrl = 0,
}: {
  title: string;
  description: string;
  report: GuestbookFunnelReport;
  ads?: boolean;
  prospectBreakdown?: GuestbookProspectBreakdown;
  totalAdsUrl?: number;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RatioGrid report={report} ads={ads} totalAdsUrl={totalAdsUrl} />
        {prospectBreakdown ? <AdsDatabaseBreakdown breakdown={prospectBreakdown} total={totalAdsUrl} /> : null}
        <FunnelCells report={report} includeDatabase={!ads} />
      </CardContent>
    </Card>
  );
}

function FunnelReportSkeleton() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function GuestbookFunnelReportSection({ dateRange, venueIds, hostId }: GuestbookFunnelReportSectionProps) {
  const { data, isLoading } = useGuestbookFunnelReport({
    venueIds: venueIds.length > 0 ? venueIds : undefined,
    hostId,
    dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <FunnelReportSkeleton />
        <FunnelReportSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <PerformanceCard
        title="Database Performance"
        description="Konversi seluruh database tamu sesuai filter aktif"
        report={data.overall}
      />
      <PerformanceCard
        title="Ads Performance"
        description="Status mengikuti filter tanggal; Total Ads URL dihitung terpisah"
        report={data.overall}
        ads
        prospectBreakdown={data.prospectBreakdown}
        totalAdsUrl={data.totalAdsUrl}
      />
    </div>
  );
}
