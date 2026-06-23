"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Restart, AltArrowDown, CheckCircle } from "@solar-icons/react";
import { useEmployees } from "@/hooks/use-employees";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Karyawan</label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                role="combobox"
                aria-expanded={open}
                className={cn(buttonVariants({ variant: "outline" }), "w-56 rounded-xl justify-between font-normal")}
              >
                <span className={cn("truncate", !currentProfileId && "text-muted-foreground")}>
                  {currentProfileId && selectedEmployee
                    ? selectedEmployee.fullName ?? selectedEmployee.email
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
                      <CommandItem
                        value=""
                        onSelect={() => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.delete("profileId");
                          params.delete("page");
                          router.push(`?${params.toString()}`);
                          setOpen(false);
                        }}
                      >
                        <CheckCircle weight="BoldDuotone" className={cn("mr-2 h-4 w-4", !currentProfileId ? "opacity-100" : "opacity-0")} />
                        Semua karyawan
                      </CommandItem>
                      {employees.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={emp.id}
                          onSelect={(val) => {
                            updateParam("profileId", val);
                            setOpen(false);
                          }}
                        >
                          <CheckCircle weight="BoldDuotone" className={cn("mr-2 h-4 w-4", currentProfileId === emp.id ? "opacity-100" : "opacity-0")} />
                          {emp.fullName ?? emp.email}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
