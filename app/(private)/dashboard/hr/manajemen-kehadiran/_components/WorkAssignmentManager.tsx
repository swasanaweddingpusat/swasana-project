"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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
  useWorkAssignments,
  useCreateWorkAssignment,
  useUpdateWorkAssignment,
  useDeleteWorkAssignment,
  useBulkCreateWorkAssignment,
} from "@/hooks/use-work-assignments";
import { useWorkLocations } from "@/hooks/use-work-locations";
import { useWorkShifts } from "@/hooks/use-work-shifts";
import { useEmployees } from "@/hooks/use-employees";
import {
  AddCircle,
  UsersGroupRounded,
  Pen,
  TrashBinTrash,
  UserPlus,
  AltArrowDown,
  CheckCircle,
} from "@solar-icons/react";
import type { WorkAssignmentItem } from "@/lib/queries/workAssignments";

// ─── Form State ──────────────────────────────────────────────────────────────

interface AssignmentFormState {
  profileId: string;
  workLocationId: string;
  workShiftId: string;
  isDefault: boolean;
  effectiveDate: string;
  endDate: string;
}

const EMPTY_FORM: AssignmentFormState = {
  profileId: "",
  workLocationId: "",
  workShiftId: "",
  isDefault: true,
  effectiveDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

interface BulkFormState {
  selectedProfileIds: Set<string>;
  workLocationId: string;
  workShiftId: string;
  isDefault: boolean;
  effectiveDate: string;
  endDate: string;
}

const EMPTY_BULK: BulkFormState = {
  selectedProfileIds: new Set(),
  workLocationId: "",
  workShiftId: "",
  isDefault: true,
  effectiveDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

function formatDateShort(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ─── WorkAssignmentManager ───────────────────────────────────────────────────

export function WorkAssignmentManager() {
  // Filters
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterShift, setFilterShift] = useState<string>("");

  const queryParams = useMemo(() => {
    const params: { workLocationId?: string; workShiftId?: string } = {};
    if (filterLocation) params.workLocationId = filterLocation;
    if (filterShift) params.workShiftId = filterShift;
    return params;
  }, [filterLocation, filterShift]);

  const { data: assignments, isLoading } = useWorkAssignments(queryParams);
  const { data: locations } = useWorkLocations();
  const { data: shifts } = useWorkShifts();
  const createMutation = useCreateWorkAssignment();
  const updateMutation = useUpdateWorkAssignment();
  const deleteMutation = useDeleteWorkAssignment();
  const bulkMutation = useBulkCreateWorkAssignment();

  // Single assignment dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkAssignmentItem | null>(null);
  const [form, setForm] = useState<AssignmentFormState>(EMPTY_FORM);
  const [empOpen, setEmpOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [empLabel, setEmpLabel] = useState("");

  // Bulk dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkFormState>(EMPTY_BULK);
  const [bulkEmpSearch, setBulkEmpSearch] = useState("");

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<WorkAssignmentItem | null>(null);

  const { data: empDialogData } = useEmployees({ search: empSearch || undefined, limit: 20, status: "active" });
  const { data: bulkEmpData } = useEmployees({ search: bulkEmpSearch || undefined, limit: 50, status: "active" });
  const empDialogList = empDialogData?.data ?? [];
  const bulkEmpList = bulkEmpData?.data ?? [];

  // ─── Single Assignment Handlers ────────────────────────────────────────────

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setEmpLabel("");
    setEmpSearch("");
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: WorkAssignmentItem) => {
    setEditingItem(item);
    setForm({
      profileId: item.profileId,
      workLocationId: item.workLocationId,
      workShiftId: item.workShiftId,
      isDefault: item.isDefault,
      effectiveDate: item.effectiveDate
        ? new Date(item.effectiveDate).toISOString().slice(0, 10)
        : "",
      endDate: item.endDate
        ? new Date(item.endDate).toISOString().slice(0, 10)
        : "",
    });
    setEmpLabel(item.profile.fullName ?? "");
    setEmpSearch("");
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setEmpLabel("");
    setEmpSearch("");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.profileId || !form.workLocationId || !form.workShiftId) {
      toast.error("Karyawan, lokasi, dan shift wajib dipilih");
      return;
    }

    const payload = {
      profileId: form.profileId,
      workLocationId: form.workLocationId,
      workShiftId: form.workShiftId,
      isDefault: form.isDefault,
      effectiveDate: form.effectiveDate || undefined,
      endDate: form.endDate || undefined,
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Assignment berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui assignment");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Assignment berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan assignment");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      });
    }
  }, [form, editingItem, createMutation, updateMutation, handleCloseDialog]);

  // ─── Bulk Handlers ─────────────────────────────────────────────────────────

  const handleOpenBulk = useCallback(() => {
    setBulkForm(EMPTY_BULK);
    setBulkEmpSearch("");
    setBulkOpen(true);
  }, []);

  const handleCloseBulk = useCallback(() => {
    setBulkOpen(false);
    setBulkForm(EMPTY_BULK);
    setBulkEmpSearch("");
  }, []);

  const toggleBulkEmployee = useCallback((profileId: string) => {
    setBulkForm((prev) => {
      const next = new Set(prev.selectedProfileIds);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return { ...prev, selectedProfileIds: next };
    });
  }, []);

  const handleBulkSubmit = useCallback(() => {
    if (bulkForm.selectedProfileIds.size === 0) {
      toast.error("Pilih minimal 1 karyawan");
      return;
    }
    if (!bulkForm.workLocationId || !bulkForm.workShiftId) {
      toast.error("Lokasi dan shift wajib dipilih");
      return;
    }

    bulkMutation.mutate(
      {
        profileIds: Array.from(bulkForm.selectedProfileIds),
        workLocationId: bulkForm.workLocationId,
        workShiftId: bulkForm.workShiftId,
        isDefault: bulkForm.isDefault,
        effectiveDate: bulkForm.effectiveDate || undefined,
        endDate: bulkForm.endDate || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success(`${bulkForm.selectedProfileIds.size} assignment berhasil dibuat`);
            handleCloseBulk();
          } else {
            toast.error(result.error ?? "Gagal membuat bulk assignment");
          }
        },
        onError: () => toast.error("Terjadi kesalahan"),
      }
    );
  }, [bulkForm, bulkMutation, handleCloseBulk]);

  // ─── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Assignment berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus assignment");
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="font-heading text-lg">Assignment Karyawan</CardTitle>
            <div className="flex items-center gap-2">
              <PermissionGate module="hr-attendance" action="create">
                <Button onClick={handleOpenBulk} variant="outline" className="rounded-full gap-1.5">
                  <UserPlus weight="BoldDuotone" className="h-4 w-4" />
                  Bulk Assign
                </Button>
              </PermissionGate>
              <PermissionGate module="hr-attendance" action="create">
                <Button onClick={handleOpenCreate} className="rounded-full gap-1.5">
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah Assignment
                </Button>
              </PermissionGate>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Lokasi</label>
              <Select
                value={filterLocation || "all"}
                onValueChange={(v) => setFilterLocation(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-44 rounded-xl">
                  <SelectValue placeholder="Semua Lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Lokasi</SelectItem>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Shift</label>
              <Select
                value={filterShift || "all"}
                onValueChange={(v) => setFilterShift(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-44 rounded-xl">
                  <SelectValue placeholder="Semua Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Shift</SelectItem>
                  {shifts?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && (!assignments || assignments.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UsersGroupRounded weight="BoldDuotone" className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada assignment karyawan</p>
            </div>
          )}

          {!isLoading && assignments && assignments.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Berlaku Mulai</TableHead>
                    <TableHead>Berlaku Sampai</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((asgn) => (
                    <TableRow key={asgn.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                            {asgn.profile.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{asgn.profile.fullName ?? "-"}</p>
                            <p className="text-xs text-muted-foreground">{asgn.profile.employeeNumber ?? "-"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{asgn.workLocation.name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{asgn.workShift.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {asgn.workShift.startTime} - {asgn.workShift.endTime}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {asgn.isDefault ? (
                          <Badge variant="default" className="rounded-full text-xs">Default</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDateShort(asgn.effectiveDate)}</TableCell>
                      <TableCell className="text-sm">{formatDateShort(asgn.endDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PermissionGate module="hr-attendance" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => handleOpenEdit(asgn)}
                            >
                              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="hr-attendance" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(asgn)}
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

      {/* Single Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? "Edit Assignment" : "Tambah Assignment"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Perbarui assignment karyawan."
                : "Tambahkan assignment baru."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Karyawan *</Label>
              <Popover open={empOpen && !editingItem} onOpenChange={(o) => { if (!editingItem) setEmpOpen(o); }}>
                <PopoverTrigger
                  role="combobox"
                  disabled={editingItem !== null}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-xl justify-between font-normal")}
                >
                  <span className={cn("truncate", !form.profileId && "text-muted-foreground")}>
                    {form.profileId ? (empLabel || "Karyawan dipilih") : "Pilih karyawan"}
                  </span>
                  <AltArrowDown weight="BoldDuotone" className="h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Cari karyawan..." value={empSearch} onValueChange={setEmpSearch} />
                    <CommandList>
                      <CommandEmpty>Karyawan tidak ditemukan</CommandEmpty>
                      <CommandGroup>
                        {empDialogList.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={emp.id}
                            onSelect={(val) => {
                              setForm((f) => ({ ...f, profileId: val }));
                              setEmpLabel(emp.fullName ?? emp.email ?? "");
                              setEmpOpen(false);
                            }}
                          >
                            <CheckCircle weight="BoldDuotone" className={cn("mr-2 h-4 w-4", form.profileId === emp.id ? "opacity-100" : "opacity-0")} />
                            <span>{emp.fullName}</span>
                            {emp.employeeNumber && <span className="ml-1 text-xs text-muted-foreground">({emp.employeeNumber})</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Lokasi Kerja *</Label>
              <Select
                value={form.workLocationId || "none"}
                onValueChange={(val) => setForm((f) => ({ ...f, workLocationId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih lokasi</SelectItem>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Shift Kerja *</Label>
              <Select
                value={form.workShiftId || "none"}
                onValueChange={(val) => setForm((f) => ({ ...f, workShiftId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih shift</SelectItem>
                  {shifts?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="assign-default"
                checked={form.isDefault}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isDefault: checked === true }))}
              />
              <Label htmlFor="assign-default">Assignment Default</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="assign-start">Berlaku Mulai</Label>
                <Input
                  id="assign-start"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="assign-end">Berlaku Sampai</Label>
                <Input
                  id="assign-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
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

      {/* Bulk Assignment Dialog */}
      <Dialog open={bulkOpen} onOpenChange={(open) => { if (!open) handleCloseBulk(); }}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Bulk Assignment</DialogTitle>
            <DialogDescription>
              Assign beberapa karyawan sekaligus ke lokasi dan shift yang sama.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Pilih Karyawan * ({bulkForm.selectedProfileIds.size} terpilih)</Label>
              <Input
                placeholder="Cari karyawan..."
                value={bulkEmpSearch}
                onChange={(e) => setBulkEmpSearch(e.target.value)}
                className="rounded-xl"
              />
              <div className="max-h-48 overflow-y-auto rounded-xl border p-2 space-y-1">
                {bulkEmpList.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-3">Karyawan tidak ditemukan</p>
                )}
                {bulkEmpList.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={bulkForm.selectedProfileIds.has(emp.id)}
                      onCheckedChange={() => toggleBulkEmployee(emp.id)}
                    />
                    <span className="text-sm">
                      {emp.fullName} {emp.employeeNumber ? `(${emp.employeeNumber})` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Lokasi Kerja *</Label>
              <Select
                value={bulkForm.workLocationId || "none"}
                onValueChange={(val) => setBulkForm((f) => ({ ...f, workLocationId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih lokasi</SelectItem>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Shift Kerja *</Label>
              <Select
                value={bulkForm.workShiftId || "none"}
                onValueChange={(val) => setBulkForm((f) => ({ ...f, workShiftId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih shift</SelectItem>
                  {shifts?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="bulk-default"
                checked={bulkForm.isDefault}
                onCheckedChange={(checked) => setBulkForm((f) => ({ ...f, isDefault: checked === true }))}
              />
              <Label htmlFor="bulk-default">Assignment Default</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-start">Berlaku Mulai</Label>
                <Input
                  id="bulk-start"
                  type="date"
                  value={bulkForm.effectiveDate}
                  onChange={(e) => setBulkForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-end">Berlaku Sampai</Label>
                <Input
                  id="bulk-end"
                  type="date"
                  value={bulkForm.endDate}
                  onChange={(e) => setBulkForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={handleCloseBulk} disabled={bulkMutation.isPending}>
              Batal
            </Button>
            <Button className="rounded-full" onClick={handleBulkSubmit} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? "Menyimpan..." : `Assign ${bulkForm.selectedProfileIds.size} Karyawan`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Assignment</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus assignment{" "}
              <span className="font-semibold">{deleteTarget?.profile.fullName}</span> dari{" "}
              <span className="font-semibold">{deleteTarget?.workLocation.name}</span>?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
