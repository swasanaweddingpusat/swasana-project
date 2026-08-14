"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Magnifer,
  Bolt,
  RefreshCircle,
  AltArrowLeft,
  AltArrowRight,
  UserCircle,
  Phone,
  Link as LinkIcon,
  Tuning,
  CloseCircle,
} from "@solar-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BitrixDealDetailModal } from "./bitrix-deal-detail-modal";

const PAGE_SIZE = 50;
const COLSPAN = 15;

// Pipeline (CATEGORY_ID) options — hardcoded from the Bitrix portal's
// crm.category.list so the filter is stable regardless of the current page's
// rows. "" = all pipelines.
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

export interface Deal {
  id: string;
  title: string;
  stageId: string | null;
  stage: string;
  stageSemantic: "won" | "lost" | "process";
  stageColor: string | null;
  stageOrder: number;
  pipelineId: string | null;
  pipeline: string;
  clientId: string | null;
  client: string | null;
  phone: string | null;
  opportunity: number;
  currency: string;
  sourceId: string | null;
  source: string;
  sourceDescription: string | null;
  assignedById: string | null;
  assignedBy: string | null;
  issue: string | null;
  adsUrl: string | null;
  adsHeadline: string | null;
  adsBody: string | null;
  dbDate: string | null;
  dateCreate: string | null;
}

interface ApiResponse {
  items: Deal[];
  total: number;
  next: number | null;
  stageCatalog: StageCatalogItem[];
  issueCatalog: string[];
  error?: string;
}

function formatMoney(value: number, currency: string): string {
  if (!value) return "-";
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: currency || "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("id-ID")}`;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

function isUrl(value: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value.trim());
}

// Local calendar day (not UTC) — avoids the off-by-one from toISOString().
function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function BitrixDealsManager() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [total, setTotal] = useState(0);
  const [start, setStart] = useState(0);
  const [pipeline, setPipeline] = useState<string>("");
  const [stage, setStage] = useState<string>("");
  const [issue, setIssue] = useState<string>("");
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>();
  const [dbRange, setDbRange] = useState<DateRange | undefined>();
  const [stageCatalog, setStageCatalog] = useState<StageCatalogItem[]>([]);
  const [issueCatalog, setIssueCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Derive ISO-day bounds from the two date ranges — primitive deps for the
  // fetch effect (a "from" with no "to" is treated as a single-day range).
  const createdFrom = createdRange?.from ? toIsoDay(createdRange.from) : "";
  const createdTo = createdRange?.from ? toIsoDay(createdRange.to ?? createdRange.from) : "";
  const dbFrom = dbRange?.from ? toIsoDay(dbRange.from) : "";
  const dbTo = dbRange?.from ? toIsoDay(dbRange.to ?? dbRange.from) : "";

  // Debounce the search box → server query. Resets paging to the first page.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setStart(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ start: String(start) });
        if (pipeline) params.set("filter[CATEGORY_ID]", pipeline);
        if (stage) params.set("stage", stage);
        if (issue) params.set("issue", issue);
        if (createdFrom) params.set("createdFrom", createdFrom);
        if (createdTo) params.set("createdTo", createdTo);
        if (dbFrom) params.set("dbFrom", dbFrom);
        if (dbTo) params.set("dbTo", dbTo);
        if (query) params.set("q", query);
        const res = await fetch(`/api/bitrix/deals?${params.toString()}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data.");
          setDeals([]);
          return;
        }
        setDeals(json.items ?? []);
        setTotal(json.total ?? 0);
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
  }, [start, pipeline, stage, issue, createdFrom, createdTo, dbFrom, dbTo, query, reloadKey]);

  const pageFrom = total === 0 ? 0 : start + 1;
  const pageTo = Math.min(start + PAGE_SIZE, total);
  const canPrev = start > 0;
  const canNext = start + PAGE_SIZE < total;

  // Number of non-default active filters — shown as a badge on the Filter button.
  const activeFilterCount =
    (pipeline ? 1 : 0) +
    (stage ? 1 : 0) +
    (issue ? 1 : 0) +
    (createdRange?.from ? 1 : 0) +
    (dbRange?.from ? 1 : 0);

  function applyFilters(next: {
    pipeline: string;
    stage: string;
    issue: string;
    createdRange: DateRange | undefined;
    dbRange: DateRange | undefined;
  }) {
    setPipeline(next.pipeline);
    setStage(next.stage);
    setIssue(next.issue);
    setCreatedRange(next.createdRange);
    setDbRange(next.dbRange);
    setStart(0);
    setFilterOpen(false);
  }

  function resetFilters() {
    setPipeline("");
    setStage("");
    setIssue("");
    setCreatedRange(undefined);
    setDbRange(undefined);
    setStart(0);
    setFilterOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <Card className="flex flex-col gap-4 rounded-xl p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
            <Bolt weight="BoldDuotone" className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total transaksi</p>
            <p className="font-heading text-2xl font-semibold leading-tight">
              {loading ? "…" : total.toLocaleString("id-ID")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Magnifer
              weight="BoldDuotone"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul transaksi…"
              className="rounded-full pl-9"
            />
          </div>

          {/* Filter — grouped popover: pipeline + tahap */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="shrink-0 rounded-full">
                  <Tuning weight="BoldDuotone" className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-auto max-w-[92vw] p-0" align="end">
              <FilterPanel
                pipeline={pipeline}
                stage={stage}
                issue={issue}
                createdRange={createdRange}
                dbRange={dbRange}
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

      {/* Table card — mirrors the booking-weddings table style */}
      <Card className="overflow-hidden rounded-xl py-0">
        <CardContent className="p-0">
          <TooltipProvider delay={200}>
            <div className={cn("w-full", "overflow-x-auto")}>
              <Table className={cn("w-full", "text-sm")}>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "w-16")}>ID</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "w-64", "min-w-64")}>Transaksi</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-40")}>Nama Client</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-36")}>Telepon</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-36")}>Penanggung Jawab</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-28")}>Tahap</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-28")}>Pipeline</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-48")}>Sumber Informasi</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-36")}>Issue</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "text-right", "min-w-32")}>Nilai</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-52")}>Ads Source URL</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "min-w-48")}>Ads Headline</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "w-96", "min-w-96")}>Ads Body</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "text-right", "min-w-32")}>Tanggal Database</TableHead>
                    <TableHead className={cn("px-3", "py-2", "text-muted-foreground", "text-right", "min-w-28")}>Dibuat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: COLSPAN }).map((__, j) => (
                          <TableCell key={j} className="px-3 py-2">
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={COLSPAN} className="py-12 text-center text-sm text-destructive">
                        {error}
                      </TableCell>
                    </TableRow>
                  ) : deals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={COLSPAN} className="py-12 text-center text-sm text-muted-foreground">
                        {query ? "Tidak ada transaksi yang cocok." : "Belum ada data transaksi."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    deals.map((d) => (
                      <TableRow
                        key={d.id}
                        className={cn("cursor-pointer hover:bg-muted/40")}
                        onClick={() => setSelectedDeal(d)}
                      >
                        <TableCell className={cn("px-3", "py-2", "font-mono", "text-xs", "text-muted-foreground")}>
                          {d.id}
                        </TableCell>

                        {/* Transaksi (title) */}
                        <TableCell className="px-3 py-2 align-top">
                          <span className="block font-medium text-foreground break-words whitespace-normal">{d.title}</span>
                        </TableCell>

                        {/* Nama Client */}
                        <TableCell className="px-3 py-2 align-top">
                          <span className="block break-words whitespace-normal">{d.client ?? "-"}</span>
                        </TableCell>

                        {/* Telepon */}
                        <TableCell className="px-3 py-2">
                          {d.phone ? (
                            <a
                              href={`tel:${d.phone}`}
                              className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
                            >
                              <Phone weight="BoldDuotone" className="h-3.5 w-3.5 text-muted-foreground" />
                              {d.phone}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Penanggung Jawab (PIC) */}
                        <TableCell className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <UserCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                            {d.assignedBy ?? (d.assignedById ? `#${d.assignedById}` : "-")}
                          </span>
                        </TableCell>

                        {/* Tahap — Bitrix-style segmented funnel bar */}
                        <TableCell className="px-3 py-2">
                          <StageBar deal={d} total={stageCatalog.length} />
                        </TableCell>

                        {/* Pipeline */}
                        <TableCell className="px-3 py-2 text-sm text-muted-foreground">{d.pipeline}</TableCell>

                        {/* Sumber Informasi — label + optional link */}
                        <TableCell className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm break-words whitespace-normal">{d.source}</span>
                            {d.sourceDescription &&
                              (isUrl(d.sourceDescription) ? (
                                <a
                                  href={d.sourceDescription}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-start gap-1 text-xs text-primary hover:underline"
                                >
                                  <LinkIcon weight="BoldDuotone" className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="break-all whitespace-normal">{d.sourceDescription}</span>
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground break-words whitespace-normal">{d.sourceDescription}</span>
                              ))}
                          </div>
                        </TableCell>

                        {/* Issue */}
                        <TableCell className="px-3 py-2">
                          {d.issue ? (
                            <Badge variant="secondary" className="rounded-full font-normal">
                              {d.issue}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Nilai */}
                        <TableCell className="px-3 py-2 text-right text-sm font-medium">
                          {formatMoney(d.opportunity, d.currency)}
                        </TableCell>

                        {/* Ads Source URL */}
                        <TableCell className="px-3 py-2 align-top">
                          {d.adsUrl ? (
                            <a
                              href={d.adsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1 text-sm text-primary hover:underline"
                            >
                              <LinkIcon weight="BoldDuotone" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="break-all whitespace-normal">{d.adsUrl}</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Ads Headline */}
                        <TableCell className="px-3 py-2 align-top">
                          {d.adsHeadline ? (
                            <span className="block text-sm text-muted-foreground break-words whitespace-normal">
                              {d.adsHeadline}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Ads Body — clamped to 3 lines, expandable on click */}
                        <TableCell className="px-3 py-2 align-top">
                          <AdsBodyCell value={d.adsBody} />
                        </TableCell>

                        {/* Tanggal Database */}
                        <TableCell className="px-3 py-2 text-right text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(d.dbDate)}
                        </TableCell>

                        {/* Dibuat */}
                        <TableCell className="px-3 py-2 text-right text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(d.dateCreate)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>

          {/* Pagination footer */}
          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {pageFrom}–{pageTo} dari {total.toLocaleString("id-ID")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={!canPrev}
                  onClick={() => setStart((s) => Math.max(0, s - PAGE_SIZE))}
                >
                  <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={!canNext}
                  onClick={() => setStart((s) => s + PAGE_SIZE)}
                >
                  Next
                  <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BitrixDealDetailModal
        deal={selectedDeal}
        onClose={() => setSelectedDeal(null)}
      />
    </div>
  );
}

// Grouped filter panel rendered inside the Filter popover. Holds its own draft
// state so the parent only re-fetches when the user hits "Terapkan".
function FilterPanel({
  pipeline: initialPipeline,
  stage: initialStage,
  issue: initialIssue,
  createdRange: initialCreatedRange,
  dbRange: initialDbRange,
  stageCatalog,
  issueCatalog,
  onApply,
  onReset,
}: {
  pipeline: string;
  stage: string;
  issue: string;
  createdRange: DateRange | undefined;
  dbRange: DateRange | undefined;
  stageCatalog: StageCatalogItem[];
  issueCatalog: string[];
  onApply: (next: {
    pipeline: string;
    stage: string;
    issue: string;
    createdRange: DateRange | undefined;
    dbRange: DateRange | undefined;
  }) => void;
  onReset: () => void;
}) {
  const [pipeline, setPipeline] = useState(initialPipeline);
  const [stage, setStage] = useState(initialStage);
  const [issue, setIssue] = useState(initialIssue);
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>(initialCreatedRange);
  const [dbRange, setDbRange] = useState<DateRange | undefined>(initialDbRange);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Tuning weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-heading text-sm font-semibold">Filter Transaksi</h4>
      </div>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* By pipeline */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pipeline</Label>
            <Select value={pipeline === "" ? PIPELINE_ALL : pipeline} onValueChange={(v) => setPipeline(v === PIPELINE_ALL ? "" : v)}>
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
        </div>

        {/* Date ranges — created vs database date, side by side on wider screens */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Tanggal Dibuat</Label>
              {createdRange?.from && (
                <button
                  type="button"
                  onClick={() => setCreatedRange(undefined)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Bersihkan
                </button>
              )}
            </div>
            <div className="flex justify-center rounded-xl border">
              <Calendar mode="range" numberOfMonths={1} selected={createdRange} onSelect={setCreatedRange} />
            </div>
          </div>

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
            <div className="flex justify-center rounded-xl border">
              <Calendar mode="range" numberOfMonths={1} selected={dbRange} onSelect={setDbRange} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onReset}>
          <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
          Reset
        </Button>
        <Button size="sm" className="rounded-full" onClick={() => onApply({ pipeline, stage, issue, createdRange, dbRange })}>
          Terapkan
        </Button>
      </div>
    </div>
  );
}

// Ads Body cell — clamps long ad copy to 3 lines with a "Selengkapnya" toggle
// to reveal the full text, so the table row stays compact. The toggle only
// appears when the text actually overflows the clamp.
function AdsBodyCell({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight > clientHeight means the clamped text is cut off.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [value]);

  if (!value) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="w-96 max-w-96">
      <span
        ref={ref}
        className={cn(
          "block text-sm break-words whitespace-normal text-muted-foreground",
          !expanded && "line-clamp-3",
        )}
      >
        {value}
      </span>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Sembunyikan" : "Selengkapnya"}
        </button>
      )}
    </div>
  );
}

// Bitrix-style segmented funnel bar — one segment per stage in the catalog,
// filled up to the deal's current stage. Won deals show a fully-filled bar in
// the won color, lost deals in the lost color; in-process deals fill up to the
// current stage order. The fill color is CRM data (stageColor from the API), so
// the inline style is data-driven, not a hardcoded design token.
function StageBar({ deal, total }: { deal: Deal; total: number }) {
  const segments = Math.max(total, 1);
  const filled =
    deal.stageSemantic === "won" || deal.stageSemantic === "lost"
      ? segments
      : deal.stageOrder >= 0
        ? deal.stageOrder + 1
        : 0;
  const color = deal.stageColor || undefined;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex w-32 flex-col gap-1">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: segments }).map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 flex-1 rounded-full", i < filled ? "" : "bg-muted")}
                  style={i < filled && color ? { backgroundColor: color } : undefined}
                />
              ))}
            </div>
            <span className="line-clamp-1 text-xs font-medium" style={color ? { color } : undefined}>
              {deal.stage}
            </span>
          </div>
        }
      />
      <TooltipContent side="bottom" align="start">
        {deal.stage}
        {deal.stageOrder >= 0 ? ` · tahap ${deal.stageOrder + 1}/${segments}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
