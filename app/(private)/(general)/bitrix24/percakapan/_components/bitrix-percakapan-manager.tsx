"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Magnifer,
  ChatRound,
  RefreshCircle,
  AltArrowLeft,
  AltArrowRight,
  UserCircle,
  Phone,
  Tuning,
  CloseCircle,
  CallChatRounded,
  Login2,
  Logout2,
  Download,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { PercakapanDetailDrawer } from "./percakapan-detail-drawer";

// Local calendar day (not UTC) — avoids the off-by-one from toISOString().
function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const PAGE_SIZE = 50;
const COLSPAN = 14;

const DIRECTION_ALL = "__all__";
const STATUS_ALL = "__all__";
const TRANSFERRED_ALL = "__all__";

const TRANSFERRED_OPTIONS: { id: string; name: string }[] = [
  { id: "yes", name: "Sudah ditransfer" },
  { id: "no", name: "Belum ditransfer" },
];

const DIRECTION_OPTIONS: { id: string; name: string }[] = [
  { id: "1", name: "Inbound" },
  { id: "2", name: "Outbound" },
];

// Combined "Status" select — merges the old separate Status (open/closed) and
// Status Respons (yes/no) selects into one mutually-exclusive control. See
// deriveCombinedStatus() / translateCombinedStatus() below for the mapping
// back to the parent's separate `status` / `responded` query params.
const STATUS_COMBINED_OPTIONS: { id: string; name: string }[] = [
  { id: "open", name: "Terbuka" },
  { id: "closed", name: "Ditutup" },
  { id: "resp-yes", name: "Sudah dibalas" },
  { id: "resp-no", name: "Belum dibalas" },
];

function deriveCombinedStatus(status: string, responded: string): string {
  if (responded === "yes") return "resp-yes";
  if (responded === "no") return "resp-no";
  if (status === "open") return "open";
  if (status === "closed") return "closed";
  return "";
}

function translateCombinedStatus(combined: string): { status: string; responded: string } {
  switch (combined) {
    case "open":
      return { status: "open", responded: "" };
    case "closed":
      return { status: "closed", responded: "" };
    case "resp-yes":
      return { status: "", responded: "yes" };
    case "resp-no":
      return { status: "", responded: "no" };
    default:
      return { status: "", responded: "" };
  }
}

interface Conversation {
  id: string;
  sessionId: string;
  dealId: string | null;
  direction: "inbound" | "outbound";
  closed: boolean;
  client: string | null;
  phone: string | null;
  venue: string | null;
  channel: string;
  responsibleId: string | null;
  responsible: string | null;
  createdAt: string | null;
  closedAt: string | null;
  lastMessageAt: string | null;
  durationSec: number | null;
  avgResponseSec: number | null;
  transferCount?: number;
  transferred?: boolean;
  responded?: boolean;
}

interface ApiResponse {
  items: Conversation[];
  total: number;
  next: number | null;
  error?: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function formatDuration(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} mnt`);
  if (s > 0 || parts.length === 0) parts.push(`${s} dtk`);
  return parts.join(" ");
}

// Detik/Menit/Jam columns ahead of "Response" — same source (avgResponseSec),
// same shape as the Detik/Menit/Jam columns in the Response Sales table, just
// per-conversation instead of per-sales-aggregate.
function formatDetik(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  return Math.round(sec).toLocaleString("id-ID");
}

function formatMenit(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  return Math.round(sec / 60).toLocaleString("id-ID");
}

function formatJam(sec: number | null): string {
  if (sec === null || sec < 0) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BitrixPercakapanManager() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [start, setStart] = useState(0);
  const [direction, setDirection] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { from: today, to: today };
  });
  const [transferredFilter, setTransferredFilter] = useState<string>("");
  const [respondedFilter, setRespondedFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const createdFrom = createdRange?.from ? toIsoDay(createdRange.from) : "";
  const createdTo = createdRange?.from ? toIsoDay(createdRange.to ?? createdRange.from) : "";

  async function handleExport(): Promise<void> {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: "xlsx" });
      if (direction) params.set("direction", direction);
      if (status) params.set("status", status);
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
      if (transferredFilter) params.set("transferred", transferredFilter);
      if (respondedFilter) params.set("responded", respondedFilter);
      if (query) params.set("q", query);

      const res = await fetch(`/api/bitrix/percakapan/export?${params.toString()}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bitrix-percakapan-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[bitrix percakapan] export failed", err);
    } finally {
      setExporting(false);
    }
  }

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
        if (direction) params.set("direction", direction);
        if (status) params.set("status", status);
        if (createdFrom) params.set("createdFrom", createdFrom);
        if (createdTo) params.set("createdTo", createdTo);
        if (transferredFilter) params.set("transferred", transferredFilter);
        if (respondedFilter) params.set("responded", respondedFilter);
        if (query) params.set("q", query);
        const res = await fetch(`/api/bitrix/percakapan?${params.toString()}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data.");
          setItems([]);
          return;
        }
        setItems(json.items ?? []);
        setTotal(json.total ?? 0);
      } catch {
        if (!cancelled) setError("Gagal terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, direction, status, createdFrom, createdTo, transferredFilter, respondedFilter, query, reloadKey]);

  const pageFrom = total === 0 ? 0 : start + 1;
  const pageTo = Math.min(start + PAGE_SIZE, total);
  const canPrev = start > 0;
  const canNext = start + PAGE_SIZE < total;

  const activeFilterCount =
    (direction ? 1 : 0) +
    (status ? 1 : 0) +
    (createdRange?.from ? 1 : 0) +
    (transferredFilter ? 1 : 0) +
    (respondedFilter ? 1 : 0);

  function applyFilters(next: {
    direction: string;
    status: string;
    createdRange: DateRange | undefined;
    transferred: string;
    responded: string;
  }) {
    setDirection(next.direction);
    setStatus(next.status);
    setCreatedRange(next.createdRange);
    setTransferredFilter(next.transferred);
    setRespondedFilter(next.responded);
    setStart(0);
    setFilterOpen(false);
  }

  function resetFilters() {
    setDirection("");
    setStatus("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCreatedRange({ from: today, to: today });
    setTransferredFilter("");
    setRespondedFilter("");
    setStart(0);
    setFilterOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <Card className="flex flex-col gap-4 rounded-xl p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
            <ChatRound weight="BoldDuotone" className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total percakapan</p>
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
              placeholder="Cari klien / sales…"
              className="rounded-full pl-9"
            />
          </div>

          {/* Export Excel */}
          <Button
            variant="outline"
            className="shrink-0 rounded-full"
            onClick={handleExport}
            disabled={loading || exporting}
          >
            <Download weight="BoldDuotone" className="h-4 w-4" />
            Export Excel
          </Button>

          {/* Filter — grouped drawer: tipe + status */}
          <Button variant="outline" className="shrink-0 rounded-full" onClick={() => setFilterOpen(true)}>
            <Tuning weight="BoldDuotone" className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

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

      {/* Table card */}
      <Card className="overflow-hidden rounded-xl py-0">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 py-2 text-muted-foreground w-20">Sesi</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-28">Tipe</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-32">Status</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-36">Saluran</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-52">Klien</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-36">Karyawan</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-32">Dibuat</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-32">Ditutup</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-20">Detik</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-20">Menit</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-24">Jam</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-24">Response</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-32">Status Respons</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-24">Durasi</TableHead>
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
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLSPAN} className="py-12 text-center text-sm text-muted-foreground">
                      {query ? "Tidak ada percakapan yang cocok." : "Belum ada data percakapan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedSession(c.sessionId)}
                    >
                      {/* Sesi */}
                      <TableCell className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {c.sessionId}
                      </TableCell>

                      {/* Tipe */}
                      <TableCell className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          {c.direction === "inbound" ? (
                            <Login2 weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Logout2 weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                          )}
                          {c.direction === "inbound" ? "Inbound" : "Outbound"}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant={c.closed ? "secondary" : "outline"}
                            className="rounded-full font-normal"
                          >
                            {c.closed ? "Percakapan ditutup" : "Agen merespons"}
                          </Badge>
                          {c.transferred && (
                            <Badge variant="outline" className="rounded-full font-normal text-primary border-primary/30">
                              {c.transferCount ?? 1}x Transfer
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Saluran */}
                      <TableCell className="px-3 py-2 align-top">
                        <span className="inline-flex items-start gap-1.5 text-sm break-words whitespace-normal">
                          <CallChatRounded weight="BoldDuotone" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {c.channel}
                        </span>
                      </TableCell>

                      {/* Klien */}
                      <TableCell className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="block font-medium text-foreground break-words whitespace-normal">
                            {c.client ?? "Guest"}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {c.phone && (
                              <a
                                href={`tel:${c.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                              >
                                <Phone weight="BoldDuotone" className="h-3 w-3" />
                                {c.phone}
                              </a>
                            )}
                            {c.venue && (
                              <span className="text-xs text-muted-foreground">· {c.venue}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Karyawan */}
                      <TableCell className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <UserCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                          {c.responsible ?? (c.responsibleId ? `#${c.responsibleId}` : "-")}
                        </span>
                      </TableCell>

                      {/* Dibuat */}
                      <TableCell className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(c.createdAt)}
                      </TableCell>

                      {/* Ditutup */}
                      <TableCell className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(c.closedAt)}
                      </TableCell>

                      {/* Detik / Menit / Jam — avgResponseSec broken down like Response Sales */}
                      <TableCell className="px-3 py-2 text-right text-sm whitespace-nowrap tabular-nums">
                        {formatDetik(c.avgResponseSec)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right text-sm whitespace-nowrap tabular-nums">
                        {formatMenit(c.avgResponseSec)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right text-sm whitespace-nowrap font-medium tabular-nums">
                        {formatJam(c.avgResponseSec)}
                      </TableCell>

                      {/* Response rata-rata */}
                      <TableCell className="px-3 py-2 text-right text-sm whitespace-nowrap">
                        {c.avgResponseSec !== null ? (
                          formatDuration(c.avgResponseSec)
                        ) : c.transferred ? (
                          <span className="text-destructive">Belum dibalas</span>
                        ) : (
                          <span className="text-[var(--brand-gold)]">Belum transfer</span>
                        )}
                      </TableCell>

                      {/* Status Respons */}
                      <TableCell className="px-3 py-2">
                        <Badge
                          variant={c.responded ? "secondary" : "destructive"}
                          className="rounded-full font-normal"
                        >
                          {c.responded ? "Sudah Dibalas" : "Belum Dibalas"}
                        </Badge>
                      </TableCell>

                      {/* Durasi */}
                      <TableCell className="px-3 py-2 text-right text-sm whitespace-nowrap">
                        {formatDuration(c.durationSec)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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

      <PercakapanDetailDrawer
        sessionId={selectedSession}
        onClose={() => setSelectedSession(null)}
      />

      <Drawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Percakapan"
        maxWidth="sm:max-w-md"
      >
        <FilterPanel
          direction={direction}
          status={status}
          createdRange={createdRange}
          transferred={transferredFilter}
          responded={respondedFilter}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      </Drawer>
    </div>
  );
}

// Grouped filter panel rendered inside the Filter drawer. Holds its own draft
// state so the parent only re-fetches when the user hits "Terapkan". The
// "Status" select is a merged UI control (see deriveCombinedStatus /
// translateCombinedStatus) — the parent's separate status/responded state is
// unchanged, only the presentation is combined into one control here.
function FilterPanel({
  direction: initialDirection,
  status: initialStatus,
  createdRange: initialCreatedRange,
  transferred: initialTransferred,
  responded: initialResponded,
  onApply,
  onReset,
}: {
  direction: string;
  status: string;
  createdRange: DateRange | undefined;
  transferred: string;
  responded: string;
  onApply: (next: {
    direction: string;
    status: string;
    createdRange: DateRange | undefined;
    transferred: string;
    responded: string;
  }) => void;
  onReset: () => void;
}) {
  const [direction, setDirection] = useState(initialDirection);
  const [combinedStatus, setCombinedStatus] = useState(() =>
    deriveCombinedStatus(initialStatus, initialResponded),
  );
  const [createdRange, setCreatedRange] = useState<DateRange | undefined>(initialCreatedRange);
  const [transferred, setTransferred] = useState(initialTransferred);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-6">
          {/* By tanggal dibuat */}
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

          {/* By tipe */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipe</Label>
            <Select
              value={direction === "" ? DIRECTION_ALL : direction}
              onValueChange={(v) => setDirection(v === DIRECTION_ALL ? "" : v)}
            >
              <SelectTrigger className="w-full rounded-full">
                <SelectValue placeholder="Semua tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DIRECTION_ALL}>Semua tipe</SelectItem>
                {DIRECTION_OPTIONS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* By status — merged Status + Status Respons into one control */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={combinedStatus === "" ? STATUS_ALL : combinedStatus}
              onValueChange={(v) => setCombinedStatus(v === STATUS_ALL ? "" : v)}
            >
              <SelectTrigger className="w-full rounded-full">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>Semua status</SelectItem>
                {STATUS_COMBINED_OPTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* By transfer */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Transfer</Label>
            <Select value={transferred === "" ? TRANSFERRED_ALL : transferred} onValueChange={(v) => setTransferred(v === TRANSFERRED_ALL ? "" : v)}>
              <SelectTrigger className="w-full rounded-full">
                <SelectValue placeholder="Semua transfer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TRANSFERRED_ALL}>Semua transfer</SelectItem>
                {TRANSFERRED_OPTIONS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            onClick={() => {
              const { status, responded } = translateCombinedStatus(combinedStatus);
              onApply({ direction, status, createdRange, transferred, responded });
            }}
          >
            Terapkan
          </Button>
        </div>
      </div>
    </div>
  );
}
