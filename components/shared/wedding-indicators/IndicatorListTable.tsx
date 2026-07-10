"use client";

import { useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight } from "@solar-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface VenueOption {
  id: string;
  name: string;
}

interface Indicator {
  id: string;
  coupleName: string;
  eventDate: Date;
  venue: { id: string; name: string };
  satisfactionScore: number | null;
  allowancePercentage: number | null;
  allowanceNominal: number | null;
}

interface IndicatorListTableProps {
  indicators: Indicator[];
  venues: VenueOption[];
  canCreate: boolean;
}

export function IndicatorListTable({
  indicators,
  venues,
  canCreate,
}: IndicatorListTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const venueFilter = searchParams.get("venueId") || "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.set("view", "table");
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  const handleSearch = (value: string) => {
    updateParams({ search: value });
  };

  const handleVenueFilter = (value: string) => {
    updateParams({ venueId: value === "all" ? "" : value });
  };

  const formatScore = (score: number | null) => {
    if (score === null) return "–";
    return score.toFixed(1);
  };

  const formatNominal = (nominal: number | null) => {
    if (nominal === null) return "–";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(nominal);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-2">
        <div className="flex-1">
          <label className="text-sm font-medium">Cari Nama Pasangan</label>
          <Input
            placeholder="Cari..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="mt-2"
          />
        </div>

        <div className="w-full md:w-48">
          <label className="text-sm font-medium">Filter Venue</label>
          <Select value={venueFilter || "all"} onValueChange={handleVenueFilter}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Semua venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua venue</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Link href="/dashboard/vendor-specialist/wedding-indicators/create">
            <Button className="w-full md:w-auto">Buat Kuesioner</Button>
          </Link>
        )}
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nama Pasangan</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Tanggal Acara</TableHead>
              <TableHead className="text-right">Skor Kepuasan</TableHead>
              <TableHead className="text-right">Tunjangan</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indicators.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">
                    Belum ada kuesioner pernikahan
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              indicators.map((indicator) => (
                <TableRow
                  key={indicator.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    router.push(
                      `/dashboard/vendor-specialist/wedding-indicators/${indicator.id}`
                    )
                  }
                >
                  <TableCell className="font-medium">
                    {indicator.coupleName}
                  </TableCell>
                  <TableCell>{indicator.venue.name}</TableCell>
                  <TableCell>
                    {new Date(indicator.eventDate).toLocaleDateString("id-ID")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatScore(indicator.satisfactionScore)}
                  </TableCell>
                  <TableCell className="text-right">
                    {indicator.allowancePercentage !== null &&
                      indicator.allowancePercentage !== undefined && (
                        <span className="text-sm">
                          {indicator.allowancePercentage}% (
                          {formatNominal(indicator.allowanceNominal)})
                        </span>
                      )}
                    {(indicator.allowancePercentage === null ||
                      indicator.allowancePercentage === undefined) && "–"}
                  </TableCell>
                  <TableCell className="text-right">
                    <ArrowRight weight="BoldDuotone" className="h-5 w-5 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
