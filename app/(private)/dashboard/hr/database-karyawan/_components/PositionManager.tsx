"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  usePositions,
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
} from "@/hooks/use-positions";
import { useDepartments } from "@/hooks/use-departments";
import {
  AddCircle,
  Pen,
  TrashBinTrash,
  UserRounded,
  UsersGroupRounded,
} from "@solar-icons/react";
import type { PositionItem } from "@/lib/queries/positions";

// ─── Form State ──────────────────────────────────────────────────────────────

interface PositionFormState {
  name: string;
  departmentId: string;
  level: number;
  sortOrder: number;
}

const EMPTY_FORM: PositionFormState = {
  name: "",
  departmentId: "",
  level: 0,
  sortOrder: 0,
};

// ─── PositionManager ─────────────────────────────────────────────────────────

export function PositionManager() {
  const [filterDeptId, setFilterDeptId] = useState<string | undefined>(undefined);
  const { data: positions, isLoading } = usePositions(filterDeptId);
  const { data: departments } = useDepartments();
  const createMutation = useCreatePosition();
  const updateMutation = useUpdatePosition();
  const deleteMutation = useDeletePosition();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<PositionItem | null>(null);
  const [form, setForm] = useState<PositionFormState>(EMPTY_FORM);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<PositionItem | null>(null);

  // Filtered positions (sorted by sortOrder)
  const sortedPositions = useMemo(() => {
    if (!positions) return [];
    return [...positions].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [positions]);

  // Open create dialog
  const handleOpenCreate = useCallback(() => {
    setEditingPos(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleOpenEdit = useCallback((pos: PositionItem) => {
    setEditingPos(pos);
    setForm({
      name: pos.name,
      departmentId: pos.departmentId ?? "",
      level: pos.level,
      sortOrder: pos.sortOrder,
    });
    setDialogOpen(true);
  }, []);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingPos(null);
    setForm(EMPTY_FORM);
  }, []);

  // Submit form
  const handleSubmit = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Nama posisi wajib diisi");
      return;
    }

    const payload = {
      name: form.name.trim(),
      departmentId: form.departmentId || undefined,
      level: form.level,
      sortOrder: form.sortOrder,
    };

    if (editingPos) {
      updateMutation.mutate(
        { id: editingPos.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Posisi berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui posisi");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Posisi berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan posisi");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      });
    }
  }, [form, editingPos, createMutation, updateMutation, handleCloseDialog]);

  // Delete confirm
  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Posisi berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus posisi");
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
            <CardTitle className="font-heading text-lg">Manajemen Posisi</CardTitle>
            <PermissionGate module="hr-positions" action="create">
              <Button onClick={handleOpenCreate} className="rounded-full gap-1.5">
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Posisi
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-3">
            <Label className="shrink-0 text-sm text-muted-foreground">Departemen:</Label>
            <Select
              value={filterDeptId ?? "all"}
              onValueChange={(val) => {
                if (val === "all") {
                  setFilterDeptId(undefined);
                } else {
                  setFilterDeptId(val);
                }
              }}
            >
              <SelectTrigger className="w-60 rounded-xl">
                <SelectValue placeholder="Semua Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Departemen</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && (!positions || positions.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserRounded
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada posisi
              </p>
            </div>
          )}

          {/* Table */}
          {!isLoading && positions && positions.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Posisi</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead className="w-24 text-center">Level</TableHead>
                    <TableHead className="w-28 text-center">Karyawan</TableHead>
                    <TableHead className="w-24 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPositions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {pos.department?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="rounded-full">
                          {pos.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="rounded-full">
                          <UsersGroupRounded
                            weight="BoldDuotone"
                            className="mr-1 h-3 w-3"
                          />
                          {pos._count.profiles}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <PermissionGate module="hr-positions" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handleOpenEdit(pos)}
                            >
                              <Pen weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="hr-positions" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(pos)}
                            >
                              <TrashBinTrash
                                weight="BoldDuotone"
                                className="h-4 w-4"
                              />
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

      {/* ─── Add/Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingPos ? "Edit Posisi" : "Tambah Posisi"}
            </DialogTitle>
            <DialogDescription>
              {editingPos
                ? "Perbarui informasi posisi."
                : "Tambahkan posisi baru ke organisasi."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="pos-name">Nama Posisi *</Label>
              <Input
                id="pos-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Software Engineer"
                className="rounded-xl"
              />
            </div>

            {/* Department */}
            <div className="grid gap-2">
              <Label>Departemen</Label>
              <Select
                value={form.departmentId || "none"}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, departmentId: val === "none" ? "" : val }))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tidak ditentukan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ditentukan</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level */}
            <div className="grid gap-2">
              <Label htmlFor="pos-level">Level</Label>
              <Input
                id="pos-level"
                type="number"
                value={form.level}
                onChange={(e) =>
                  setForm((f) => ({ ...f, level: parseInt(e.target.value, 10) || 0 }))
                }
                className="rounded-xl"
              />
            </div>

            {/* Sort Order */}
            <div className="grid gap-2">
              <Label htmlFor="pos-sort">Urutan</Label>
              <Input
                id="pos-sort"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))
                }
                className="rounded-xl"
              />
            </div>
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
              {isSaving ? "Menyimpan..." : editingPos ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ──────────────────────────────── */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Posisi</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget._count.profiles > 0 ? (
                <>
                  Posisi <span className="font-semibold">{deleteTarget.name}</span> masih
                  memiliki {deleteTarget._count.profiles} karyawan. Pindahkan karyawan terlebih
                  dahulu sebelum menghapus posisi.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus posisi{" "}
                  <span className="font-semibold">{deleteTarget?.name}</span>? Tindakan ini
                  tidak dapat dibatalkan.
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
            {deleteTarget && deleteTarget._count.profiles === 0 && (
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
