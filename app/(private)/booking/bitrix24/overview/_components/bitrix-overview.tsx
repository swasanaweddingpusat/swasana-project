"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Bolt,
  RefreshCircle,
  UsersGroupRounded,
  Buildings,
  ChatRoundLine,
  Link as LinkIcon,
  VolumeLoud,
  Leaf,
  DangerTriangle,
  Calendar as CalendarIcon,
} from "@solar-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Bucket {
  key: string;
  label: string;
  count: number;
}

interface AdBucket {
  key: string;
  url: string;
  count: number;
}

interface SalesBucket {
  key: string;
  label: string;
  count: number;
  getback: number;
}

interface OverviewData {
  range: { from: string; to: string };
  total: number;
  withVenue: number;
  organik: number;
  fromAds: number;
  spamPrank: number;
  sources: Bucket[];
  ads: AdBucket[];
  sales: SalesBucket[];
  venues: Bucket[];
  error?: string;
}

// Yesterday as a local Date — matches the daily report cadence.
function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Local calendar day (not UTC) — avoids the off-by-one from toISOString().
function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// Shorten an ad URL for display (drop protocol + trailing slash).
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function BitrixOverview() {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const y = yesterday();
    return { from: y, to: y };
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const from = range?.from ? toIsoDay(range.from) : "";
  const to = range?.to ? toIsoDay(range.to) : from;

  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`/api/bitrix/overview?${params.toString()}`);
        const json = (await res.json()) as OverviewData;
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat ringkasan.");
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Gagal terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, reloadKey]);

  const adsPct = data && data.total > 0 ? Math.round((data.fromAds / data.total) * 100) : 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header / filter card */}
      <Card className="flex flex-col gap-4 rounded-2xl p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Bolt weight="BoldDuotone" className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ringkasan CRM Bitrix24</p>
            <p className="font-heading text-lg font-semibold leading-tight">Perolehan Database Venue &amp; Sales</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-full items-center gap-2 rounded-full border border-input bg-background px-4 text-left text-sm sm:w-72",
                    "transition-colors hover:bg-accent",
                    range?.from ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <CalendarIcon weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {range?.from && range?.to
                      ? format(range.from, "dd MMM yyyy") === format(range.to, "dd MMM yyyy")
                        ? format(range.from, "dd MMM yyyy")
                        : `${format(range.from, "dd MMM yyyy")} — ${format(range.to, "dd MMM yyyy")}`
                      : range?.from
                        ? format(range.from, "dd MMM yyyy")
                        : "Pilih rentang tanggal"}
                  </span>
                </button>
              }
            />
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} autoFocus />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCircle weight="BoldDuotone" className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </Card>

      {error ? (
        <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard
              icon={<Buildings weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Database Venue"
              value={loading ? null : data?.withVenue ?? 0}
              hint={loading ? undefined : `dari ${data?.total ?? 0} total transaksi`}
            />
            <MetricCard
              icon={<ChatRoundLine weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Total Transaksi"
              value={loading ? null : data?.total ?? 0}
            />
            <MetricCard
              icon={<VolumeLoud weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Dari Iklan"
              value={loading ? null : data?.fromAds ?? 0}
              hint={loading ? undefined : `${adsPct}% dari total`}
            />
            <MetricCard
              icon={<Leaf weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Organik"
              value={loading ? null : data?.organik ?? 0}
            />
            <MetricCard
              icon={<DangerTriangle weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Spam/Prank"
              value={loading ? null : data?.spamPrank ?? 0}
              hint={loading ? undefined : "dari field issue"}
            />
          </div>

          {/* Breakdown lists */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BreakdownCard
              title="Sumber Database"
              icon={<ChatRoundLine weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
              buckets={data?.sources}
              total={data?.total ?? 0}
              loading={loading}
            />
            <VenueCard buckets={data?.venues} total={data?.withVenue ?? 0} loading={loading} />
            <SalesCard buckets={data?.sales} total={data?.total ?? 0} loading={loading} />
            <AdsCard buckets={data?.ads} organik={data?.organik ?? 0} total={data?.total ?? 0} loading={loading} />
          </div>

          <p className="px-1 text-xs text-muted-foreground">
            Data ditarik langsung dari CRM Bitrix24 (transaksi/deals dibuat pada rentang tanggal terpilih). Angka
            dapat berbeda dari report harian manual yang memakai konvensi filter/zona waktu tersendiri. Metrik
            respon/no-respon berasal dari tool chat dan tidak dihitung di sini.
          </p>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-2 rounded-2xl p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-semibold leading-tight">
          {value === null ? "…" : value.toLocaleString("id-ID")}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}

function CardShell({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

function BarRow({ label, count, total, right }: { label: React.ReactNode; count: number; total: number; right?: React.ReactNode }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="line-clamp-1 text-foreground">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {right}
          <span className="font-medium tabular-nums">
            {count.toLocaleString("id-ID")}
            <span className="ml-1 text-xs text-muted-foreground">({pct}%)</span>
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function BreakdownCard({
  title,
  icon,
  buckets,
  total,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  buckets: Bucket[] | undefined;
  total: number;
  loading: boolean;
}) {
  return (
    <CardShell title={title} icon={icon}>
      {loading ? (
        <LoadingRows />
      ) : !buckets || buckets.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <ul className="space-y-3">
          {buckets.map((b) => (
            <BarRow key={b.key} label={b.label} count={b.count} total={total} />
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function VenueCard({ buckets, total, loading }: { buckets: Bucket[] | undefined; total: number; loading: boolean }) {
  return (
    <BreakdownCard
      title="Venue"
      icon={<Buildings weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
      buckets={buckets}
      total={total}
      loading={loading}
    />
  );
}

function SalesCard({ buckets, total, loading }: { buckets: SalesBucket[] | undefined; total: number; loading: boolean }) {
  return (
    <CardShell
      title="Database Sales"
      icon={<UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
    >
      {loading ? (
        <LoadingRows />
      ) : !buckets || buckets.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <ul className="space-y-3">
          {buckets.map((b) => (
            <BarRow
              key={b.key}
              label={b.label}
              count={b.count}
              total={total}
              right={
                b.getback > 0 ? (
                  <Badge variant="secondary" className="rounded-full font-normal">
                    {b.getback} getback
                  </Badge>
                ) : undefined
              }
            />
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function AdsCard({
  buckets,
  organik,
  total,
  loading,
}: {
  buckets: AdBucket[] | undefined;
  organik: number;
  total: number;
  loading: boolean;
}) {
  return (
    <CardShell title="Sumber Iklan" icon={<VolumeLoud weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}>
      {loading ? (
        <LoadingRows />
      ) : !buckets || (buckets.length === 0 && organik === 0) ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <ul className="space-y-3">
          {buckets?.map((b) => (
            <BarRow
              key={b.key}
              total={total}
              count={b.count}
              label={
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <LinkIcon weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-1">{shortUrl(b.url)}</span>
                </a>
              }
            />
          ))}
          {organik > 0 && (
            <BarRow
              key="__organik__"
              total={total}
              count={organik}
              label={
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Leaf weight="BoldDuotone" className="h-3.5 w-3.5 shrink-0" />
                  Organik (tanpa iklan)
                </span>
              }
            />
          )}
        </ul>
      )}
    </CardShell>
  );
}
