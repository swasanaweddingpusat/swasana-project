"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useShiftOverrides,
  useCreateShiftOverride,
  useUpdateShiftOverride,
  useDeleteShiftOverride,
} from "@/hooks/use-shift-overrides";
import { useWorkShifts } from "@/hooks/use-work-shifts";
import { useWorkLocations } from "@/hooks/use-work-locations";
import { useEmployees } from "@/hooks/use-employees";
import {
  AddCircle,
  CalendarMark,
  Pen,
  TrashBinTrash,
  AltArrowDown,
  CheckCircle,
} from "@solar-icons/react";
import type { ShiftOverrideItem } from "@/lib/queries/shiftOverrides";

// ─── Form State ──────────────────────────────────────────────────────────────

interface OverrideFormState {
  profileId: string;
  date: string;
  workShiftId: string;
  workLocationId: string;
  reason: string;
}

const EMPTY_FORM: OverrideFormState = {
  profileId: "",
  date: new Date().toISOString().slice(0, 10),
  workShiftId: "",
  workLocationId: "",
  reason: "",
};

function formatDateDisplay(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── ShiftOverrideManager ────────────────────────────────────────────────────

export function ShiftOverrideManager() {
  // Date range filter
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = useMemo(() => {
    const params: { startDate?: string; endDate?: string } = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  }, [startDate, endDate]);

  const { data: overrides, isLoading } = useShiftOverrides(queryParams);
  const { data: shifts } = useWorkShifts();
  const { data: locations } = useWorkLocations();
  const createMutation = useCreateShiftOverride();
  const updateMutation = useUpdateShiftOverride();
  const deleteMutation = useDeleteShiftOverride();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShiftOverrideItem | null>(null);
  const [form, setForm] = useState<OverrideFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ShiftOverrideItem | null>(null);
  const [empOpen, setEmpOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [empLabel, setEmpLabel] = useState("");

  const { data: empData } = useEmployees({ search: empSearch || undefined, limit: 20, status: "active" });
  const empList = empData?.data ?? [];

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setEmpLabel("");
    setEmpSearch("");
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: ShiftOverrideItem) => {
    setEditingItem(item);
    setForm({
      profileId: item.profileId,
      date: new Date(item.date).toISOString().slice(0, 10),
      workShiftId: item.workShiftId,
      workLocationId: item.workLocationId ?? "",
      reason: item.reason ?? "",
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
    if (!form.profileId || !form.date || !form.workShiftId) {
      toast.error("Karyawan, tanggal, dan shift wajib diisi");
      return;
    }

    const payload = {
      profileId: form.profileId,
      date: form.date,
      workShiftId: form.workShiftId,
      workLocationId: form.workLocationId || undefined,
      reason: form.reason.trim() || undefined,
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Override shift berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui override");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Override shift berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan override");
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
          toast.success("Override shift berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus override");
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
            <CardTitle className="font-heading text-lg">Override Shift</CardTitle>
            <PermissionGate module="hr-attendance" action="edit">
              <Button onClick={handleOpenCreate} className="rounded-full gap-1.5">
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Override
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent>
          {/* Date Range Filter */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Dari Tanggal</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl w-40"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Reset
              </Button>
            )}
          </div>

          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && (!overrides || overrides.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarMark weight="BoldDuotone" className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada override shift</p>
            </div>
          )}

          {!isLoading && overrides && overrides.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Dibuat Oleh</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map((ov) => (
                    <TableRow key={ov.id}>
                      <TableCell className="text-sm">{formatDateDisplay(ov.date)}</TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{ov.profile.fullName ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">{ov.profile.employeeNumber ?? "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{ov.workShift.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ov.workShift.startTime} - {ov.workShift.endTime}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{ov.workLocation?.name ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                        {ov.reason || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{ov.creator?.fullName ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PermissionGate module="hr-attendance" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => handleOpenEdit(ov)}
                            >
                              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="hr-attendance" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(ov)}
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
              {editingItem ? "Edit Override Shift" : "Tambah Override Shift"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Perbarui override shift karyawan."
                : "Tambahkan override shift untuk tanggal tertentu."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Karyawan *</Label>
              <Popover open={empOpen} onOpenChange={setEmpOpen}>
                <PopoverTrigger
                  role="combobox"
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
                        {empList.map((emp) => (
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
              <Label htmlFor="override-date">Tanggal *</Label>
              <Input
                id="override-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-xl"
              />
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

            <div className="grid gap-2">
              <Label>Lokasi Kerja (opsional)</Label>
              <Select
                value={form.workLocationId || "none"}
                onValueChange={(val) => setForm((f) => ({ ...f, workLocationId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih lokasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {locations?.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="override-reason">Alasan</Label>
              <Input
                id="override-reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Contoh: Ganti shift karena acara"
                className="rounded-xl"
              />
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
            <DialogTitle className="font-heading">Hapus Override Shift</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus override shift untuk{" "}
              <span className="font-semibold">{deleteTarget?.profile.fullName}</span> pada tanggal{" "}
              <span className="font-semibold">
                {deleteTarget ? formatDateDisplay(deleteTarget.date) : ""}
              </span>? Tindakan ini tidak dapat dibatalkan.
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
