"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Magnifer } from "@solar-icons/react";

const MONTHS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function getYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = current - i;
    return { value: String(y), label: String(y) };
  });
}

interface IndicatorFilterBarProps {
  venues: { id: string; name: string }[];
}

export function IndicatorFilterBar({
  venues,
}: IndicatorFilterBarProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentMonth = searchParams.get("month") ?? "all";
  const currentYear = searchParams.get("year") ?? "all";
  const currentSearch = searchParams.get("search") ?? "";
  const currentVenueId = searchParams.get("venueId") ?? "all";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "all") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [searchParams, router],
  );

  const handleSearch = useCallback(
    (value: string) => {
      updateParams({ search: value });
    },
    [updateParams],
  );

  const handleMonth = useCallback(
    (value: string) => {
      updateParams({ month: value });
    },
    [updateParams],
  );

  const handleYear = useCallback(
    (value: string) => {
      updateParams({ year: value });
    },
    [updateParams],
  );

  const handleVenue = useCallback(
    (value: string) => {
      updateParams({ venueId: value });
    },
    [updateParams],
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end">
      {/* Search */}
      <div className="relative flex-1">
        <Magnifer
          weight="BoldDuotone"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Cari nama pasangan..."
          value={currentSearch}
          onChange={(e) => handleSearch(e.target.value)}
          className="rounded-xl pl-9"
        />
      </div>

      {/* Month */}
      <Select value={currentMonth} onValueChange={handleMonth}>
        <SelectTrigger className="w-full rounded-xl md:w-40">
          <SelectValue placeholder="Semua Bulan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Bulan</SelectItem>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year */}
      <Select value={currentYear} onValueChange={handleYear}>
        <SelectTrigger className="w-full rounded-xl md:w-32">
          <SelectValue placeholder="Semua Tahun" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Tahun</SelectItem>
          {getYearOptions().map((y) => (
            <SelectItem key={y.value} value={y.value}>
              {y.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Venue */}
      <Select value={currentVenueId} onValueChange={handleVenue}>
        <SelectTrigger className="w-full rounded-xl md:w-48">
          <SelectValue placeholder="Semua Venue" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Venue</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
