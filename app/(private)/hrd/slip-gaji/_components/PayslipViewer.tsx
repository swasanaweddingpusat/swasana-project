"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyPayslips, usePayslipDetail } from "@/hooks/use-payslips";
import { DocumentText } from "@solar-icons/react";
import { PayslipCard } from "./PayslipCard";

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// ─── Component ──────────────────────────────────────────────────────────────

export function PayslipViewer() {
  const { data: payslips, isLoading: isLoadingList } = useMyPayslips();

  const defaultId = payslips?.[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string>("");

  const resolvedId = selectedId || defaultId;

  const { data: detail, isLoading: isLoadingDetail } = usePayslipDetail(resolvedId);

  const periodOptions = useMemo(() => {
    if (!payslips) return [];
    return payslips.map((p) => ({
      id: p.id,
      label: `${MONTH_NAMES[(p.payrollPeriod.month ?? 1) - 1]} ${p.payrollPeriod.year}`,
    }));
  }, [payslips]);

  if (isLoadingList) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48 rounded-lg" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!payslips || payslips.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <DocumentText
            weight="BoldDuotone"
            className="h-12 w-12 text-muted-foreground/40"
          />
          <p className="mt-4 text-base font-medium text-muted-foreground">
            Belum ada slip gaji yang tersedia
          </p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Slip gaji akan muncul setelah payroll difinalisasi oleh HR.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Period Selector */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Slip Gaji</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground shrink-0">
              Pilih Periode:
            </label>
            <Select
              value={resolvedId}
              onValueChange={(val) => setSelectedId(val)}
            >
              <SelectTrigger className="w-full sm:w-52 rounded-xl">
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payslip Detail */}
      {isLoadingDetail && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </CardContent>
        </Card>
      )}

      {!isLoadingDetail && detail && <PayslipCard payslip={detail} />}
    </div>
  );
}
