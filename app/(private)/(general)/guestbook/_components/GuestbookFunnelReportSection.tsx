"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartSquare,
  Videocamera,
  UsersGroupRounded,
  Buildings2,
  TrashBinTrash,
  MedalStar,
  Snowflake,
  Fire,
  Flame,
  GraphUp,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useGuestbookFunnelReport } from "@/hooks/use-guestbook";
import type { GuestbookFunnelReport, GuestbookProspectBreakdown } from "@/lib/queries/guestbookEntries";

interface GuestbookFunnelReportSectionProps {
  dateRange: DateRange | undefined;
  venueIds: string[];
  hostId?: string;
}

function formatPct(value: number): string {
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString("id-ID");
}

type StatTone = "primary" | "muted" | "destructive" | "success";

const STAT_TONE_CLASSNAMES: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-emerald-100 text-emerald-700",
};

function StatBlock({
  label,
  value,
  icon,
  tone = "muted",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: StatTone;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-2xl p-4", STAT_TONE_CLASSNAMES[tone])}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-heading font-semibold">{formatCount(value)}</p>
    </div>
  );
}

function RatioPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-full border bg-card px-4 py-3 text-center shadow-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-lg font-semibold text-primary">{formatPct(value)}</span>
    </div>
  );
}

function FunnelReportCard({
  title,
  description,
  report,
  prospectBreakdown,
}: {
  title: string;
  description: string;
  report: GuestbookFunnelReport;
  prospectBreakdown?: GuestbookProspectBreakdown;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatBlock label="Database" value={report.database} icon={<ChartSquare weight="BoldDuotone" className="h-4 w-4" />} tone="primary" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatBlock label="Online Meeting" value={report.onlineMeeting} icon={<Videocamera weight="BoldDuotone" className="h-4 w-4" />} />
          <StatBlock label="Belum Visit" value={report.belumVisit} icon={<UsersGroupRounded weight="BoldDuotone" className="h-4 w-4" />} />
          <StatBlock label="Visit Venue" value={report.visitVenue} icon={<Buildings2 weight="BoldDuotone" className="h-4 w-4" />} />
          <StatBlock
            label="Tidak Jadi Visit (Lost)"
            value={report.tidakJadiVisitLost}
            icon={<TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />}
            tone="destructive"
          />
          <StatBlock
            label="No Deal (Lost)"
            value={report.noDealLost}
            icon={<TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />}
            tone="destructive"
          />
          <StatBlock label="Deal" value={report.deal} icon={<MedalStar weight="BoldDuotone" className="h-4 w-4" />} tone="success" />
        </div>

        {prospectBreakdown && (
          <div className="grid grid-cols-3 gap-3">
            <StatBlock label="Cold" value={prospectBreakdown.cold} icon={<Snowflake weight="BoldDuotone" className="h-4 w-4" />} />
            <StatBlock label="Warm" value={prospectBreakdown.warm} icon={<Flame weight="BoldDuotone" className="h-4 w-4" />} />
            <StatBlock label="Hot" value={prospectBreakdown.hot} icon={<Fire weight="BoldDuotone" className="h-4 w-4" />} tone="destructive" />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <RatioPill label="Database → Visit" value={report.databaseToVisitPct} />
          <RatioPill label="Visit → Deal" value={report.visitToDealPct} />
          <RatioPill label="Database → Deal" value={report.databaseToDealPct} />
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelReportSkeleton() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 flex-1 rounded-full" />
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelReportSkeleton />
        <FunnelReportSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <FunnelReportCard
        title="Database Ratio"
        description="Funnel konversi seluruh database tamu sesuai filter aktif"
        report={data.overall}
      />
      <FunnelReportCard
        title="Ads Ratio Performance"
        description="Funnel konversi khusus tamu yang datang lewat iklan"
        report={data.ads}
        prospectBreakdown={data.adsProspectBreakdown}
      />
      <Card className="rounded-2xl shadow-sm lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraphUp weight="BoldDuotone" className="h-4 w-4 text-primary" />
            Catatan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            &ldquo;Tidak Jadi Visit (Lost)&rdquo; adalah tamu yang hilang sebelum sempat visit venue,
            sedangkan &ldquo;No Deal (Lost)&rdquo; adalah tamu yang sudah visit venue tapi tidak deal.
            Laporan ini memakai filter tanggal, venue, dan PIC yang sama dengan tab Data Tamu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
