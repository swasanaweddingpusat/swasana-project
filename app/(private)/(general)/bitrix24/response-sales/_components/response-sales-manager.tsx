"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  ChartSquare,
  RefreshCircle,
  Magnifer,
  Tuning,
  CloseCircle,
  Download,
  FileText,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import {
  exportResponseSalesExcel,
  exportResponseSalesPdf,
} from "@/lib/bitrix-response-sales-export";
import { SalesConversationsDrawer, type SalesConversation } from "./sales-conversations-drawer";

interface ResponseSalesRow {
  userId: string;
  name: string;
  samples: number;
  avgSeconds: number;
  seconds: number;
  minutes: number;
  hours: string;
  belumDibalasCount: number;
  conversations: SalesConversation[];
}

interface GrandTotal {
  seconds: number;
  minutes: number;
  hours: string;
  samples: number;
}

interface ApiResponse {
  from: string;
  to: string;
  totalSessions: number;
  rows: ResponseSalesRow[];
  grandTotal: GrandTotal;
  error?: string;
}

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDay(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function ResponseSalesManager() {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const y = yesterday();
    return { from: y, to: y };
  });
  const [dbRange, setDbRange] = useState<DateRange | undefined>(undefined);
  const [filterOpen, setFilterOpen] = useState(false);
  const [rows, setRows] = useState<ResponseSalesRow[]>([]);
  const [grandTotal, setGrandTotal] = useState<GrandTotal | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSales, setSelectedSales] = useState<ResponseSalesRow | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "pdf" | "excel"): Promise<void> {
    setExporting(true);
    try {
      const payload = { from, to, totalSessions, rows, grandTotal, salesQuery: query };
      if (format === "excel") await exportResponseSalesExcel(payload);
      else await exportResponseSalesPdf(payload);
    } catch (err) {
      console.error("[response sales] export failed", err);
    } finally {
      setExporting(false);
    }
  }

  const from = range?.from ? toIsoDay(range.from) : "";
  const to = range?.to ? toIsoDay(range.to) : from;
  const dbFrom = dbRange?.from ? toIsoDay(dbRange.from) : "";
  const dbTo = dbRange?.from ? toIsoDay(dbRange.to ?? dbRange.from) : "";

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // Either a primary range OR a Tanggal Database range is enough to fetch —
    // clearing the primary date but setting a DB date still drives a query.
    if (!from && !dbFrom) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (query) params.set("sales", query);
        if (dbFrom) params.set("dbFrom", dbFrom);
        if (dbTo) params.set("dbTo", dbTo);
        const res = await fetch(`/api/bitrix/response-sales?${params.toString()}`);
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Gagal memuat data.");
          setRows([]);
          setGrandTotal(null);
          return;
        }
        setRows(json.rows ?? []);
        setGrandTotal(json.grandTotal ?? null);
        setTotalSessions(json.totalSessions ?? 0);
      } catch {
        if (!cancelled) setError("Gagal terhubung ke server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, query, dbFrom, dbTo, reloadKey]);

  function resetRange() {
    const y = yesterday();
    setRange({ from: y, to: y });
    setDbRange(undefined);
    setFilterOpen(false);
  }

  const activeCount = (range?.from ? 1 : 0) + (dbRange?.from ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <Card className="flex flex-col gap-4 rounded-xl p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
            <ChartSquare weight="BoldDuotone" className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total percakapan</p>
            <p className="font-heading text-2xl font-semibold leading-tight">
              {loading ? "…" : totalSessions.toLocaleString("id-ID")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shrink-0 rounded-full" disabled={loading || exporting}>
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

          <div className="relative w-full sm:w-56">
            <Magnifer
              weight="BoldDuotone"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari sales…"
              className="rounded-full pl-9"
            />
          </div>

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
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-52">Nama</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-28">Belum Dibalas</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-24">Detik</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-24">Menit</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-28">Jam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j} className="px-3 py-2">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      {query ? "Tidak ada sales yang cocok." : "Belum ada data response sales."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow
                      key={r.userId}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedSales(r)}
                    >
                      <TableCell className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{r.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.conversations.length} percakapan · {r.samples} respons
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right tabular-nums">
                        {r.belumDibalasCount > 0 ? (
                          <span className="font-medium text-destructive">{r.belumDibalasCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right tabular-nums">{r.seconds.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="px-3 py-2 text-right tabular-nums">{r.minutes.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="px-3 py-2 text-right tabular-nums font-medium">{r.hours}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && !error && grandTotal && (
            <div className="flex items-center justify-between border-t px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {grandTotal.samples.toLocaleString("id-ID")} total respons
              </p>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-muted-foreground">
                  {grandTotal.seconds.toLocaleString("id-ID")} dtk
                </span>
                <span className="text-muted-foreground">
                  {grandTotal.minutes.toLocaleString("id-ID")} mnt
                </span>
                <span className="font-heading font-semibold">{grandTotal.hours}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        Waktu respons dihitung dari saat sales menerima percakapan (via transfer/antrean) atau dari pesan pelanggan
        yang belum dibalas, hingga sales mengirim balasan pertama. Chat yang dioper ke beberapa sales dihitung
        terpisah per sales. Dihitung langsung dari riwayat Open Lines Bitrix24 — Bitrix tidak menyediakan statistik
        respons lewat REST API.
      </p>

      <SalesConversationsDrawer
        salesName={selectedSales?.name ?? null}
        conversations={selectedSales?.conversations ?? []}
        onClose={() => setSelectedSales(null)}
      />

      <Drawer
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Tanggal"
        maxWidth="sm:max-w-md"
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rentang Tanggal</Label>
                <div
                  className={cn(
                    "flex justify-center rounded-xl border",
                    dbRange?.from && "opacity-50",
                  )}
                >
                  <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} autoFocus />
                </div>
                {dbRange?.from && (
                  <p className="text-xs text-muted-foreground">
                    Diabaikan saat filter Tanggal Database aktif.
                  </p>
                )}
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
                <div className="flex justify-center rounded-xl border">
                  <Calendar mode="range" numberOfMonths={1} selected={dbRange} onSelect={setDbRange} />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t bg-background px-0 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={resetRange}>
                <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                Reset
              </Button>
              <Button size="sm" className="rounded-full" onClick={() => setFilterOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
