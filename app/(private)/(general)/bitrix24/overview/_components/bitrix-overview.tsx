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
  Tuning,
  CloseCircle,
  Download,
  FileText,
} from "@solar-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  exportBitrixOverviewExcel,
  exportBitrixOverviewPdf,
} from "@/lib/bitrix-overview-export";

// Pipeline (CATEGORY_ID) options — mirrors the Transaksi page; stable regardless
// of the current result set. "" = all pipelines.
const PIPELINE_ALL = "__all__";
const STAGE_ALL = "__all__";
const ISSUE_ALL = "__all__";
const PIPELINE_OPTIONS: { id: string; name: string }[] = [
  { id: "5", name: "Kediaman" },
  { id: "0", name: "Swasana" },
  { id: "1", name: "Gunawarman" },
  { id: "3", name: "Pakubuwono" },
];

interface StageCatalogItem {
  name: string;
  color: string;
  semantic: "won" | "lost" | "process";
  order: number;
}

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
  stageCatalog: StageCatalogItem[];
  issueCatalog: string[];
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

// The full set of applied filters that drive a fetch.
interface Filters {
  range: DateRange | undefined;
  pipeline: string; // "" = all
  stage: string; // "" = all (stage name)
  issue: string; // "" = all (issue label)
  client: string;
  sales: string;
}

function initialFilters(): Filters {
  const y = yesterday();
  return { range: { from: y, to: y }, pipeline: "", stage: "", issue: "", client: "", sales: "" };
}

export function BitrixOverview() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [stageCatalog, setStageCatalog] = useState<StageCatalogItem[]>([]);
  const [issueCatalog, setIssueCatalog] = useState<string[]>([]);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "pdf" | "excel"): Promise<void> {
    if (!data) return;
    setExporting(true);
    try {
      if (format === "excel") await exportBitrixOverviewExcel(data);
      else await exportBitrixOverviewPdf(data);
    } catch (err) {
      console.error("[bitrix overview] export failed", err);
    } finally {
      setExporting(false);
    }
  }

  const from = filters.range?.from ? toIsoDay(filters.range.from) : "";
  const to = filters.range?.to ? toIsoDay(filters.range.to) : from;

  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from, to });
        if (filters.pipeline) params.set("pipeline", filters.pipeline);
        if (filters.stage) params.set("stage", filters.stage);
        if (filters.issue) params.set("issue", filters.issue);
        if (filters.client) params.set("client", filters.client);
        if (filters.sales) params.set("sales", filters.sales);
        const res = await fetch(`/api/bitrix/overview?${params.toString()}`);
        const json = (await res.json()) as OverviewData;
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat ringkasan.");
          setData(null);
          return;
        }
        setData(json);
        if (json.stageCatalog?.length) setStageCatalog(json.stageCatalog);
        if (json.issueCatalog?.length) setIssueCatalog(json.issueCatalog);
      } catch {
        if (!cancelled) setError("Gagal terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, filters.pipeline, filters.stage, filters.issue, filters.client, filters.sales, reloadKey]);

  const adsPct = data && data.total > 0 ? Math.round((data.fromAds / data.total) * 100) : 0;

  // Count of non-default active filters — shown as a badge on the Filter button.
  const activeCount =
    (filters.pipeline ? 1 : 0) +
    (filters.stage ? 1 : 0) +
    (filters.issue ? 1 : 0) +
    (filters.client ? 1 : 0) +
    (filters.sales ? 1 : 0);

  function applyFilters(next: Filters) {
    setFilters(next);
    setFilterOpen(false);
  }

  function resetFilters() {
    setFilters(initialFilters());
    setFilterOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header / filter card */}
      <Card className="flex flex-col gap-4 rounded-xl p-5 lg:flex-row lg:items-center lg:justify-between">
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
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shrink-0 rounded-full" disabled={!data || exporting}>
                <Download weight="BoldDuotone" className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport("pdf")}>
                <FileText weight="BoldDuotone" className="mr-2 h-4 w-4" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport("excel")}>
                <Download weight="BoldDuotone" className="mr-2 h-4 w-4" />
                Export Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter — grouped popover: date, pipeline, tahap, client, sales */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="shrink-0 rounded-full">
                  <Tuning weight="BoldDuotone" className="h-4 w-4" />
                  Filter
                  {activeCount > 0 && (
                    <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-auto max-w-[92vw] p-0" align="end">
              <FilterPanel
                initial={filters}
                stageCatalog={stageCatalog}
                issueCatalog={issueCatalog}
                onApply={applyFilters}
                onReset={resetFilters}
              />
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
        <Card className="rounded-xl p-8 text-center text-sm text-destructive">{error}</Card>
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

// Grouped filter panel rendered inside the Filter popover. Holds its own draft
// state so the parent only re-fetches when the user hits "Terapkan".
function FilterPanel({
  initial,
  stageCatalog,
  issueCatalog,
  onApply,
  onReset,
}: {
  initial: Filters;
  stageCatalog: StageCatalogItem[];
  issueCatalog: string[];
  onApply: (next: Filters) => void;
  onReset: () => void;
}) {
  const [range, setRange] = useState<DateRange | undefined>(initial.range);
  const [pipeline, setPipeline] = useState(initial.pipeline);
  const [stage, setStage] = useState(initial.stage);
  const [issue, setIssue] = useState(initial.issue);
  const [client, setClient] = useState(initial.client);
  const [sales, setSales] = useState(initial.sales);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Tuning weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-heading text-sm font-semibold">Filter Transaksi</h4>
      </div>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4">
        {/* By date */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Rentang Tanggal</Label>
          <div className="flex justify-center rounded-xl border">
            <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} autoFocus />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* By pipeline */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pipeline</Label>
            <Select
              value={pipeline === "" ? PIPELINE_ALL : pipeline}
              onValueChange={(v) => setPipeline(v === PIPELINE_ALL ? "" : v)}
            >
              <SelectTrigger className="w-full rounded-full">
                <SelectValue placeholder="Semua pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PIPELINE_ALL}>Semua pipeline</SelectItem>
                {PIPELINE_OPTIONS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* By tahap */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tahap</Label>
            <Select value={stage === "" ? STAGE_ALL : stage} onValueChange={(v) => setStage(v === STAGE_ALL ? "" : v)}>
              <SelectTrigger className="w-full rounded-full">
                <SelectValue placeholder="Semua tahap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STAGE_ALL}>Semua tahap</SelectItem>
                {stageCatalog.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* By issue */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Issue</Label>
            <Select value={issue === "" ? ISSUE_ALL : issue} onValueChange={(v) => setIssue(v === ISSUE_ALL ? "" : v)}>
              <SelectTrigger className="w-full rounded-full">
                <SelectValue placeholder="Semua issue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ISSUE_ALL}>Semua issue</SelectItem>
                {issueCatalog.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* By nama client */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nama Client</Label>
            <Input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Cari nama client…"
              className="rounded-full"
            />
          </div>

          {/* By nama sales */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nama Sales</Label>
            <Input
              value={sales}
              onChange={(e) => setSales(e.target.value)}
              placeholder="Cari nama sales…"
              className="rounded-full"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onReset}>
          <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
          Reset
        </Button>
        <Button
          size="sm"
          className="rounded-full"
          onClick={() =>
            onApply({
              range,
              pipeline,
              stage,
              issue,
              client: client.trim(),
              sales: sales.trim(),
            })
          }
        >
          Terapkan
        </Button>
      </div>
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
    <Card className="flex flex-col gap-2 rounded-xl p-5">
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
