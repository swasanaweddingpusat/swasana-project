"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  useLeaveBalances,
  useGenerateLeaveBalances,
  useAdjustLeaveBalance,
} from "@/hooks/use-leave-balances";
import { useLeaveTypes } from "@/hooks/use-leave-types";
import { getAvailableBalance } from "@/lib/leave-helpers";
import { AddCircle, Pen, CalendarMinimalistic } from "@solar-icons/react";
import type { LeaveBalanceItem } from "@/lib/queries/leaveBalances";

const CURRENT_YEAR = new Date().getFullYear();
const ALL_TYPES = "__all__";

function buildYearOptions(): number[] {
  return [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
}

export function LeaveBalanceManager() {
  const { data: leaveTypes } = useLeaveTypes();
  const generateMutation = useGenerateLeaveBalances();
  const adjustMutation = useAdjustLeaveBalance();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState(ALL_TYPES);
  const [search, setSearch] = useState("");

  const params = useMemo(() => {
    const p: { year: number; leaveTypeId?: string } = { year };
    if (leaveTypeFilter !== ALL_TYPES) {
      p.leaveTypeId = leaveTypeFilter;
    }
    return p;
  }, [year, leaveTypeFilter]);

  const { data: balances, isLoading } = useLeaveBalances(params);

  const filteredBalances = useMemo(() => {
    if (!balances) return [];
    if (!search.trim()) return balances;
    const q = search.toLowerCase();
    return balances.filter(
      (b) =>
        (b.profile.fullName &&
          b.profile.fullName.toLowerCase().includes(q)) ||
        String(b.profile.employeeNumber).includes(q)
    );
  }, [balances, search]);

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateYear, setGenerateYear] = useState(CURRENT_YEAR);

  const handleGenerate = useCallback(() => {
    generateMutation.mutate(
      { year: generateYear },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success(result.message ?? "Saldo cuti berhasil digenerate");
            setGenerateOpen(false);
          } else {
            toast.error(result.error ?? "Gagal generate saldo");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      }
    );
  }, [generateYear, generateMutation]);

  // Adjust dialog
  const [adjustTarget, setAdjustTarget] = useState<LeaveBalanceItem | null>(
    null
  );
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  const handleOpenAdjust = useCallback((item: LeaveBalanceItem) => {
    setAdjustTarget(item);
    setAdjustAmount(item.adjustmentDays);
    setAdjustReason("");
  }, []);

  const handleAdjust = useCallback(() => {
    if (!adjustTarget) return;
    if (!adjustReason.trim()) {
      toast.error("Alasan adjustment wajib diisi");
      return;
    }

    adjustMutation.mutate(
      {
        balanceId: adjustTarget.id,
        adjustmentDays: adjustAmount,
        reason: adjustReason.trim(),
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Adjustment berhasil disimpan");
            setAdjustTarget(null);
            setAdjustReason("");
          } else {
            toast.error(result.error ?? "Gagal menyimpan adjustment");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      }
    );
  }, [adjustTarget, adjustAmount, adjustReason, adjustMutation]);

  const yearOptions = buildYearOptions();

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="font-heading text-lg">Saldo Cuti</CardTitle>
            <Button
              onClick={() => setGenerateOpen(true)}
              className="rounded-full gap-1.5"
            >
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Generate Saldo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Tahun</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger className="w-28 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Jenis Cuti
              </Label>
              <Select
                value={leaveTypeFilter}
                onValueChange={setLeaveTypeFilter}
              >
                <SelectTrigger className="w-44 rounded-xl">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>Semua</SelectItem>
                  {leaveTypes?.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5 flex-1 sm:max-w-xs">
              <Label className="text-xs text-muted-foreground">
                Cari Karyawan
              </Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama atau NIP..."
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && filteredBalances.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarMinimalistic
                weight="BoldDuotone"
                className="h-10 w-10 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Tidak ada data saldo cuti
              </p>
            </div>
          )}

          {!isLoading && filteredBalances.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Jenis Cuti</TableHead>
                    <TableHead>Tahun</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Terpakai</TableHead>
                    <TableHead>Carry Over</TableHead>
                    <TableHead>Adjustment</TableHead>
                    <TableHead>Sisa</TableHead>
                    <TableHead className="w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBalances.map((balance) => {
                    const available = getAvailableBalance(balance);
                    return (
                      <TableRow key={balance.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {balance.profile.fullName}
                            </p>
                            {balance.profile.employeeNumber && (
                              <p className="text-xs text-muted-foreground">
                                {balance.profile.employeeNumber}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {balance.leaveType.name}
                        </TableCell>
                        <TableCell>{balance.year}</TableCell>
                        <TableCell>{balance.totalDays}</TableCell>
                        <TableCell>{balance.usedDays}</TableCell>
                        <TableCell>{balance.carryOverDays}</TableCell>
                        <TableCell>
                          {balance.adjustmentDays !== 0 ? (
                            <span
                              className={
                                balance.adjustmentDays > 0
                                  ? "text-primary"
                                  : "text-destructive"
                              }
                            >
                              {balance.adjustmentDays > 0 ? "+" : ""}
                              {balance.adjustmentDays}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {available}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => handleOpenAdjust(balance)}
                            title="Adjust"
                          >
                            <Pen
                              weight="BoldDuotone"
                              className="h-3.5 w-3.5"
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Dialog */}
      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          if (!open) setGenerateOpen(false);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Generate Saldo Cuti</DialogTitle>
            <DialogDescription>
              Generate saldo cuti untuk seluruh karyawan aktif pada tahun yang
              dipilih. Saldo yang sudah ada tidak akan ditimpa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="gen-year">Tahun</Label>
            <Input
              id="gen-year"
              type="number"
              value={generateYear}
              onChange={(e) =>
                setGenerateYear(parseInt(e.target.value, 10) || CURRENT_YEAR)
              }
              className="rounded-xl w-28"
              min={2020}
              max={2100}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setGenerateOpen(false)}
              disabled={generateMutation.isPending}
            >
              Batal
            </Button>
            <Button
              className="rounded-full"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Memproses..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog
        open={adjustTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustTarget(null);
            setAdjustReason("");
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Adjust Saldo</DialogTitle>
            <DialogDescription>
              {adjustTarget && (
                <>
                  Adjust saldo{" "}
                  <span className="font-semibold">
                    {adjustTarget.leaveType.name}
                  </span>{" "}
                  untuk{" "}
                  <span className="font-semibold">
                    {adjustTarget.profile.fullName}
                  </span>{" "}
                  (tahun {adjustTarget.year}).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="adjust-amount">Adjustment (hari)</Label>
              <Input
                id="adjust-amount"
                type="number"
                value={adjustAmount}
                onChange={(e) =>
                  setAdjustAmount(parseInt(e.target.value, 10) || 0)
                }
                className="rounded-xl w-28"
              />
              <p className="text-xs text-muted-foreground">
                Gunakan angka positif untuk menambah, negatif untuk mengurangi.
                {adjustTarget && (
                  <>
                    {" "}
                    Adjustment saat ini: {adjustTarget.adjustmentDays} hari.
                  </>
                )}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adjust-reason">Alasan *</Label>
              <Textarea
                id="adjust-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Tulis alasan adjustment..."
                className="rounded-xl"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setAdjustTarget(null);
                setAdjustReason("");
              }}
              disabled={adjustMutation.isPending}
            >
              Batal
            </Button>
            <Button
              className="rounded-full"
              onClick={handleAdjust}
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
