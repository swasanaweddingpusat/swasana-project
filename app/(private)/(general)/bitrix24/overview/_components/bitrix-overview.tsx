"use client";

import { useEffect, useMemo, useState } from "react";
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
  CalendarDate,
  CheckCircle,
  DangerCircle,
} from "@solar-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import {
  exportBitrixOverviewExcel,
  exportBitrixOverviewPdf,
} from "@/lib/bitrix-overview-export";
import {
  useBitrixOverview,
  type BitrixOverviewData as OverviewData,
  type Bucket,
  type AdBucket,
  type OverviewSalesBucket as SalesBucket,
  type StageCatalogItem,
} from "@/hooks/use-bitrix-overview";

// Pipeline (CATEGORY_ID) options — mirrors the Transaksi page; stable regardless
// of the current result set. "" = all pipelines.
const PIPELINE_ALL = "__all__";
const STAGE_ALL = "__all__";
const ISSUE_ALL = "__all__";
const SALES_ALL = "__all__";
const CLIENT_ALL = "__all__";
const PIPELINE_OPTIONS: { id: string; name: string }[] = [
  { id: "5", name: "Kediaman" },
  { id: "0", name: "Swasana" },
  { id: "1", name: "Gunawarman" },
  { id: "3", name: "Pakubuwono" },
];

// A resolved sales/client picked from an async SearchableSelect.
interface PersonOption {
  id: string;
  name: string;
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

// Format a date range for a Popover trigger label, e.g. "12 Agu – 15 Agu 2026"
// (or a single date when from === to). Falls back to `placeholder` when empty.
function formatDateRangeLabel(range: DateRange | undefined, placeholder: string): string {
  if (!range?.from) return placeholder;
  const from = format(range.from, "d MMM yyyy");
  const to = range.to ? format(range.to, "d MMM yyyy") : from;
  if (from === to) return from;
  return `${from} – ${to}`;
}

// The full set of applied filters that drive a fetch.
interface Filters {
  range: DateRange | undefined;
  pipeline: string; // "" = all
  stage: string; // "" = all (stage name)
  issue: string; // "" = all (issue label)
  client: PersonOption | null;
  sales: PersonOption | null;
  dbRange: DateRange | undefined; // optional — "Tanggal Database" (UF_CRM_1786680629702)
}

function initialFilters(): Filters {
  const y = yesterday();
  return {
    range: { from: y, to: y },
    pipeline: "",
    stage: "",
    issue: "",
    client: null,
    sales: null,
    dbRange: undefined,
  };
}

export function BitrixOverview() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [stageCatalog, setStageCatalog] = useState<StageCatalogItem[]>([]);
  const [issueCatalog, setIssueCatalog] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const from = filters.range?.from ? toIsoDay(filters.range.from) : "";
  const to = filters.range?.to ? toIsoDay(filters.range.to) : from;
  const dbFrom = filters.dbRange?.from ? toIsoDay(filters.dbRange.from) : "";
  const dbTo = filters.dbRange?.from ? toIsoDay(filters.dbRange.to ?? filters.dbRange.from) : "";

  // Live-polled via TanStack Query, 30s TTL mirroring the server's Bitrix read
  // cache (lib/bitrix-cache.ts FRESH_WINDOW_MS) — see hooks/use-bitrix-overview.ts.
  const overviewQuery = useBitrixOverview({
    from,
    to,
    pipeline: filters.pipeline || undefined,
    stage: filters.stage || undefined,
    issue: filters.issue || undefined,
    clientId: filters.client?.id,
    salesId: filters.sales?.id,
    dbFrom: dbFrom || undefined,
    dbTo: dbTo || undefined,
  });

  const data = overviewQuery.data ?? null;
  const loading = overviewQuery.isPending;
  const error = overviewQuery.isError
    ? overviewQuery.error instanceof Error
      ? overviewQuery.error.message
      : "Gagal memuat ringkasan."
    : null;
  const refreshing = overviewQuery.isFetching;

  useEffect(() => {
    if (overviewQuery.data?.stageCatalog?.length) setStageCatalog(overviewQuery.data.stageCatalog);
    if (overviewQuery.data?.issueCatalog?.length) setIssueCatalog(overviewQuery.data.issueCatalog);
  }, [overviewQuery.data]);

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

  const adsPct = data && data.total > 0 ? Math.round((data.fromAds / data.total) * 100) : 0;

  // Count of non-default active filters — shown as a badge on the Filter button.
  const activeCount =
    (filters.pipeline ? 1 : 0) +
    (filters.stage ? 1 : 0) +
    (filters.issue ? 1 : 0) +
    (filters.client ? 1 : 0) +
    (filters.sales ? 1 : 0) +
    (filters.dbRange?.from ? 1 : 0);

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

          {/* Filter — grouped drawer: date, pipeline, tahap, client, sales */}
          <Button variant="outline" className="shrink-0 rounded-full" onClick={() => setFilterOpen(true)}>
            <Tuning weight="BoldDuotone" className="h-4 w-4" />
            Filter
            {activeCount > 0 && (
              <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                {activeCount}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => {
              void overviewQuery.refetch();
            }}
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

          {/* Database Kantor vs Mandiri — mandiri = Live TikTok / Referral */}
          <KantorMandiriCard data={data} loading={loading} />

          {/* Response Status — sudah dibalas vs belum dibalas, filter-aware */}
          <ResponseStatusCard data={data} loading={loading} />

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
          </div>

          <SalesTable buckets={data?.sales} loading={loading} />

          <AdsCard buckets={data?.ads} organik={data?.organik ?? 0} total={data?.total ?? 0} loading={loading} />

          <p className="px-1 text-xs text-muted-foreground">
            Data ditarik langsung dari CRM Bitrix24 (transaksi/deals dibuat pada rentang tanggal terpilih). Angka
            dapat berbeda dari report harian manual yang memakai konvensi filter/zona waktu tersendiri.
          </p>
        </>
      )}

      <Drawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Transaksi"
        maxWidth="sm:max-w-md"
      >
        <FilterPanel
          initial={filters}
          stageCatalog={stageCatalog}
          issueCatalog={issueCatalog}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      </Drawer>
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
  const [client, setClient] = useState<PersonOption | null>(initial.client);
  const [sales, setSales] = useState<PersonOption | null>(initial.sales);
  const [dbRange, setDbRange] = useState<DateRange | undefined>(initial.dbRange);

  // Nama Client — async search hits the server (Bitrix crm.contact.list typeahead)
  // once the user types. There's no preloaded roster (unlike Sales), so the
  // options list is just the last search results plus the currently-selected
  // option (kept present so its label still shows once search is cleared).
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<PersonOption[]>([]);
  const [clientSearching, setClientSearching] = useState(false);

  useEffect(() => {
    const q = clientQuery.trim();
    if (!q) {
      setClientResults([]);
      setClientSearching(false);
      return;
    }
    let cancelled = false;
    setClientSearching(true);
    void (async () => {
      try {
        const res = await fetch(`/api/bitrix/contacts?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as PersonOption[] | { error?: string };
        if (!cancelled && Array.isArray(json)) setClientResults(json);
      } catch {
        // Non-fatal — keep the previous results on the screen.
      } finally {
        if (!cancelled) setClientSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientQuery]);

  const clientOptions = useMemo(() => {
    const opts = [...clientResults];
    if (client && !opts.some((o) => o.id === client.id)) opts.unshift(client);
    return opts;
  }, [clientResults, client]);

  // Sales — same async pattern (Bitrix user.search via /api/bitrix/sales?q=),
  // replicated from the Transaksi filter panel.
  const [salesQuery, setSalesQuery] = useState("");
  const [salesResults, setSalesResults] = useState<PersonOption[]>([]);
  const [salesSearching, setSalesSearching] = useState(false);

  useEffect(() => {
    const q = salesQuery.trim();
    if (!q) {
      setSalesResults([]);
      setSalesSearching(false);
      return;
    }
    let cancelled = false;
    setSalesSearching(true);
    void (async () => {
      try {
        const res = await fetch(`/api/bitrix/sales?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as PersonOption[] | { error?: string };
        if (!cancelled && Array.isArray(json)) setSalesResults(json);
      } catch {
        // Non-fatal — keep the previous results on the screen.
      } finally {
        if (!cancelled) setSalesSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [salesQuery]);

  const salesOptions = useMemo(() => {
    const opts = [...salesResults];
    if (sales && !opts.some((o) => o.id === sales.id)) opts.unshift(sales);
    return opts;
  }, [salesResults, sales]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            {/* By date */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rentang Tanggal</Label>
              <Popover>
                <PopoverTrigger
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-full border border-input bg-background px-4 text-sm",
                    "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !range?.from && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">{formatDateRangeLabel(range, "Pilih tanggal")}</span>
                  <CalendarDate weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} autoFocus />
                </PopoverContent>
              </Popover>
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

              {/* By nama client — async search hits Bitrix crm.contact.list */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nama Client</Label>
                <SearchableSelect
                  options={[{ id: CLIENT_ALL, name: "Semua client" }, ...clientOptions]}
                  value={client ? client.id : CLIENT_ALL}
                  onChange={(v) => {
                    if (v === CLIENT_ALL) {
                      setClient(null);
                      return;
                    }
                    const found = clientOptions.find((o) => o.id === v);
                    if (found) setClient(found);
                  }}
                  onSearchChange={setClientQuery}
                  loading={clientSearching}
                  placeholder="Semua client"
                  searchPlaceholder="Cari nama client..."
                  emptyText="Client tidak ditemukan"
                  className="w-full"
                />
              </div>

              {/* By nama sales — async search hits Bitrix user.search */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nama Sales</Label>
                <SearchableSelect
                  options={[{ id: SALES_ALL, name: "Semua sales" }, ...salesOptions]}
                  value={sales ? sales.id : SALES_ALL}
                  onChange={(v) => {
                    if (v === SALES_ALL) {
                      setSales(null);
                      return;
                    }
                    const found = salesOptions.find((o) => o.id === v);
                    if (found) setSales(found);
                  }}
                  onSearchChange={setSalesQuery}
                  loading={salesSearching}
                  placeholder="Semua sales"
                  searchPlaceholder="Cari nama sales..."
                  emptyText="Sales tidak ditemukan"
                  className="w-full"
                />
              </div>
            </div>

            {/* By tanggal database — optional, independent from the mandatory range above */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tanggal Database</Label>
                {dbRange?.from && (
                  <button
                    type="button"
                    onClick={() => setDbRange(undefined)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Bersihkan
                  </button>
                )}
              </div>
              <Popover>
                <PopoverTrigger
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-full border border-input bg-background px-4 text-sm",
                    "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !dbRange?.from && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">{formatDateRangeLabel(dbRange, "Semua tanggal")}</span>
                  <CalendarDate weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" numberOfMonths={1} selected={dbRange} onSelect={setDbRange} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background px-0 pt-4">
        <div className="flex items-center justify-between gap-2">
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
                client,
                sales,
                dbRange,
              })
            }
          >
            Terapkan
          </Button>
        </div>
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

function KantorMandiriCard({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const kantor = data?.kantor ?? 0;
  const mandiri = data?.mandiri ?? 0;
  const total = kantor + mandiri;
  const kantorPct = total > 0 ? Math.round((kantor / total) * 100) : 0;
  const mandiriPct = total > 0 ? Math.round((mandiri / total) * 100) : 0;

  return (
    <Card className="rounded-xl p-5">
      <div className="mb-1 flex items-center gap-2">
        <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-heading text-sm font-semibold">Database Kantor vs Mandiri</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Mandiri = sumber <span className="font-medium">Live TikTok</span> &amp;{" "}
        <span className="font-medium">Referral</span>; sisanya dihitung sebagai kantor.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Buildings weight="BoldDuotone" className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Database Kantor</p>
            <p className="font-heading text-2xl font-semibold leading-tight">
              {loading ? "…" : kantor.toLocaleString("id-ID")}
              {!loading && <span className="ml-1 text-xs text-muted-foreground">({kantorPct}%)</span>}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${kantorPct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <UsersGroupRounded weight="BoldDuotone" className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Database Mandiri</p>
            <p className="font-heading text-2xl font-semibold leading-tight">
              {loading ? "…" : mandiri.toLocaleString("id-ID")}
              {!loading && <span className="ml-1 text-xs text-muted-foreground">({mandiriPct}%)</span>}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${mandiriPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ResponseStatusCard({ data, loading }: { data: OverviewData | null; loading: boolean }) {
  const notResponded = data?.responseStatus.notResponded ?? 0;

  return (
    <Card className="rounded-xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <ChatRoundLine weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-heading text-sm font-semibold">Response Status</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <CheckCircle weight="BoldDuotone" className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sudah Dibalas</p>
            <p className="font-heading text-2xl font-semibold leading-tight">
              {loading ? "…" : (data?.responseStatus.responded ?? 0).toLocaleString("id-ID")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
            <DangerCircle weight="BoldDuotone" className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Belum Dibalas</p>
            <p
              className={cn(
                "font-heading text-2xl font-semibold leading-tight",
                !loading && notResponded > 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {loading ? "…" : notResponded.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
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

function BarRow({
  label,
  count,
  total,
  right,
  sub,
}: {
  label: React.ReactNode;
  count: number;
  total: number;
  right?: React.ReactNode;
  sub?: React.ReactNode;
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
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </li>
  );
}

function SalesTable({ buckets, loading }: { buckets: SalesBucket[] | undefined; loading: boolean }) {
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sales</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">DB Kantor</TableHead>
              <TableHead className="text-right">DB Mandiri</TableHead>
              <TableHead className="text-right">Getback</TableHead>
              <TableHead className="text-right">Sudah FU</TableHead>
              <TableHead className="text-right">Belum FU</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b) => (
              <TableRow key={b.key}>
                <TableCell className="font-medium">{b.label}</TableCell>
                <TableCell className="text-right tabular-nums">{b.count.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right tabular-nums">{b.kantor.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right tabular-nums">{b.mandiri.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right tabular-nums">{b.getback.toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right tabular-nums">{b.responded.toLocaleString("id-ID")}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    b.notResponded > 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {b.notResponded.toLocaleString("id-ID")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardShell>
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
