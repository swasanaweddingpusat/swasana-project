"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Drawer } from "@/components/shared/drawer";
import { cn } from "@/lib/utils";
import { useGuestbookFunnelReport, useGuestbookFunnelBucketEntries } from "@/hooks/use-guestbook";
import { prospectStatusClass } from "@/lib/prospect-status";
import type {
  GuestbookFunnelReport,
  GuestbookProspectBreakdown,
  GuestbookFunnelBucketKey,
} from "@/lib/queries/guestbookEntries";

interface GuestbookFunnelReportSectionProps {
  dateRange: DateRange | undefined;
  venueIds: string[];
  hostId?: string;
}

interface ActiveBucket {
  key: GuestbookFunnelBucketKey;
  label: string;
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

function DataCell({
  label,
  value,
  tone = "default",
  onClick,
}: {
  label: string;
  value: number;
  tone?: CellTone;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex min-w-0 flex-col justify-between gap-2 rounded-xl border p-3 text-left",
        CELL_TONE_CLASSNAMES[tone],
        onClick && "cursor-pointer transition-shadow hover:shadow-md"
      )}
    >
      <p className="text-xs font-medium leading-snug opacity-75">{label}</p>
      <p className="font-heading text-xl font-semibold tabular-nums">{formatCount(value)}</p>
    </button>
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
  // Untuk Ads, `report` sudah berupa funnel yang datasetnya dibatasi ke entry
  // ber-Ads URL, jadi pembilang dan penyebut berasal dari populasi yang sama.
  const visitCount = report.visitVenue;
  const databaseCount = ads ? totalAdsUrl : report.database;
  const databaseToVisitPct = databaseCount > 0 ? (visitCount / databaseCount) * 100 : 0;
  const databaseToDealPct = databaseCount > 0 ? (report.deal / databaseCount) * 100 : 0;

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-muted/30">
      <RatioCell
        label={ads ? "Ads → Visit Venue" : "Database → Visit"}
        value={databaseToVisitPct}
        denominator={databaseCount}
        numerator={visitCount}
      />
      <RatioCell
        label={ads ? "Ads → Deal" : "Database → Deal"}
        value={databaseToDealPct}
        denominator={databaseCount}
        numerator={report.deal}
      />
    </div>
  );
}

function FunnelCells({
  report,
  includeDatabase,
  onCellClick,
}: {
  report: GuestbookFunnelReport;
  includeDatabase: boolean;
  onCellClick: (bucket: ActiveBucket) => void;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", includeDatabase && "2xl:grid-cols-7")}>
      {includeDatabase ? (
        <DataCell
          label="Database"
          value={report.database}
          tone="primary"
          onClick={() => onCellClick({ key: "database", label: "Database" })}
        />
      ) : null}
      <DataCell
        label="Online Meeting"
        value={report.onlineMeeting}
        tone="secondary"
        onClick={() => onCellClick({ key: "onlineMeeting", label: "Online Meeting" })}
      />
      <DataCell
        label="Belum Visit"
        value={report.belumVisit}
        onClick={() => onCellClick({ key: "belumVisit", label: "Belum Visit" })}
      />
      <DataCell
        label="Visit Venue"
        value={report.visitVenue}
        tone="secondary"
        onClick={() => onCellClick({ key: "visitVenue", label: "Visit Venue" })}
      />
      <DataCell
        label="Tidak Jadi Visit (Lost)"
        value={report.tidakJadiVisitLost}
        tone="destructive"
        onClick={() => onCellClick({ key: "tidakJadiVisitLost", label: "Tidak Jadi Visit (Lost)" })}
      />
      <DataCell
        label="Deal"
        value={report.deal}
        tone="primary"
        onClick={() => onCellClick({ key: "deal", label: "Deal" })}
      />
      <DataCell
        label="No Deal (Lost)"
        value={report.noDealLost}
        tone="destructive"
        onClick={() => onCellClick({ key: "noDealLost", label: "No Deal (Lost)" })}
      />
    </div>
  );
}

function AdsDatabaseBreakdown({
  breakdown,
  total,
  onCellClick,
}: {
  breakdown: GuestbookProspectBreakdown;
  total: number;
  onCellClick: (bucket: ActiveBucket) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Database</p>
        <p className="text-xs text-muted-foreground">Status prospek sesuai filter tanggal</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <DataCell
          label="Cold Prospek"
          value={breakdown.cold}
          onClick={() => onCellClick({ key: "cold", label: "Cold Prospek" })}
        />
        <DataCell
          label="Warm Prospek"
          value={breakdown.warm}
          onClick={() => onCellClick({ key: "warm", label: "Warm Prospek" })}
        />
        <DataCell
          label="Hot Prospek"
          value={breakdown.hot}
          onClick={() => onCellClick({ key: "hot", label: "Hot Prospek" })}
        />
        <DataCell
          label="No Response"
          value={breakdown.noResponse}
          onClick={() => onCellClick({ key: "noResponse", label: "No Response" })}
        />
        <DataCell
          label="Total Ads"
          value={total}
          tone="primary"
          onClick={() => onCellClick({ key: "totalAds", label: "Total Ads" })}
        />
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
  onCellClick,
}: {
  title: string;
  description: string;
  report: GuestbookFunnelReport;
  ads?: boolean;
  prospectBreakdown?: GuestbookProspectBreakdown;
  totalAdsUrl?: number;
  onCellClick: (bucket: ActiveBucket) => void;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="font-heading text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RatioGrid report={report} ads={ads} totalAdsUrl={totalAdsUrl} />
        {prospectBreakdown ? (
          <AdsDatabaseBreakdown breakdown={prospectBreakdown} total={totalAdsUrl} onCellClick={onCellClick} />
        ) : null}
        <FunnelCells report={report} includeDatabase={!ads} onCellClick={onCellClick} />
      </CardContent>
    </Card>
  );
}

function FunnelBucketDrawer({
  bucket,
  onClose,
  venueIds,
  hostId,
  dateFrom,
  dateTo,
}: {
  bucket: ActiveBucket;
  onClose: () => void;
  venueIds: string[];
  hostId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { data: entries, isLoading } = useGuestbookFunnelBucketEntries(bucket.key, {
    venueIds: venueIds.length > 0 ? venueIds : undefined,
    hostId,
    dateFrom,
    dateTo,
  });

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={`${bucket.label} (${entries?.length ?? 0})`}
      maxWidth="sm:max-w-2xl"
    >
      {isLoading ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-40">Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="line-clamp-1">{entry.visitorName}</span>
                      {entry.companyName && (
                        <span className="text-xs text-muted-foreground">{entry.companyName}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{entry.phoneNumber || "—"}</TableCell>
                  <TableCell>
                    {entry.prospectStatus ? (
                      <Badge className={cn("rounded-full text-[10px]", prospectStatusClass(entry.prospectStatus.name))}>
                        {entry.prospectStatus.name}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{entry.host?.fullName || "—"}</TableCell>
                  <TableCell className="text-sm">{entry.venue?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{entry.sourceOfInformation?.name || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(entry.checkInAt), "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Drawer>
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
  const dateFrom = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const dateTo = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
  const [activeBucket, setActiveBucket] = useState<ActiveBucket | null>(null);

  const { data, isLoading } = useGuestbookFunnelReport({
    venueIds: venueIds.length > 0 ? venueIds : undefined,
    hostId,
    dateFrom,
    dateTo,
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
        description="Konversi seluruh database tamu per tanggal input sales"
        report={data.overall}
        onCellClick={setActiveBucket}
      />
      <PerformanceCard
        title="Ads Performance"
        description="Hanya data dari Ads, mengikuti tanggal input sales"
        report={data.ads}
        ads
        prospectBreakdown={data.prospectBreakdown}
        totalAdsUrl={data.totalAdsUrl}
        onCellClick={setActiveBucket}
      />
      {activeBucket ? (
        <FunnelBucketDrawer
          bucket={activeBucket}
          onClose={() => setActiveBucket(null)}
          venueIds={venueIds}
          hostId={hostId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      ) : null}
    </div>
  );
}
