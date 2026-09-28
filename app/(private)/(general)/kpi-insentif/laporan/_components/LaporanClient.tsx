// FILE: app/(private)/(general)/kpi-insentif/laporan/_components/LaporanClient.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Filter,
  FileDownload,
  InfoCircle,
  GraphUp,
} from "@solar-icons/react";
import { PageHeader } from "@/components/shared/page-header";
import { useCalculationResults } from "@/hooks/useKpiInsentif";
import { useVenues } from "@/hooks/use-venues";
import { formatRupiah, formatPct } from "@/lib/utils/kpiFormatters";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold font-heading text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function LaporanClient() {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRole, setFilterRole] = useState("all");
  const [filterVenueId, setFilterVenueId] = useState("all");
  const [search, setSearch] = useState("");

  const { data: venues = [] } = useVenues();
  const period = `${filterYear}-${String(filterMonth).padStart(2, "0")}`;

  const { data: results = [], isLoading } = useCalculationResults({
    period,
    status: "FINALIZED",
    businessRole: filterRole !== "all" ? filterRole : undefined,
    venueId: filterVenueId !== "all" ? filterVenueId : undefined,
  });

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const filtered = results.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.profile.fullName ?? "").toLowerCase().includes(q);
  });

  // Summary
  const totalKaryawan = filtered.length;
  const totalKomisi = filtered.reduce((sum, r) => sum + (r.baseCommissionTotal != null ? Number(r.baseCommissionTotal) : 0), 0);
  const totalBonus = filtered.reduce((sum, r) => sum + (r.totalBonus != null ? Number(r.totalBonus) : 0), 0);
  const totalBersih = filtered.reduce((sum, r) => sum + (r.netAmount != null ? Number(r.netAmount) : 0), 0);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Laporan KPI & Insentif"
          description="Rekap final KPI dan insentif yang sudah difinalisasi"
        />

        {/* Notice */}
        <div className="rounded-2xl border bg-muted/30 px-4 py-3 flex items-start gap-2 text-sm text-muted-foreground">
          <InfoCircle weight="BoldDuotone" className="h-4 w-4 mt-0.5 shrink-0" />
          Laporan ini hanya menampilkan data yang sudah difinalisasi. Data simulasi tidak termasuk.
        </div>

        {/* Filter Bar */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Filter weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />

            <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
              <SelectTrigger className="rounded-full w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
              <SelectTrigger className="rounded-full w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="rounded-full w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterVenueId} onValueChange={setFilterVenueId}>
              <SelectTrigger className="rounded-full w-36">
                <SelectValue placeholder="Semua Venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Venue</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="search"
              placeholder="Cari nama..."
              className="rounded-full w-40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="ml-auto">
              <Tooltip>
                <TooltipTrigger render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5 opacity-60 cursor-not-allowed"
                    disabled
                  >
                    <FileDownload weight="BoldDuotone" className="h-4 w-4" />
                    Export
                  </Button>
                } />
                <TooltipContent>Fitur ekspor segera hadir</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total Karyawan" value={totalKaryawan} sub="Data final" />
          <SummaryCard label="Total Komisi Dasar" value={formatRupiah(totalKomisi)} />
          <SummaryCard label="Total Bonus" value={formatRupiah(totalBonus)} />
          <SummaryCard label="Total Bersih" value={formatRupiah(totalBersih)} />
        </div>

        {/* Table */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Nama</TableHead>
                  <TableHead className="font-semibold">Venue</TableHead>
                  <TableHead className="font-semibold text-right">Total Dealing</TableHead>
                  <TableHead className="font-semibold text-right">Total Omset</TableHead>
                  <TableHead className="font-semibold text-right">Homebase</TableHead>
                  <TableHead className="font-semibold text-right">Komisi</TableHead>
                  <TableHead className="font-semibold text-right">Bonus</TableHead>
                  <TableHead className="font-semibold text-right">Potongan</TableHead>
                  <TableHead className="font-semibold text-right">Bersih</TableHead>
                  <TableHead className="font-semibold text-center">Grade</TableHead>
                  <TableHead className="font-semibold text-center">Finalisasi</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                      Memuat laporan...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-3 py-6">
                        <GraphUp weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Belum ada laporan final
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            untuk periode {MONTHS[filterMonth - 1]} {filterYear}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const finalizedDate = r.finalizedAt
                      ? new Date(r.finalizedAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "-";
                    const deductionNum = r.deductionAmount != null ? Number(r.deductionAmount) : 0;

                    return (
                      <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{r.profile.fullName ?? "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.venue?.name ?? "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {r.realDealingTotal ?? "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatRupiah(r.realOmsetTotal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatPct(r.homebaseAchievementPct)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatRupiah(r.baseCommissionTotal)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatRupiah(r.totalBonus)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-destructive/70">
                          {deductionNum > 0 ? formatRupiah(r.deductionAmount) : "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-semibold">
                          {formatRupiah(r.netAmount)}
                        </TableCell>
                        <TableCell className="text-center text-sm font-semibold">
                          {r.grade ?? "-"}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {finalizedDate}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default" className="rounded-full text-xs">FINAL</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {filtered.length > 0 && (
            <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/10">
              <p className="text-xs text-muted-foreground">{filtered.length} karyawan</p>
              <div className="flex items-center gap-6 text-xs">
                <span className="text-muted-foreground">
                  Total Komisi: <span className="font-semibold text-foreground">{formatRupiah(totalKomisi)}</span>
                </span>
                <span className="text-muted-foreground">
                  Total Bersih: <span className="font-semibold text-foreground">{formatRupiah(totalBersih)}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
