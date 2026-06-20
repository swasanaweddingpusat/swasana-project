"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Restart } from "@solar-icons/react";

const MONTHS = [
  { value: "1", label: "Januari" }, { value: "2", label: "Februari" },
  { value: "3", label: "Maret" }, { value: "4", label: "April" },
  { value: "5", label: "Mei" }, { value: "6", label: "Juni" },
  { value: "7", label: "Juli" }, { value: "8", label: "Agustus" },
  { value: "9", label: "September" }, { value: "10", label: "Oktober" },
  { value: "11", label: "November" }, { value: "12", label: "Desember" },
];

function getYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = current - i;
    return { value: String(y), label: String(y) };
  });
}

export function AttendanceFilter() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentMonth = searchParams.get("month") ?? String(new Date().getMonth() + 1);
  const currentYear = searchParams.get("year") ?? String(new Date().getFullYear());

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.delete("page");
    router.push(`?${params.toString()}`);
  }, [searchParams, router]);

  const handleReset = useCallback(() => {
    router.push("?");
  }, [router]);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Bulan</label>
            <Select value={currentMonth} onValueChange={(v) => updateParam("month", v)}>
              <SelectTrigger className="w-36 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tahun</label>
            <Select value={currentYear} onValueChange={(v) => updateParam("year", v)}>
              <SelectTrigger className="w-28 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getYearOptions().map((y) => (
                  <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="sm" onClick={handleReset} className="rounded-full">
            <Restart weight="BoldDuotone" className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
