"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Restart, AltArrowDown, CheckCircle, FileText, DocumentText } from "@solar-icons/react";
import { useEmployees } from "@/hooks/use-employees";
import { fetchAttendanceExport } from "@/services/attendance-service";
import { exportToExcel, exportToPDF } from "@/lib/attendance-export";
import { cn } from "@/lib/utils";

type Mode = "date" | "month" | "year";

const MODES: { value: Mode; label: string }[] = [
  { value: "date", label: "Tanggal" },
  { value: "month", label: "Bulan" },
  { value: "year", label: "Tahun" },
];

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

function buildPeriodLabel(mode: Mode, date: string, month: string, year: string): string {
  if (mode === "date") {
    return date
      ? new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
      : year;
  }
  if (mode === "month") {
    const m = MONTHS.find((mo) => mo.value === month);
    return m ? `${m.label} ${year}` : year;
  }
  return year;
}

function buildPeriodSlug(mode: Mode, date: string, month: string, year: string): string {
  if (mode === "date") {
    return date || year;
  }
  if (mode === "month") {
    return `${year}-${month.padStart(2, "0")}`;
  }
  return year;
}

export function AttendanceFilter(): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const currentMode = (searchParams.get("mode") as Mode | null) ?? "month";
  const currentDate = searchParams.get("date") ?? "";
  const currentMonth = searchParams.get("month") ?? String(new Date().getMonth() + 1);
  const currentYear = searchParams.get("year") ?? String(new Date().getFullYear());
  const currentProfileId = searchParams.get("profileId") ?? "";

  const { data: employeeData } = useEmployees({
    search: search || undefined,
    limit: 20,
    status: "active",
  });

  const employees = employeeData?.data ?? [];
  const selectedEmployee = employees.find((e) => e.id === currentProfileId);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [searchParams, router],
  );

  const handleModeChange = useCallback(
    (mode: Mode) => {
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (currentProfileId) params.set("profileId", currentProfileId);
      if (mode === "date") {
        if (currentDate) params.set("date", currentDate);
      }
      if (mode === "month") {
        params.set("month", currentMonth);
        params.set("year", currentYear);
      }
      if (mode === "year") {
        params.set("year", currentYear);
      }
      router.push(`?${params.toString()}`);
    },
    [currentDate, currentMonth, currentYear, currentProfileId, router],
  );

  const handleReset = useCallback(() => {
    router.push("?mode=month");
  }, [router]);

  const handleExportExcel = useCallback(async () => {
    setExportingExcel(true);
    try {
      const exportParams: Parameters<typeof fetchAttendanceExport>[0] = {
        year: Number(currentYear),
      };
      if (currentMode === "date" && currentDate) {
        exportParams.date = currentDate;
      }
      if (currentMode === "month") {
        exportParams.month = Number(currentMonth);
      }
      if (currentProfileId) {
        exportParams.profileId = currentProfileId;
      }

      const data = await fetchAttendanceExport(exportParams);
      if (data.length === 0) {
        toast.warning("Tidak ada data untuk diekspor");
        return;
      }

      const period = buildPeriodSlug(currentMode, currentDate, currentMonth, currentYear);
      exportToExcel(data, period);
      toast.success("Data berhasil diekspor ke Excel");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengekspor data");
    } finally {
      setExportingExcel(false);
    }
  }, [currentMode, currentDate, currentMonth, currentYear, currentProfileId]);

  const handleExportPDF = useCallback(async () => {
    setExportingPDF(true);
    try {
      const exportParams: Parameters<typeof fetchAttendanceExport>[0] = {
        year: Number(currentYear),
      };
      if (currentMode === "date" && currentDate) {
        exportParams.date = currentDate;
      }
      if (currentMode === "month") {
        exportParams.month = Number(currentMonth);
      }
      if (currentProfileId) {
        exportParams.profileId = currentProfileId;
      }

      const data = await fetchAttendanceExport(exportParams);
      if (data.length === 0) {
        toast.warning("Tidak ada data untuk diekspor");
        return;
      }

      const period = buildPeriodSlug(currentMode, currentDate, currentMonth, currentYear);
      const periodLabel = buildPeriodLabel(currentMode, currentDate, currentMonth, currentYear);
      exportToPDF(data, period, periodLabel);
      toast.success("Data berhasil diekspor ke PDF");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengekspor data");
    } finally {
      setExportingPDF(false);
    }
  }, [currentMode, currentDate, currentMonth, currentYear, currentProfileId]);

  const handleEmployeeSelect = useCallback(
    (val: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (val) {
        params.set("profileId", val);
      } else {
        params.delete("profileId");
      }
      params.delete("page");
      router.push(`?${params.toString()}`);
      setOpen(false);
    },
    [searchParams, router],
  );

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5 space-y-4">
        {/* Row 1: Mode toggle + Export buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tampilkan per</label>
            <div className="flex rounded-full border bg-muted p-0.5 gap-0.5 w-fit">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleModeChange(m.value)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                    currentMode === m.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="rounded-full flex-1 sm:flex-none"
            >
              <FileText weight="BoldDuotone" className="mr-1.5 h-4 w-4" />
              {exportingExcel ? "Mengunduh..." : "Excel"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="rounded-full flex-1 sm:flex-none"
            >
              <DocumentText weight="BoldDuotone" className="mr-1.5 h-4 w-4" />
              {exportingPDF ? "Mengunduh..." : "PDF"}
            </Button>
          </div>
        </div>

        {/* Row 2: Period filters + Employee + Reset */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          {/* Date input — only in date mode */}
          {currentMode === "date" && (
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground">Tanggal</label>
              <Input
                type="date"
                value={currentDate}
                onChange={(e) => updateParam("date", e.target.value)}
                className="rounded-xl sm:w-44"
              />
            </div>
          )}

          {/* Month select — only in month mode */}
          {currentMode === "month" && (
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground">Bulan</label>
              <Select value={currentMonth} onValueChange={(v) => updateParam("month", v)}>
                <SelectTrigger className="rounded-xl sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((mo) => (
                    <SelectItem key={mo.value} value={mo.value}>
                      {mo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Year select — in month and year mode */}
          {(currentMode === "month" || currentMode === "year") && (
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs font-medium text-muted-foreground">Tahun</label>
              <Select value={currentYear} onValueChange={(v) => updateParam("year", v)}>
                <SelectTrigger className="rounded-xl sm:w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map((y) => (
                    <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Karyawan combobox */}
          <div className="space-y-1 w-full sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground">Karyawan</label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                role="combobox"
                aria-expanded={open}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-full sm:w-56 rounded-xl justify-between font-normal",
                )}
              >
                <span className={cn("truncate", !currentProfileId && "text-muted-foreground")}>
                  {currentProfileId && selectedEmployee
                    ? (selectedEmployee.fullName ?? selectedEmployee.email)
                    : "Semua karyawan"}
                </span>
                <AltArrowDown weight="BoldDuotone" className="h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Cari karyawan..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Karyawan tidak ditemukan</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="" onSelect={() => handleEmployeeSelect("")}>
                        <CheckCircle
                          weight="BoldDuotone"
                          className={cn(
                            "mr-2 h-4 w-4",
                            !currentProfileId ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Semua karyawan
                      </CommandItem>
                      {employees.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={emp.id}
                          onSelect={(val) => handleEmployeeSelect(val)}
                        >
                          <CheckCircle
                            weight="BoldDuotone"
                            className={cn(
                              "mr-2 h-4 w-4",
                              currentProfileId === emp.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {emp.fullName ?? emp.email}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Reset */}
          <Button variant="ghost" size="sm" onClick={handleReset} className="rounded-full w-full sm:w-auto">
            <Restart weight="BoldDuotone" className="mr-1 h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
