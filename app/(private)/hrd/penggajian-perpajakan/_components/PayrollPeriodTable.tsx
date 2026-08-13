"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  usePayrollPeriods,
  useFinalizePayroll,
  useMarkPayrollPaid,
  useDeletePayrollPeriod,
} from "@/hooks/use-payroll-periods";
import {
  AddCircle,
  Eye,
  CheckCircle,
  Wallet,
  TrashBinTrash,
  CalendarMinimalistic,
} from "@solar-icons/react";
import { GeneratePayrollDialog } from "./GeneratePayrollDialog";
import { PayrollPeriodDetail } from "./PayrollPeriodDetail";

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

// ─── Component ──────────────────────────────────────────────────────────────

export function PayrollPeriodTable() {
  const { data: periods, isLoading } = usePayrollPeriods();
  const finalizeMutation = useFinalizePayroll();
  const markPaidMutation = useMarkPayrollPaid();
  const deleteMutation = useDeletePayrollPeriod();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailPeriodId, setDetailPeriodId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "finalize" | "paid" | "delete";
    periodId: string;
    label: string;
  } | null>(null);

  const sortedPeriods = useMemo(() => {
    if (!periods) return [];
    return [...periods].sort((a, b) => {
      const yearDiff = b.year - a.year;
      if (yearDiff !== 0) return yearDiff;
      return b.month - a.month;
    });
  }, [periods]);

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;

    const { type, periodId } = confirmAction;

    if (type === "finalize") {
      finalizeMutation.mutate(periodId, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Payroll berhasil difinalisasi");
          } else {
            toast.error(result.error ?? "Gagal memfinalisasi payroll");
          }
          setConfirmAction(null);
        },
        onError: () => {
          toast.error("Terjadi kesalahan");
          setConfirmAction(null);
        },
      });
    } else if (type === "paid") {
      markPaidMutation.mutate(periodId, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Payroll ditandai lunas");
          } else {
            toast.error(result.error ?? "Gagal menandai payroll lunas");
          }
          setConfirmAction(null);
        },
        onError: () => {
          toast.error("Terjadi kesalahan");
          setConfirmAction(null);
        },
      });
    } else if (type === "delete") {
      deleteMutation.mutate(periodId, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Periode payroll dihapus");
          } else {
            toast.error(result.error ?? "Gagal menghapus periode payroll");
          }
          setConfirmAction(null);
        },
        onError: () => {
          toast.error("Terjadi kesalahan");
          setConfirmAction(null);
        },
      });
    }
  }, [confirmAction, finalizeMutation, markPaidMutation, deleteMutation]);

  const isActioning =
    finalizeMutation.isPending || markPaidMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Periode Payroll</CardTitle>
            <PermissionGate module="hr-payroll" action="create">
              <Button
                onClick={() => setGenerateOpen(true)}
                className="rounded-full gap-1.5"
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Generate Payroll
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && sortedPeriods.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarMinimalistic
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada periode payroll. Klik Generate Payroll untuk mulai.
              </p>
            </div>
          )}

          {!isLoading && sortedPeriods.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bulan / Tahun</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Karyawan</TableHead>
                    <TableHead className="text-right">Total Bruto</TableHead>
                    <TableHead className="text-right">Total Netto</TableHead>
                    <TableHead className="w-44">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPeriods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {MONTH_NAMES[p.month - 1]} {p.year}
                      </TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-right">{p.totalEmployees}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatIDR(p.totalGrossAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatIDR(p.totalNetAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => setDetailPeriodId(p.id)}
                            title="Detail"
                          >
                            <Eye weight="BoldDuotone" className="h-3.5 w-3.5" />
                          </Button>

                          {p.status === "draft" && (
                            <PermissionGate module="hr-payroll" action="edit">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                title="Finalize"
                                onClick={() =>
                                  setConfirmAction({
                                    type: "finalize",
                                    periodId: p.id,
                                    label: `Finalisasi payroll ${MONTH_NAMES[p.month - 1]} ${p.year}?`,
                                  })
                                }
                              >
                                <CheckCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                              </Button>
                            </PermissionGate>
                          )}

                          {p.status === "finalized" && (
                            <PermissionGate module="hr-payroll" action="edit">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                title="Tandai Dibayar"
                                onClick={() =>
                                  setConfirmAction({
                                    type: "paid",
                                    periodId: p.id,
                                    label: `Tandai payroll ${MONTH_NAMES[p.month - 1]} ${p.year} sebagai dibayar?`,
                                  })
                                }
                              >
                                <Wallet weight="BoldDuotone" className="h-3.5 w-3.5" />
                              </Button>
                            </PermissionGate>
                          )}

                          {p.status === "draft" && (
                            <PermissionGate module="hr-payroll" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                                title="Hapus"
                                onClick={() =>
                                  setConfirmAction({
                                    type: "delete",
                                    periodId: p.id,
                                    label: `Hapus periode payroll ${MONTH_NAMES[p.month - 1]} ${p.year}? Tindakan ini tidak dapat dibatalkan.`,
                                  })
                                }
                              >
                                <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Dialog */}
      <GeneratePayrollDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />

      {/* Detail Drawer */}
      <PayrollPeriodDetail
        periodId={detailPeriodId ?? ""}
        open={detailPeriodId !== null}
        onClose={() => setDetailPeriodId(null)}
      />

      {/* Confirm Action Dialog */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Konfirmasi</DialogTitle>
            <DialogDescription>{confirmAction?.label}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setConfirmAction(null)}
              disabled={isActioning}
            >
              Batal
            </Button>
            <Button
              variant={confirmAction?.type === "delete" ? "destructive" : "default"}
              className="rounded-full"
              onClick={handleConfirmAction}
              disabled={isActioning}
            >
              {isActioning ? "Memproses..." : "Ya, Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
