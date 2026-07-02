"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from "@/hooks/use-departments";
import {
  AddCircle,
  AltArrowDown,
  AltArrowRight,
  Buildings3,
  Pen,
  TrashBinTrash,
  UsersGroupRounded,
} from "@solar-icons/react";
import { useEmployees } from "@/hooks/use-employees";
import type { DepartmentItem } from "@/lib/queries/departments";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Collect all descendant IDs of a department (for excluding self+descendants in parent select) */
function getDescendantIds(deptId: string, allDepts: DepartmentItem[]): Set<string> {
  const ids = new Set<string>();
  const stack = [deptId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    ids.add(current);
    for (const d of allDepts) {
      if (d.parentId === current && !ids.has(d.id)) {
        stack.push(d.id);
      }
    }
  }
  return ids;
}

// ─── Form State ──────────────────────────────────────────────────────────────

interface DeptFormState {
  name: string;
  description: string;
  parentId: string;
  headId: string;
  sortOrder: number;
}

const EMPTY_FORM: DeptFormState = {
  name: "",
  description: "",
  parentId: "",
  headId: "",
  sortOrder: 0,
};

// ─── DeptNode ────────────────────────────────────────────────────────────────

function DeptNode({
  dept,
  allDepts,
  level,
  expanded,
  toggleExpand,
  onEdit,
  onDelete,
}: {
  dept: DepartmentItem;
  allDepts: DepartmentItem[];
  level: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (dept: DepartmentItem) => void;
  onDelete: (dept: DepartmentItem) => void;
}) {
  const children = allDepts.filter((d) => d.parentId === dept.id);
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(dept.id);

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50"
        style={{ marginLeft: `${level * 24}px` }}
      >
        {/* Expand/Collapse toggle */}
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent"
          onClick={() => {
            if (hasChildren) {
              toggleExpand(dept.id);
            }
          }}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? (
              <AltArrowDown weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            ) : (
              <AltArrowRight weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="h-4 w-4" />
          )}
        </button>

        {/* Department info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Buildings3 weight="BoldDuotone" className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{dept.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {dept.head?.fullName ?? "Belum ditentukan"}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full text-xs">
            <UsersGroupRounded weight="BoldDuotone" className="mr-1 h-3 w-3" />
            {dept._count.profiles}
          </Badge>
          {hasChildren && (
            <Badge variant="outline" className="rounded-full text-xs">
              {dept._count.children} sub
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <PermissionGate module="hr-departments" action="edit">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => onEdit(dept)}
            >
              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
            </Button>
          </PermissionGate>
          <PermissionGate module="hr-departments" action="delete">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
              onClick={() => onDelete(dept)}
            >
              <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Recursively render children */}
      {isExpanded &&
        children
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((child) => (
            <DeptNode
              key={child.id}
              dept={child}
              allDepts={allDepts}
              level={level + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
    </div>
  );
}

// ─── DepartmentManager ───────────────────────────────────────────────────────

export function DepartmentManager() {
  const { data: departments, isLoading } = useDepartments();
  const { data: employeesData } = useEmployees({ limit: 200 });
  const employees = employeesData?.data ?? [];
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  // Tree expand state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [form, setForm] = useState<DeptFormState>(EMPTY_FORM);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<DepartmentItem | null>(null);

  // Build root departments
  const rootDepts = useMemo(() => {
    if (!departments) return [];
    return departments
      .filter((d) => d.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [departments]);

  // Available parent departments for the form (exclude self & descendants when editing)
  const availableParents = useMemo(() => {
    if (!departments) return [];
    if (!editingDept) return departments;
    const excluded = getDescendantIds(editingDept.id, departments);
    return departments.filter((d) => !excluded.has(d.id));
  }, [departments, editingDept]);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Open create dialog
  const handleOpenCreate = useCallback(() => {
    setEditingDept(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleOpenEdit = useCallback((dept: DepartmentItem) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      description: dept.description ?? "",
      parentId: dept.parentId ?? "",
      headId: dept.head?.id ?? "",
      sortOrder: dept.sortOrder,
    });
    setDialogOpen(true);
  }, []);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingDept(null);
    setForm(EMPTY_FORM);
  }, []);

  // Submit form
  const handleSubmit = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Nama departemen wajib diisi");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      parentId: form.parentId || undefined,
      headId: form.headId.trim() || undefined,
      sortOrder: form.sortOrder,
    };

    if (editingDept) {
      updateMutation.mutate(
        { id: editingDept.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Departemen berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui departemen");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Departemen berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan departemen");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      });
    }
  }, [form, editingDept, createMutation, updateMutation, handleCloseDialog]);

  // Delete confirm
  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Departemen berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus departemen");
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
            <CardTitle className="font-heading text-lg">Manajemen Departemen</CardTitle>
            <PermissionGate module="hr-departments" action="create">
              <Button onClick={handleOpenCreate} className="rounded-full gap-1.5">
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Departemen
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && (!departments || departments.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Buildings3
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada departemen
              </p>
            </div>
          )}

          {/* Tree */}
          {!isLoading && departments && departments.length > 0 && (
            <div className="space-y-0.5">
              {rootDepts.map((dept) => (
                <DeptNode
                  key={dept.id}
                  dept={dept}
                  allDepts={departments}
                  level={0}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                  onEdit={handleOpenEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Add/Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingDept ? "Edit Departemen" : "Tambah Departemen"}
            </DialogTitle>
            <DialogDescription>
              {editingDept
                ? "Perbarui informasi departemen."
                : "Tambahkan departemen baru ke organisasi."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="dept-name">Nama Departemen *</Label>
              <Input
                id="dept-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Human Resources"
                className="rounded-xl"
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="dept-desc">Deskripsi</Label>
              <Input
                id="dept-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi singkat departemen"
                className="rounded-xl"
              />
            </div>

            {/* Parent Department */}
            <div className="grid gap-2">
              <Label>Departemen Induk</Label>
              <Select
                value={form.parentId || "none"}
                onValueChange={(val) => setForm((f) => ({ ...f, parentId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tidak ada (root)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada (root)</SelectItem>
                  {availableParents.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kepala Departemen */}
            <div className="grid gap-2">
              <Label>Kepala Departemen</Label>
              <Select
                value={form.headId || "none"}
                onValueChange={(val) => setForm((f) => ({ ...f, headId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih kepala departemen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.fullName ?? emp.email} {emp.employeeNumber ? `(${emp.employeeNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="grid gap-2">
              <Label htmlFor="dept-sort">Urutan</Label>
              <Input
                id="dept-sort"
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
              {isSaving ? "Menyimpan..." : editingDept ? "Simpan" : "Tambah"}
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
            <DialogTitle className="font-heading">Hapus Departemen</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget._count.profiles > 0 ? (
                <>
                  Departemen <span className="font-semibold">{deleteTarget.name}</span> masih
                  memiliki {deleteTarget._count.profiles} karyawan. Pindahkan karyawan terlebih
                  dahulu sebelum menghapus departemen.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus departemen{" "}
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
