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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SalesConversationsDrawer, type SalesConversation } from "./sales-conversations-drawer";

interface ResponseSalesRow {
  userId: string;
  name: string;
  samples: number;
  avgSeconds: number;
  seconds: number;
  minutes: number;
  hours: string;
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

  const from = range?.from ? toIsoDay(range.from) : "";
  const to = range?.to ? toIsoDay(range.to) : from;

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from, to });
        if (query) params.set("sales", query);
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
  }, [from, to, query, reloadKey]);

  function applyRange(next: DateRange | undefined) {
    setRange(next);
    setFilterOpen(false);
  }

  function resetRange() {
    const y = yesterday();
    setRange({ from: y, to: y });
    setFilterOpen(false);
  }

  const activeCount = range?.from ? 1 : 0;

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
              <div className="flex flex-col">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <Tuning weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-heading text-sm font-semibold">Filter Tanggal</h4>
                </div>
                <div className="space-y-1.5 px-4 py-4">
                  <Label className="text-xs text-muted-foreground">Rentang Tanggal</Label>
                  <div className="flex justify-center rounded-xl border">
                    <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={applyRange} autoFocus />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={resetRange}>
                    <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                    Reset
                  </Button>
                  <Button size="sm" className="rounded-full" onClick={() => setFilterOpen(false)}>
                    Tutup
                  </Button>
                </div>
              </div>
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

      {/* Table card */}
      <Card className="overflow-hidden rounded-xl py-0">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 py-2 text-muted-foreground min-w-52">Nama</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-24">Detik</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-24">Menit</TableHead>
                  <TableHead className="px-3 py-2 text-muted-foreground text-right min-w-28">Jam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((__, j) => (
                        <TableCell key={j} className="px-3 py-2">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
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
                          <span className="text-xs text-muted-foreground">{r.samples} percakapan</span>
                        </div>
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
        Waktu respons dihitung dari saat percakapan ditugaskan/ditransfer ke sales hingga sales mengirim pesan
        pertama. Dihitung langsung dari riwayat Open Lines Bitrix24 — Bitrix tidak menyediakan statistik respons
        lewat REST API.
      </p>

      <SalesConversationsDrawer
        salesName={selectedSales?.name ?? null}
        conversations={selectedSales?.conversations ?? []}
        onClose={() => setSelectedSales(null)}
      />
    </div>
  );
}
