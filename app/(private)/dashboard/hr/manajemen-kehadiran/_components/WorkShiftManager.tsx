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
  useWorkShifts,
  useCreateWorkShift,
  useUpdateWorkShift,
  useDeleteWorkShift,
} from "@/hooks/use-work-shifts";
import {
  AddCircle,
  ClockCircle,
  Pen,
  TrashBinTrash,
  UsersGroupRounded,
} from "@solar-icons/react";
import type { WorkShiftItem } from "@/lib/queries/workShifts";

// ─── Form State ──────────────────────────────────────────────────────────────

interface ShiftFormState {
  name: string;
  startTime: string;
  endTime: string;
  lateToleranceMinutes: number;
  isOvernight: boolean;
}

const EMPTY_FORM: ShiftFormState = {
  name: "",
  startTime: "08:00",
  endTime: "17:00",
  lateToleranceMinutes: 15,
  isOvernight: false,
};

// ─── WorkShiftManager ────────────────────────────────────────────────────────

export function WorkShiftManager() {
  const { data: shifts, isLoading } = useWorkShifts();
  const createMutation = useCreateWorkShift();
  const updateMutation = useUpdateWorkShift();
  const deleteMutation = useDeleteWorkShift();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkShiftItem | null>(null);
  const [form, setForm] = useState<ShiftFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<WorkShiftItem | null>(null);

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: WorkShiftItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      startTime: item.startTime,
      endTime: item.endTime,
      lateToleranceMinutes: item.lateToleranceMinutes,
      isOvernight: item.isOvernight,
    });
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Nama shift wajib diisi");
      return;
    }

    const payload = {
      name: form.name.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
      lateToleranceMinutes: form.lateToleranceMinutes,
      isOvernight: form.isOvernight,
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Shift kerja berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui shift");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Shift kerja berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan shift");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      });
    }
  }, [form, editingItem, createMutation, updateMutation, handleCloseDialog]);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Shift kerja berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus shift");
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
            <CardTitle className="font-heading text-lg">Shift Kerja</CardTitle>
            <PermissionGate module="hr-attendance" action="create">
              <Button onClick={handleOpenCreate} className="rounded-full gap-1.5">
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Shift
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

          {!isLoading && (!shifts || shifts.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClockCircle weight="BoldDuotone" className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada shift kerja</p>
            </div>
          )}

          {!isLoading && shifts && shifts.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead>Toleransi (menit)</TableHead>
                    <TableHead>Overnight</TableHead>
                    <TableHead>Karyawan</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      <TableCell>{shift.startTime}</TableCell>
                      <TableCell>{shift.endTime}</TableCell>
                      <TableCell>{shift.lateToleranceMinutes}</TableCell>
                      <TableCell>
                        {shift.isOvernight ? (
                          <Badge variant="secondary" className="rounded-full text-xs">Ya</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Tidak</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-xs">
                          <UsersGroupRounded weight="BoldDuotone" className="mr-1 h-3 w-3" />
                          {shift._count.assignments}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PermissionGate module="hr-attendance" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => handleOpenEdit(shift)}
                            >
                              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="hr-attendance" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(shift)}
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
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
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? "Edit Shift Kerja" : "Tambah Shift Kerja"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Perbarui informasi shift kerja."
                : "Tambahkan shift kerja baru."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="shift-name">Nama Shift *</Label>
              <Input
                id="shift-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Shift Pagi"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="shift-start">Jam Mulai</Label>
                <Input
                  id="shift-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shift-end">Jam Selesai</Label>
                <Input
                  id="shift-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="shift-tolerance">Toleransi Terlambat (menit)</Label>
              <Input
                id="shift-tolerance"
                type="number"
                value={form.lateToleranceMinutes}
                onChange={(e) => setForm((f) => ({ ...f, lateToleranceMinutes: parseInt(e.target.value, 10) || 0 }))}
                className="rounded-xl w-32"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="shift-overnight"
                checked={form.isOvernight}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isOvernight: checked }))}
              />
              <Label htmlFor="shift-overnight">Shift Overnight (melewati tengah malam)</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={handleCloseDialog} disabled={isSaving}>
              Batal
            </Button>
            <Button className="rounded-full" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Shift Kerja</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget._count.assignments > 0 ? (
                <>
                  Shift <span className="font-semibold">{deleteTarget.name}</span> masih memiliki{" "}
                  {deleteTarget._count.assignments} karyawan yang di-assign. Hapus assignment terlebih
                  dahulu sebelum menghapus shift.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus shift{" "}
                  <span className="font-semibold">{deleteTarget?.name}</span>? Tindakan ini tidak
                  dapat dibatalkan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            {deleteTarget && deleteTarget._count.assignments === 0 && (
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
