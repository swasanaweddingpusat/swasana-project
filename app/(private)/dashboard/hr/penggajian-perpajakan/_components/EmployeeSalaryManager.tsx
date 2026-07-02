"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  useEmployeeSalaries,
  useSetEmployeeSalary,
  useBulkSetEmployeeSalary,
} from "@/hooks/use-employee-salaries";
import { useSalaryComponents } from "@/hooks/use-salary-components";
import { useEmployees } from "@/hooks/use-employees";
import { Pen, UsersGroupTwoRounded, Wallet } from "@solar-icons/react";
import type { EmployeeSalaryItem } from "@/lib/queries/employeeSalaries";

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatIDR = (amount: unknown): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(amount));

interface EmployeeRow {
  profileId: string;
  fullName: string;
  employeeNumber: number;
  departmentName: string | null;
  salaries: Record<string, { id: string; amount: unknown }>;
}

function buildEmployeeRows(
  salaryData: EmployeeSalaryItem[],
): EmployeeRow[] {
  const map = new Map<string, EmployeeRow>();

  for (const item of salaryData) {
    const existing = map.get(item.profileId);
    if (!existing) {
      const newRow: EmployeeRow = {
        profileId: item.profileId,
        fullName: item.profile.fullName ?? "-",
        employeeNumber: item.profile.employeeNumber,
        departmentName: item.profile.department?.name ?? null,
        salaries: {},
      };
      newRow.salaries[item.salaryComponentId] = {
        id: item.id,
        amount: item.amount,
      };
      map.set(item.profileId, newRow);
    } else {
      existing.salaries[item.salaryComponentId] = {
        id: item.id,
        amount: item.amount,
      };
    }
  }

  return Array.from(map.values()).sort((a, b) => a.employeeNumber - b.employeeNumber);
}

// ─── Edit Dialog State ──────────────────────────────────────────────────────

interface EditDialogState {
  profileId: string;
  fullName: string;
  values: Record<string, string>;
}

// ─── Bulk Dialog State ──────────────────────────────────────────────────────

interface BulkDialogState {
  salaryComponentId: string;
  amount: string;
  effectiveDate: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmployeeSalaryManager() {
  const { data: salaryData, isLoading: salariesLoading } = useEmployeeSalaries();
  const { data: components, isLoading: componentsLoading } = useSalaryComponents();
  const { data: employeesData } = useEmployees({ limit: 500, status: "active" });
  const setMutation = useSetEmployeeSalary();
  const bulkMutation = useBulkSetEmployeeSalary();

  const isLoading = salariesLoading || componentsLoading;

  const activeComponents = useMemo(() => {
    if (!components) return [];
    return components.filter((c) => c.isActive);
  }, [components]);

  const employeeRows = useMemo(() => {
    if (!salaryData) return [];
    return buildEmployeeRows(salaryData);
  }, [salaryData]);

  // ─── Edit Dialog ────────────────────────────────────────────────────────────

  const [editDialog, setEditDialog] = useState<EditDialogState | null>(null);

  const handleOpenEdit = useCallback(
    (row: EmployeeRow) => {
      const values: Record<string, string> = {};
      for (const comp of activeComponents) {
        const existing = row.salaries[comp.id];
        if (existing) {
          values[comp.id] = String(Number(existing.amount));
        } else {
          values[comp.id] = "";
        }
      }
      setEditDialog({
        profileId: row.profileId,
        fullName: row.fullName,
        values,
      });
    },
    [activeComponents],
  );

  const handleEditSubmit = useCallback(() => {
    if (!editDialog) return;

    const today = new Date().toISOString().split("T")[0];
    const promises: Array<Promise<unknown>> = [];

    for (const comp of activeComponents) {
      const rawVal = editDialog.values[comp.id];
      if (rawVal === undefined || rawVal === "") continue;

      const amount = parseFloat(rawVal);
      if (isNaN(amount) || amount < 0) continue;

      promises.push(
        new Promise<void>((resolve, reject) => {
          setMutation.mutate(
            {
              profileId: editDialog.profileId,
              salaryComponentId: comp.id,
              amount,
              effectiveDate: today,
            },
            {
              onSuccess: (result) => {
                if (result.success) {
                  resolve();
                } else {
                  reject(new Error(result.error));
                }
              },
              onError: reject,
            },
          );
        }),
      );
    }

    Promise.all(promises)
      .then(() => {
        toast.success("Gaji karyawan berhasil disimpan");
        setEditDialog(null);
      })
      .catch(() => {
        toast.error("Beberapa data gagal disimpan");
      });
  }, [editDialog, activeComponents, setMutation]);

  // ─── Bulk Dialog ────────────────────────────────────────────────────────────

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkDialogState>({
    salaryComponentId: "",
    amount: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  const handleToggleEmployee = useCallback((profileId: string, checked: boolean) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(profileId);
      } else {
        next.delete(profileId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      if (checked && employeesData?.data) {
        setSelectedEmployees(new Set(employeesData.data.map((e) => e.id)));
      } else {
        setSelectedEmployees(new Set());
      }
    },
    [employeesData],
  );

  const handleBulkSubmit = useCallback(() => {
    if (!bulkForm.salaryComponentId) {
      toast.error("Pilih komponen gaji");
      return;
    }
    const amount = parseFloat(bulkForm.amount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Jumlah tidak valid");
      return;
    }
    if (selectedEmployees.size === 0) {
      toast.error("Pilih minimal satu karyawan");
      return;
    }

    bulkMutation.mutate(
      {
        profileIds: Array.from(selectedEmployees),
        salaryComponentId: bulkForm.salaryComponentId,
        amount,
        effectiveDate: bulkForm.effectiveDate,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success(`Gaji berhasil diatur untuk ${selectedEmployees.size} karyawan`);
            setBulkOpen(false);
            setSelectedEmployees(new Set());
            setBulkForm({
              salaryComponentId: "",
              amount: "",
              effectiveDate: new Date().toISOString().split("T")[0],
            });
          } else {
            toast.error(result.error ?? "Gagal mengatur gaji massal");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      },
    );
  }, [bulkForm, selectedEmployees, bulkMutation]);

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Gaji Karyawan</CardTitle>
            <PermissionGate module="hr-payroll" action="edit">
              <Button
                onClick={() => setBulkOpen(true)}
                variant="outline"
                className="rounded-full gap-1.5"
              >
                <UsersGroupTwoRounded weight="BoldDuotone" className="h-4 w-4" />
                Bulk Set
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

          {!isLoading && employeeRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada data gaji karyawan
              </p>
            </div>
          )}

          {!isLoading && employeeRows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Karyawan</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Departemen</TableHead>
                    {activeComponents.map((comp) => (
                      <TableHead key={comp.id} className="text-right">
                        {comp.name}
                      </TableHead>
                    ))}
                    <TableHead className="w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeRows.map((row) => (
                    <TableRow key={row.profileId}>
                      <TableCell className="font-mono text-xs">
                        {row.employeeNumber}
                      </TableCell>
                      <TableCell className="font-medium">{row.fullName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.departmentName ?? "-"}
                      </TableCell>
                      {activeComponents.map((comp) => {
                        const salary = row.salaries[comp.id];
                        return (
                          <TableCell key={comp.id} className="text-right font-mono text-sm">
                            {salary ? formatIDR(salary.amount) : "-"}
                          </TableCell>
                        );
                      })}
                      <TableCell>
                        <PermissionGate module="hr-payroll" action="edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => handleOpenEdit(row)}
                          >
                            <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Employee Salary Dialog */}
      <Dialog
        open={editDialog !== null}
        onOpenChange={(open) => {
          if (!open) setEditDialog(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Atur Gaji - {editDialog?.fullName}
            </DialogTitle>
            <DialogDescription>
              Masukkan nominal untuk setiap komponen gaji.
            </DialogDescription>
          </DialogHeader>

          {editDialog && (
            <div className="grid gap-3 py-2">
              {activeComponents.map((comp) => (
                <div key={comp.id} className="flex items-center gap-3">
                  <Label className="w-40 shrink-0 text-sm">{comp.name}</Label>
                  <Input
                    type="number"
                    value={editDialog.values[comp.id] ?? ""}
                    onChange={(e) =>
                      setEditDialog((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          values: { ...prev.values, [comp.id]: e.target.value },
                        };
                      })
                    }
                    placeholder="0"
                    className="rounded-xl font-mono"
                    min={0}
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setEditDialog(null)}
              disabled={setMutation.isPending}
            >
              Batal
            </Button>
            <Button
              className="rounded-full"
              onClick={handleEditSubmit}
              disabled={setMutation.isPending}
            >
              {setMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Set Dialog */}
      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkOpen(false);
            setSelectedEmployees(new Set());
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Bulk Set Gaji</DialogTitle>
            <DialogDescription>
              Atur satu komponen gaji untuk beberapa karyawan sekaligus.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-component">Komponen Gaji *</Label>
                <Select
                  value={bulkForm.salaryComponentId}
                  onValueChange={(val) =>
                    setBulkForm((f) => ({ ...f, salaryComponentId: val }))
                  }
                >
                  <SelectTrigger id="bulk-component" className="rounded-xl">
                    <SelectValue placeholder="Pilih komponen" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeComponents.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id}>
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-amount">Jumlah (Rp) *</Label>
                <Input
                  id="bulk-amount"
                  type="number"
                  value={bulkForm.amount}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0"
                  className="rounded-xl font-mono"
                  min={0}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bulk-date">Tanggal Efektif</Label>
              <Input
                id="bulk-date"
                type="date"
                value={bulkForm.effectiveDate}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, effectiveDate: e.target.value }))
                }
                className="rounded-xl w-48"
              />
            </div>

            {/* Employee Selection */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Pilih Karyawan ({selectedEmployees.size} dipilih)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => handleToggleAll(selectedEmployees.size === 0)}
                >
                  {selectedEmployees.size === 0 ? "Pilih Semua" : "Batal Pilih"}
                </Button>
              </div>
              <div className="border rounded-xl max-h-60 overflow-y-auto p-2 space-y-1">
                {employeesData?.data.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedEmployees.has(emp.id)}
                      onCheckedChange={(checked) =>
                        handleToggleEmployee(emp.id, checked === true)
                      }
                    />
                    <span className="text-sm">{emp.fullName}</span>
                    {emp.employeeNumber && (
                      <span className="text-xs text-muted-foreground font-mono">
                        ({emp.employeeNumber})
                      </span>
                    )}
                  </label>
                ))}
                {(!employeesData || employeesData.data.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Tidak ada karyawan aktif
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setBulkOpen(false);
                setSelectedEmployees(new Set());
              }}
              disabled={bulkMutation.isPending}
            >
              Batal
            </Button>
            <Button
              className="rounded-full"
              onClick={handleBulkSubmit}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending
                ? "Menyimpan..."
                : `Set untuk ${selectedEmployees.size} Karyawan`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
