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
  useSalaryComponents,
  useCreateSalaryComponent,
  useUpdateSalaryComponent,
  useDeleteSalaryComponent,
} from "@/hooks/use-salary-components";
import { AddCircle, Pen, TrashBinTrash, Wallet } from "@solar-icons/react";
import type { SalaryComponentAdminItem } from "@/lib/queries/salaryComponents";

// ─── Form State ─────────────────────────────────────────────────────────────

interface ComponentFormState {
  name: string;
  code: string;
  type: "earning" | "deduction";
  category: "basic" | "allowance" | "deduction" | "benefit";
  isFixed: boolean;
  isTaxable: boolean;
}

const EMPTY_FORM: ComponentFormState = {
  name: "",
  code: "",
  type: "earning",
  category: "basic",
  isFixed: true,
  isTaxable: true,
};

function formFromItem(item: SalaryComponentAdminItem): ComponentFormState {
  return {
    name: item.name,
    code: item.code,
    type: item.type as "earning" | "deduction",
    category: item.category as "basic" | "allowance" | "deduction" | "benefit",
    isFixed: item.isFixed,
    isTaxable: item.isTaxable,
  };
}

const TYPE_OPTIONS = [
  { value: "earning", label: "Earning" },
  { value: "deduction", label: "Deduction" },
];

const CATEGORY_OPTIONS = [
  { value: "basic", label: "Basic" },
  { value: "allowance", label: "Allowance" },
  { value: "deduction", label: "Deduction" },
  { value: "benefit", label: "Benefit" },
];

function typeBadge(type: string): React.ReactNode {
  const variant = type === "earning" ? "default" : "destructive";
  return (
    <Badge variant={variant} className="rounded-full text-xs capitalize">
      {type}
    </Badge>
  );
}

function categoryBadge(category: string): React.ReactNode {
  return (
    <Badge variant="secondary" className="rounded-full text-xs capitalize">
      {category}
    </Badge>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SalaryComponentManager() {
  const { data: components, isLoading } = useSalaryComponents();
  const createMutation = useCreateSalaryComponent();
  const updateMutation = useUpdateSalaryComponent();
  const deleteMutation = useDeleteSalaryComponent();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SalaryComponentAdminItem | null>(null);
  const [form, setForm] = useState<ComponentFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<SalaryComponentAdminItem | null>(null);

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: SalaryComponentAdminItem) => {
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
      toast.error("Nama komponen wajib diisi");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Code wajib diisi");
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      category: form.category,
      isFixed: form.isFixed,
      isTaxable: form.isTaxable,
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Komponen gaji berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui komponen gaji");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Komponen gaji berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan komponen gaji");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      });
    }
  }, [form, editingItem, createMutation, updateMutation, handleCloseDialog]);

  const handleToggleActive = useCallback(
    (item: SalaryComponentAdminItem, isActive: boolean) => {
      updateMutation.mutate(
        { id: item.id, data: { isActive } },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success(isActive ? "Komponen diaktifkan" : "Komponen dinonaktifkan");
            } else {
              toast.error(result.error ?? "Gagal mengubah status");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        },
      );
    },
    [updateMutation],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Komponen gaji berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus komponen gaji");
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
            <CardTitle className="font-heading text-lg">Komponen Gaji</CardTitle>
            <PermissionGate module="hr-payroll" action="create">
              <Button
                onClick={handleOpenCreate}
                className="rounded-full gap-1.5"
              >
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Komponen
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

          {!isLoading && (!components || components.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wallet
                weight="BoldDuotone"
                className="h-12 w-12 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada komponen gaji
              </p>
            </div>
          )}

          {!isLoading && components && components.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Kena Pajak</TableHead>
                    <TableHead>Tetap</TableHead>
                    <TableHead>Sistem</TableHead>
                    <TableHead>Aktif</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-xs font-mono">
                          {comp.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{typeBadge(comp.type)}</TableCell>
                      <TableCell>{categoryBadge(comp.category)}</TableCell>
                      <TableCell>
                        {comp.isTaxable ? (
                          <span className="text-sm">Ya</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Tidak</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {comp.isFixed ? (
                          <span className="text-sm">Ya</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Tidak</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {comp.isSystemType ? (
                          <Badge variant="outline" className="rounded-full text-xs">
                            Sistem
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Custom</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PermissionGate module="hr-payroll" action="edit">
                          <Switch
                            checked={comp.isActive}
                            onCheckedChange={(checked) =>
                              handleToggleActive(comp, checked)
                            }
                          />
                        </PermissionGate>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PermissionGate module="hr-payroll" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => handleOpenEdit(comp)}
                            >
                              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                          {!comp.isSystemType && (
                            <PermissionGate module="hr-payroll" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(comp)}
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

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? "Edit Komponen Gaji" : "Tambah Komponen Gaji"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Perbarui informasi komponen gaji."
                : "Tambahkan komponen gaji baru."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sc-name">Nama *</Label>
                <Input
                  id="sc-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: Gaji Pokok"
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sc-code">Code *</Label>
                <Input
                  id="sc-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Contoh: basic_salary"
                  className="rounded-xl font-mono"
                  disabled={editingItem?.isSystemType === true}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sc-type">Tipe *</Label>
                <Select
                  value={form.type}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, type: val as "earning" | "deduction" }))
                  }
                >
                  <SelectTrigger id="sc-type" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sc-category">Kategori *</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      category: val as "basic" | "allowance" | "deduction" | "benefit",
                    }))
                  }
                >
                  <SelectTrigger id="sc-category" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="sc-fixed"
                  checked={form.isFixed}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isFixed: checked }))
                  }
                />
                <Label htmlFor="sc-fixed">Komponen Tetap</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="sc-taxable"
                  checked={form.isTaxable}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isTaxable: checked }))
                  }
                />
                <Label htmlFor="sc-taxable">Kena Pajak</Label>
              </div>
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
            <DialogTitle className="font-heading">Hapus Komponen Gaji</DialogTitle>
            <DialogDescription>
              {deleteTarget?.isSystemType ? (
                <>
                  Komponen <span className="font-semibold">{deleteTarget.name}</span>{" "}
                  adalah tipe sistem dan tidak bisa dihapus. Nonaktifkan saja jika tidak diperlukan.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus komponen{" "}
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
            {deleteTarget && !deleteTarget.isSystemType && (
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
