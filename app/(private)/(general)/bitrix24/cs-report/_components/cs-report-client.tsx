"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ClipboardCheck,
  ChatRoundLine,
  Buildings,
  CheckCircle,
  DangerCircle,
  DangerTriangle,
  VolumeLoud,
  Leaf,
  Link as LinkIcon,
  CalendarDate,
  RefreshCircle,
  Copy,
  Share,
} from "@solar-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useCsReport,
  type CsReportBucket,
  type CsReportAdBucket,
} from "@/hooks/use-cs-report";

// Yesterday as a local Date at midnight — matches the CS daily report cadence
// (mirrors bitrix-overview.tsx's `yesterday()`).
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

function sumCounts(list: { count: number }[] | undefined): number {
  return (list ?? []).reduce((acc, b) => acc + b.count, 0);
}

export function CsReportClient() {
  const [date, setDate] = useState<Date>(yesterday);
  const iso = toIsoDay(date);

  const query = useCsReport(iso);
  const data = query.data ?? null;
  const loading = query.isPending;
  const refreshing = query.isFetching;
  const error = query.isError
    ? query.error instanceof Error
      ? query.error.message
      : "Gagal memuat report chat CS."
    : null;

  function handleSelectDate(next: Date | undefined) {
    if (!next) return;
    setDate(next);
  }

  function handleRefresh() {
    void query.refetch();
  }

  function handleCopy() {
    if (!data?.message) return;
    navigator.clipboard
      .writeText(data.message)
      .then(() => toast.success("Report disalin ke clipboard"))
      .catch(() => toast.error("Gagal menyalin report"));
  }

  function handleWhatsApp() {
    if (!data?.message) return;
    const url = `https://wa.me/?text=${encodeURIComponent(data.message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header / date picker card */}
      <Card className="flex flex-col gap-4 rounded-xl p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
            <ClipboardCheck weight="BoldDuotone" className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ringkasan CS Bitrix24</p>
            <p className="font-heading text-lg font-semibold leading-tight">Report Chat CS</p>
            <p className="text-xs text-muted-foreground">
              Recap chat masuk harian dari Bitrix24 &amp; auto-generate teks report WhatsApp CS.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger
              className={cn(
                "flex h-10 items-center gap-2 rounded-full border border-input bg-background px-4 text-sm",
                "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <CalendarDate weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{format(date, "d MMM yyyy")}</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={handleSelectDate} autoFocus />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCircle weight="BoldDuotone" className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </Card>

      {error ? (
        <Card className="rounded-xl p-8 text-center text-sm text-destructive">{error}</Card>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard
              icon={<ChatRoundLine weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Total Chat Masuk"
              value={loading ? null : data?.totalChatMasuk ?? 0}
            />
            <MetricCard
              icon={<Buildings weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Chat Jadi Database"
              value={loading ? null : data?.chatJadiDatabase ?? 0}
            />
            <MetricCard
              icon={<CheckCircle weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Database Respon"
              value={loading ? null : data?.databaseRespon ?? 0}
            />
            <MetricCard
              icon={<DangerCircle weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Database No Respon"
              value={loading ? null : data?.databaseNoRespon ?? 0}
              danger={!loading && (data?.databaseNoRespon ?? 0) > 0}
            />
            <MetricCard
              icon={<DangerTriangle weight="BoldDuotone" className="h-5 w-5 text-foreground" />}
              label="Spam/Prank"
              value={loading ? null : data?.spamPrank ?? 0}
            />
          </div>

          {/* Breakdown lists */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AdsSpamCard adsSpam={data?.adsSpam} organik={data?.organikSpam ?? 0} loading={loading} />
            <SourcesCard sources={data?.sources} loading={loading} />
          </div>

          {/* WA Report panel */}
          <WaReportCard
            message={data?.message}
            loading={loading}
            onCopy={handleCopy}
            onShare={handleWhatsApp}
          />

          <p className="px-1 text-xs text-muted-foreground">
            Data ditarik langsung dari CRM Bitrix24 untuk tanggal {format(date, "d MMM yyyy")}. Angka dapat
            berbeda dari report harian manual yang memakai konvensi filter/zona waktu tersendiri.
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
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  danger?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-2 rounded-xl p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-heading text-2xl font-semibold leading-tight",
            danger ? "text-destructive" : "text-foreground",
          )}
        >
          {value === null ? "…" : value.toLocaleString("id-ID")}
        </p>
      </div>
    </Card>
  );
}

function CardShell({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="rounded-xl p-5">
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
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

function BarRow({
  label,
  count,
  total,
  right,
}: {
  label: React.ReactNode;
  count: number;
  total: number;
  right?: React.ReactNode;
}) {
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

function AdsSpamCard({
  adsSpam,
  organik,
  loading,
}: {
  adsSpam: CsReportAdBucket[] | undefined;
  organik: number;
  loading: boolean;
}) {
  const total = sumCounts(adsSpam) + organik;
  return (
    <CardShell
      title="Sumber Iklan Spam"
      icon={<VolumeLoud weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
    >
      {loading ? (
        <LoadingRows />
      ) : !adsSpam || (adsSpam.length === 0 && organik === 0) ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <ul className="space-y-3">
          {adsSpam.map((b) => (
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

function SourcesCard({ sources, loading }: { sources: CsReportBucket[] | undefined; loading: boolean }) {
  const total = sumCounts(sources);
  return (
    <CardShell
      title="Sumber Chat Masuk"
      icon={<ChatRoundLine weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />}
    >
      {loading ? (
        <LoadingRows />
      ) : !sources || sources.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <ul className="space-y-3">
          {sources.map((b) => (
            <BarRow key={b.key} label={b.label} count={b.count} total={total} />
          ))}
        </ul>
      )}
    </CardShell>
  );
}

function WaReportCard({
  message,
  loading,
  onCopy,
  onShare,
}: {
  message: string | undefined;
  loading: boolean;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <Card className="rounded-xl p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold">WA Report</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={loading || !message}
            onClick={onCopy}
          >
            <Copy weight="BoldDuotone" className="h-4 w-4" />
            Copy
          </Button>
          <Button size="sm" className="rounded-full" disabled={loading || !message} onClick={onShare}>
            <Share weight="BoldDuotone" className="h-4 w-4" />
            Kirim via WhatsApp
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : !message ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada data report.</p>
      ) : (
        <pre className="whitespace-pre-wrap rounded-xl bg-muted p-4 font-mono text-sm text-foreground">
          {message}
        </pre>
      )}
    </Card>
  );
}
