"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddCircle, PenNewSquare, TrashBinTrash } from "@solar-icons/react";
import { createProspectStatus, updateProspectStatus, deleteProspectStatus } from "@/actions/prospect-status";
import { usePermissions } from "@/hooks/use-permissions";
import type { ProspectStatusesResult, ProspectStatusItem } from "@/lib/queries/prospect-status";
import { prospectStatusClass } from "@/lib/prospect-status";
import { cn } from "@/lib/utils";

interface Props {
  initialData: ProspectStatusesResult;
}

const MODULE = "settings-prospect-status";

export function ProspectStatusManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSort, setFormSort] = useState("0");
  const [editingItem, setEditingItem] = useState<ProspectStatusItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProspectStatusItem | null>(null);

  const canCreate = can(MODULE, "create") || isAdmin;
  const canEdit = can(MODULE, "edit") || isAdmin;
  const canDelete = can(MODULE, "delete") || isAdmin;

  function sortItems(list: ProspectStatusItem[]): ProspectStatusItem[] {
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    // Default ke kelipatan 10 setelah status terakhir, biar gampang disisipi.
    const nextSort = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 10 : 10;
    setFormSort(String(nextSort));
    setFormOpen(true);
  }

  function handleOpenEdit(item: ProspectStatusItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormSort(String(item.sortOrder));
    setFormOpen(true);
  }

  async function handleSave() {
    const name = formName.trim();
    if (!name) return;
    const sortOrder = Number(formSort);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      toast.error("Urutan harus berupa angka bulat.");
      return;
    }

    setSaving(true);
    const result = editingItem
      ? await updateProspectStatus(editingItem.id, name, sortOrder)
      : await createProspectStatus(name, sortOrder);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    if (editingItem) {
      setItems((prev) => sortItems(prev.map((i) => (i.id === editingItem.id ? { ...i, name, sortOrder } : i))));
      toast.success("Status diperbarui.");
    } else {
      setItems((prev) => sortItems([...prev, result.item as ProspectStatusItem]));
      toast.success("Status ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteProspectStatus(deleteTarget.id);
    if (!result.success) {
      toast.error(result.error);
      setDeleteTarget(null);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Status dihapus.");
    setDeleteTarget(null);
  }

  return (
    <>
      <div className={cn('px-2', 'sm:px-6', 'pb-6')}>
        <Card>
          <CardContent className="p-0">
            <div className={cn('flex', 'flex-col', 'sm:flex-row', 'items-start', 'sm:items-center', 'justify-between', 'px-4', 'sm:px-6', 'pb-4', 'gap-3', 'border-b')}>
              <div>
                <div className={cn('flex', 'items-center', 'gap-2')}>
                  <h2 className={cn('text-base', 'font-bold', 'text-foreground')}>Status Prospek</h2>
                  <span className={cn('text-sm', 'text-muted-foreground')}>({items.length})</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dipakai di Guestbook. Urutan kecil tampil lebih dulu.
                </p>
              </div>
              {canCreate && (
                <Button onClick={handleOpenAdd} className={cn('cursor-pointer')}>
                  <AddCircle weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-2')} /> Tambah
                </Button>
              )}
            </div>

            {/* Mobile: card list (<sm) */}
            <div className="block sm:hidden px-3 py-2 space-y-2">
              {items.length === 0 ? (
                <div className={cn('text-center', 'py-8', 'text-muted-foreground', 'text-sm')}>Belum ada data.</div>
              ) : (
                items.map((item) => (
                  <Card key={item.id} className="rounded-lg border bg-card shadow-none">
                    <CardContent className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Badge variant="outline" className={cn('rounded-full', prospectStatusClass(item.name))}>
                          {item.name}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Urutan {item.sortOrder}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <button onClick={() => handleOpenEdit(item)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Edit">
                            <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeleteTarget(item)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Hapus">
                            <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop/tablet: table (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={cn('w-12', 'px-4', 'sm:px-6')}>#</TableHead>
                    <TableHead>Nama Status</TableHead>
                    <TableHead className="w-24">Urutan</TableHead>
                    <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className={cn('text-center', 'py-8', 'text-muted-foreground')}>Belum ada data.</TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className={cn('px-4', 'sm:px-6', 'text-muted-foreground')}>{idx + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('rounded-full', prospectStatusClass(item.name))}>
                            {item.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">{item.sortOrder}</TableCell>
                        <TableCell>
                          <div className={cn('flex', 'items-center', 'gap-1', 'justify-end', 'pr-2')}>
                            {canEdit && (
                              <button onClick={() => handleOpenEdit(item)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Edit">
                                <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => setDeleteTarget(item)} className={cn('p-1.5', 'rounded-md', 'hover:bg-muted', 'cursor-pointer')} aria-label="Hapus">
                                <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Status Prospek</DialogTitle>
          <div className={cn('space-y-4', 'pt-2')}>
            <div className="space-y-2">
              <Label htmlFor="prospect-status-name">Nama Status</Label>
              <Input
                id="prospect-status-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Follow Up"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prospect-status-sort">Urutan Tampil</Label>
              <Input
                id="prospect-status-sort"
                type="number"
                min={0}
                value={formSort}
                onChange={(e) => setFormSort(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
              <p className="text-xs text-muted-foreground">Angka lebih kecil tampil lebih dulu.</p>
            </div>
            <div className={cn('flex', 'gap-3')}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn('flex-1', 'cursor-pointer')}>Batal</Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim()} className={cn('flex-1', 'cursor-pointer')}>
                {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Status Prospek</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Status yang masih dipakai entry guestbook tidak bisa dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
