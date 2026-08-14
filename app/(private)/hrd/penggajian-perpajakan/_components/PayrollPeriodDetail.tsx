"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Drawer } from "@/components/shared/drawer";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  usePayrollPeriodDetail,
  useFinalizePayroll,
  useMarkPayrollPaid,
} from "@/hooks/use-payroll-periods";
import { CalendarMinimalistic } from "@solar-icons/react";

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

const formatIDR = (amount: unknown): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(amount));

function statusBadge(status: string): React.ReactNode {
  const map: Record<string, { label: string; variant: "secondary" | "default" | "outline" }> = {
    draft: { label: "Draft", variant: "secondary" },
    processing: { label: "Processing", variant: "secondary" },
    finalized: { label: "Finalized", variant: "default" },
    paid: { label: "Paid", variant: "outline" },
  };
  const info = map[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={info.variant} className="rounded-full text-xs">
      {info.label}
    </Badge>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface PayrollPeriodDetailProps {
  periodId: string;
  open: boolean;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PayrollPeriodDetail({ periodId, open, onClose }: PayrollPeriodDetailProps) {
  const { data: period, isLoading } = usePayrollPeriodDetail(periodId);
  const finalizeMutation = useFinalizePayroll();
  const markPaidMutation = useMarkPayrollPaid();

  const handleFinalize = useCallback(() => {
    if (!periodId) return;
    finalizeMutation.mutate(periodId, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Payroll berhasil difinalisasi");
        } else {
          toast.error(result.error ?? "Gagal memfinalisasi payroll");
        }
      },
      onError: () => toast.error("Terjadi kesalahan"),
    });
  }, [periodId, finalizeMutation]);

  const handleMarkPaid = useCallback(() => {
    if (!periodId) return;
    markPaidMutation.mutate(periodId, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Payroll ditandai lunas");
        } else {
          toast.error(result.error ?? "Gagal menandai payroll lunas");
        }
      },
      onError: () => toast.error("Terjadi kesalahan"),
    });
  }, [periodId, markPaidMutation]);

  const title = period
    ? `Payroll ${MONTH_NAMES[period.month - 1]} ${period.year}`
    : "Detail Payroll";

  const payslips = period?.payslips ?? [];

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title}
      maxWidth="sm:max-w-4xl"
    >
      {isLoading && (
        <div className="space-y-3 p-2">
          <Skeleton className="h-8 w-60 rounded-lg" />
          <Skeleton className="h-6 w-80 rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !period && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarMinimalistic
            weight="BoldDuotone"
            className="h-12 w-12 text-muted-foreground/40"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Periode payroll tidak ditemukan.
          </p>
        </div>
      )}

      {!isLoading && period && (
        <div className="flex flex-col gap-5">
          {/* Header Summary */}
          <div className="flex flex-wrap items-center gap-3">
            {statusBadge(period.status)}
            <span className="text-sm text-muted-foreground">
              {period.totalEmployees} karyawan
            </span>
            <span className="text-sm text-muted-foreground">
              Bruto: <span className="font-mono font-medium text-foreground">{formatIDR(period.totalGrossAmount)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Netto: <span className="font-mono font-medium text-foreground">{formatIDR(period.totalNetAmount)}</span>
            </span>
          </div>

          {/* Payslips Table */}
          {payslips.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">Belum ada slip gaji.</p>
            </div>
          )}

          {payslips.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Karyawan</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead className="text-right">Earning</TableHead>
                    <TableHead className="text-right">PPh 21</TableHead>
                    <TableHead className="text-right">BPJS</TableHead>
                    <TableHead className="text-right">Tot. Potongan</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((slip) => {
                    const bpjsEmployee =
                      Number(slip.bpjsKesEmployee) +
                      Number(slip.jhtEmployee) +
                      Number(slip.jpEmployee);
                    return (
                      <TableRow key={slip.id}>
                        <TableCell className="font-mono text-xs">
                          {slip.employeeNumber ?? "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {slip.employeeName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {slip.departmentName ?? "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatIDR(slip.totalEarnings)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatIDR(slip.pph21Amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatIDR(bpjsEmployee)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatIDR(slip.totalDeductions)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {formatIDR(slip.netSalary)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            {period.status === "draft" && (
              <PermissionGate module="hr-payroll" action="edit">
                <Button
                  className="rounded-full"
                  onClick={handleFinalize}
                  disabled={finalizeMutation.isPending}
                >
                  {finalizeMutation.isPending ? "Memfinalisasi..." : "Finalize"}
                </Button>
              </PermissionGate>
            )}
            {period.status === "finalized" && (
              <PermissionGate module="hr-payroll" action="edit">
                <Button
                  className="rounded-full"
                  onClick={handleMarkPaid}
                  disabled={markPaidMutation.isPending}
                >
                  {markPaidMutation.isPending ? "Memproses..." : "Tandai Dibayar"}
                </Button>
              </PermissionGate>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
