"use client";

import { useState, useCallback } from "react";
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
  useWorkLocations,
  useCreateWorkLocation,
  useUpdateWorkLocation,
  useDeleteWorkLocation,
} from "@/hooks/use-work-locations";
import { useVenues } from "@/hooks/use-venues";
import {
  AddCircle,
  MapPoint,
  Pen,
  TrashBinTrash,
  UsersGroupRounded,
} from "@solar-icons/react";
import type { WorkLocationItem } from "@/lib/queries/workLocations";

// ─── Form State ──────────────────────────────────────────────────────────────

interface LocationFormState {
  name: string;
  address: string;
  venueId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

const EMPTY_FORM: LocationFormState = {
  name: "",
  address: "",
  venueId: "",
  latitude: 0,
  longitude: 0,
  radiusMeters: 100,
};

// ─── WorkLocationManager ─────────────────────────────────────────────────────

export function WorkLocationManager() {
  const { data: locations, isLoading } = useWorkLocations();
  const { data: venuesData } = useVenues();
  const createMutation = useCreateWorkLocation();
  const updateMutation = useUpdateWorkLocation();
  const deleteMutation = useDeleteWorkLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkLocationItem | null>(null);
  const [form, setForm] = useState<LocationFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<WorkLocationItem | null>(null);

  const venues = venuesData ?? [];

  const handleOpenCreate = useCallback(() => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((item: WorkLocationItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      address: item.address ?? "",
      venueId: item.venueId ?? "",
      latitude: item.latitude ? Number(item.latitude) : 0,
      longitude: item.longitude ? Number(item.longitude) : 0,
      radiusMeters: item.radiusMeters ?? 100,
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
      toast.error("Nama lokasi wajib diisi");
      return;
    }

    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      venueId: form.venueId || undefined,
      latitude: form.latitude,
      longitude: form.longitude,
      radiusMeters: form.radiusMeters,
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: payload },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Lokasi kerja berhasil diperbarui");
              handleCloseDialog();
            } else {
              toast.error(result.error ?? "Gagal memperbarui lokasi");
            }
          },
          onError: () => toast.error("Terjadi kesalahan"),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Lokasi kerja berhasil ditambahkan");
            handleCloseDialog();
          } else {
            toast.error(result.error ?? "Gagal menambahkan lokasi");
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
          toast.success("Lokasi kerja berhasil dihapus");
        } else {
          toast.error(result.error ?? "Gagal menghapus lokasi");
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
            <CardTitle className="font-heading text-lg">Lokasi Kerja</CardTitle>
            <PermissionGate module="hr-attendance" action="create">
              <Button onClick={handleOpenCreate} className="rounded-full gap-1.5">
                <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                Tambah Lokasi
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

          {!isLoading && (!locations || locations.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MapPoint weight="BoldDuotone" className="h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada lokasi kerja</p>
            </div>
          )}

          {!isLoading && locations && locations.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Alamat</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Lat/Lng</TableHead>
                    <TableHead>Radius</TableHead>
                    <TableHead>Karyawan</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {loc.address || "-"}
                      </TableCell>
                      <TableCell>{loc.venue?.name ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {loc.latitude && loc.longitude
                          ? `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`
                          : "-"}
                      </TableCell>
                      <TableCell>{loc.radiusMeters}m</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-xs">
                          <UsersGroupRounded weight="BoldDuotone" className="mr-1 h-3 w-3" />
                          {loc._count.assignments}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <PermissionGate module="hr-attendance" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => handleOpenEdit(loc)}
                            >
                              <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="hr-attendance" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(loc)}
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
              {editingItem ? "Edit Lokasi Kerja" : "Tambah Lokasi Kerja"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Perbarui informasi lokasi kerja."
                : "Tambahkan lokasi kerja baru."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="loc-name">Nama Lokasi *</Label>
              <Input
                id="loc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Kantor Pusat"
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="loc-address">Alamat</Label>
              <Input
                id="loc-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Alamat lengkap"
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-2">
              <Label>Venue</Label>
              <Select
                value={form.venueId || "none"}
                onValueChange={(val) => setForm((f) => ({ ...f, venueId: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Pilih venue (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="loc-lat">Latitude (-90 s/d 90)</Label>
                <Input
                  id="loc-lat"
                  type="number"
                  step="any"
                  placeholder="cth: -6.2088"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loc-lng">Longitude (-180 s/d 180)</Label>
                <Input
                  id="loc-lng"
                  type="number"
                  step="any"
                  placeholder="cth: 106.8456"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Indonesia: latitude sekitar -6 s/d -8, longitude sekitar 95 s/d 141. Jangan tertukar.</p>

            <div className="grid gap-2">
              <Label htmlFor="loc-radius">Radius (meter)</Label>
              <Input
                id="loc-radius"
                type="number"
                value={form.radiusMeters}
                onChange={(e) => setForm((f) => ({ ...f, radiusMeters: parseInt(e.target.value, 10) || 100 }))}
                className="rounded-xl w-full sm:w-32"
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
            <DialogTitle className="font-heading">Hapus Lokasi Kerja</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget._count.assignments > 0 ? (
                <>
                  Lokasi <span className="font-semibold">{deleteTarget.name}</span> masih memiliki{" "}
                  {deleteTarget._count.assignments} karyawan yang di-assign. Hapus assignment terlebih
                  dahulu sebelum menghapus lokasi.
                </>
              ) : (
                <>
                  Apakah Anda yakin ingin menghapus lokasi{" "}
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
