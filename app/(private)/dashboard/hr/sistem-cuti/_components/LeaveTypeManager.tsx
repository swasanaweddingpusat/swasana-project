"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  useLeaveTypes,
  useCreateLeaveType,
  useUpdateLeaveType,
  useDeleteLeaveType,
} from "@/hooks/use-leave-types";
import { AddCircle, Pen, TrashBinTrash, CalendarMinimalistic } from "@solar-icons/react";
import type { LeaveTypeItem } from "@/lib/queries/leaveTypes";

// ─── Form State ──────────────────────────────────────────────────────────────

interface LeaveTypeFormState {
  name: string;
  code: string;
  description: string;
  defaultQuota: number;
  isDeductible: boolean;
  requiresApproval: boolean;
  maxConsecutiveDays: string;
  minDaysBeforeRequest: number;
  isCarryOver: boolean;
  carryOverMaxDays: string;
  carryOverExpiryMonths: string;
}

const EMPTY_FORM: LeaveTypeFormState = {
  name: "",
  code: "",
  description: "",
  defaultQuota: 0,
  isDeductible: true,
  requiresApproval: true,
  maxConsecutiveDays: "",
  minDaysBeforeRequest: 0,
  isCarryOver: false,
  carryOverMaxDays: "",
  carryOverExpiryMonths: "",
};

function formFromItem(item: LeaveTypeItem): LeaveTypeFormState {
  return {
    name: item.name,
    code: item.code,
    description: item.description ?? "",
    defaultQuota: item.defaultQuota,
    isDeductible: item.isDeductible,
    requiresApproval: item.requiresApproval,
    maxConsecutiveDays: item.maxConsecutiveDays
      ? String(item.maxConsecutiveDays)
      : "",
    minDaysBeforeRequest: item.minDaysBeforeRequest,
    isCarryOver: item.isCarryOver,
    carryOverMaxDays: item.carryOverMaxDays
      ? String(item.carryOverMaxDays)
      : "",
    carryOverExpiryMonths: item.carryOverExpiryMonths
      ? String(item.carryOverExpiryMonths)
      : "",
  };
}

function formToPayload(form: LeaveTypeFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    description: form.description.trim() || undefined,
    defaultQuota: form.defaultQuota,
    isDeductible: form.isDeductible,
    requiresApproval: form.requiresApproval,
    maxConsecutiveDays: form.maxConsecutiveDays
      ? parseInt(form.maxConsecutiveDays, 10)
      : undefined,
    minDaysBeforeRequest: form.minDaysBeforeRequest,
    isCarryOver: form.isCarryOver,
    carryOverMaxDays: form.carryOverMaxDays
      ? parseInt(form.carryOverMaxDays, 10)
      : undefined,
    carryOverExpiryMonths: form.carryOverExpiryMonths
      ? parseInt(form.carryOverExpiryMonths, 10)
      : undefined,
  };
}

// We treat the data as LeaveTypeAdminItem when _count exists
interface LeaveTypeWithCount extends LeaveTypeItem {
  _count?: { requests: number };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LeaveTypeManager() {
  const { data: rawTypes, isLoading } = useLeaveTypes();
  const createMutation = useCreateLeaveType();
  const updateMutation = useUpdateLeaveType();
  const deleteMutation = useDeleteLeaveType();

  const leaveTypes = rawTypes as LeaveTypeWithCount[] | undefined;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeaveTypeWithCount | null>(null);
  const [form, setForm] = useState<LeaveTypeFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<LeaveTypeWithCount | null>(null);

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: LeaveTypeWithCount) => {
    setEditingItem(item);
    setForm(formFromItem(item));
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Nama jenis cuti wajib diisi");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Code wajib diisi");
      return;
    }

    const payload = formToPayload(form);

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Jenis cuti berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui jenis cuti");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Jenis cuti berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan jenis cuti");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      });
    }
  }, [form, editingItem, createMutation, updateMutation, handleCloseDialog]);

  const handleToggleActive = useCallback(
    (item: LeaveTypeWithCount, isActive: boolean) => {
      updateMutation.mutate(
        { id: item.id, data: { isActive } },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success(
                isActive ? "Jenis cuti diaktifkan" : "Jenis cuti dinonaktifkan"
              );
            } else {
              toast.error(result.error ?? "Gagal mengubah status");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    },
    [updateMutation]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Jenis cuti berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus jenis cuti");
        }
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Terjadi kesalahan");
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Jenis Cuti</CardTitle>
            <PermissionGate module="hr-leave" action="create">
              <Button
                onClick={handleOpenCreate}
                className="rounded-full gap-1.5"
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Jenis Cuti
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

          {!isLoading && (!leaveTypes || leaveTypes.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarMinimalistic
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada jenis cuti
              </p>
            </div>
          )}

          {!isLoading && leaveTypes && leaveTypes.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Kuota</TableHead>
                    <TableHead>Deductible</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Max Hari</TableHead>
                    <TableHead>Min Notice</TableHead>
                    <TableHead>Carry Over</TableHead>
                    <TableHead>Sistem</TableHead>
                    <TableHead>Aktif</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveTypes.map((lt) => (
                    <TableRow key={lt.id}>
                      <TableCell className="font-medium">{lt.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-xs font-mono">
                          {lt.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{lt.defaultQuota}</TableCell>
                      <TableCell>
                        {lt.isDeductible ? (
                          <Badge variant="default" className="rounded-full text-xs">
                            Ya
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Tidak
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lt.requiresApproval ? "Ya" : "Tidak"}
                      </TableCell>
                      <TableCell>
                        {lt.maxConsecutiveDays ?? "-"}
                      </TableCell>
                      <TableCell>
                        {lt.minDaysBeforeRequest > 0
                          ? `${lt.minDaysBeforeRequest} hari`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {lt.isCarryOver ? (
                          <span className="text-xs">
                            Ya
                            {lt.carryOverMaxDays
                              ? ` (max ${lt.carryOverMaxDays})`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Tidak
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lt.isSystemType ? (
                          <Badge variant="outline" className="rounded-full text-xs">
                            Sistem
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Custom
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PermissionGate module="hr-leave" action="edit">
                          <Switch
                            checked={lt.isActive}
                            onCheckedChange={(checked) =>
                              handleToggleActive(lt, checked)
                            }
                          />
                        </PermissionGate>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PermissionGate module="hr-leave" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => handleOpenEdit(lt)}
                            >
                              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                          {!lt.isSystemType && (
                            <PermissionGate module="hr-leave" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(lt)}
                              >
                                <TrashBinTrash
                                  weight="BoldDuotone"
                                  className="h-3.5 w-3.5"
                                />
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

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? "Edit Jenis Cuti" : "Tambah Jenis Cuti"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Perbarui informasi jenis cuti."
                : "Tambahkan jenis cuti baru."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="lt-name">Nama *</Label>
                <Input
                  id="lt-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Contoh: Cuti Tahunan"
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lt-code">Code *</Label>
                <Input
                  id="lt-code"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="Contoh: annual"
                  className="rounded-xl font-mono"
                  disabled={editingItem?.isSystemType}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lt-desc">Deskripsi</Label>
              <Textarea
                id="lt-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Deskripsi jenis cuti..."
                className="rounded-xl"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="lt-quota">Kuota Default</Label>
                <Input
                  id="lt-quota"
                  type="number"
                  value={form.defaultQuota}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      defaultQuota: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="rounded-xl w-28"
                  min={0}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lt-min-notice">Min Notice (hari)</Label>
                <Input
                  id="lt-min-notice"
                  type="number"
                  value={form.minDaysBeforeRequest}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minDaysBeforeRequest:
                        parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="rounded-xl w-28"
                  min={0}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lt-max-days">Max Hari Berturut-turut</Label>
              <Input
                id="lt-max-days"
                type="number"
                value={form.maxConsecutiveDays}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxConsecutiveDays: e.target.value,
                  }))
                }
                placeholder="Kosongkan jika tidak dibatasi"
                className="rounded-xl w-40"
                min={1}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="lt-deductible"
                  checked={form.isDeductible}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isDeductible: checked }))
                  }
                />
                <Label htmlFor="lt-deductible">
                  Mengurangi Saldo (Deductible)
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="lt-approval"
                  checked={form.requiresApproval}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, requiresApproval: checked }))
                  }
                />
                <Label htmlFor="lt-approval">Memerlukan Approval</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="lt-carry-over"
                  checked={form.isCarryOver}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isCarryOver: checked }))
                  }
                />
                <Label htmlFor="lt-carry-over">Carry Over ke Tahun Berikutnya</Label>
              </div>
            </div>

            {form.isCarryOver && (
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
                <div className="grid gap-2">
                  <Label htmlFor="lt-co-max">Max Carry Over (hari)</Label>
                  <Input
                    id="lt-co-max"
                    type="number"
                    value={form.carryOverMaxDays}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        carryOverMaxDays: e.target.value,
                      }))
                    }
                    placeholder="Kosongkan untuk unlimited"
                    className="rounded-xl"
                    min={1}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lt-co-expiry">Expire (bulan)</Label>
                  <Input
                    id="lt-co-expiry"
                    type="number"
                    value={form.carryOverExpiryMonths}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        carryOverExpiryMonths: e.target.value,
                      }))
                    }
                    placeholder="Contoh: 3"
                    className="rounded-xl"
                    min={1}
                    max={12}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={handleCloseDialog}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              className="rounded-full"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving
                ? "Menyimpan..."
                : editingItem
                  ? "Simpan"
                  : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Hapus Jenis Cuti
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.isSystemType ? (
                <>
                  Jenis cuti <span className="font-semibold">{deleteTarget.name}</span>{" "}
                  adalah tipe sistem dan tidak bisa dihapus.
                  Nonaktifkan saja jika tidak diperlukan.
                </>
              ) : deleteTarget?._count && deleteTarget._count.requests > 0 ? (
                <>
                  Jenis cuti{" "}
                  <span className="font-semibold">{deleteTarget.name}</span>{" "}
                  memiliki {deleteTarget._count.requests} pengajuan. Tidak bisa
                  dihapus.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus jenis cuti{" "}
                  <span className="font-semibold">{deleteTarget?.name}</span>?
                  Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            {deleteTarget &&
              !deleteTarget.isSystemType &&
              (!deleteTarget._count || deleteTarget._count.requests === 0) && (
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={handleDeleteConfirm}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
