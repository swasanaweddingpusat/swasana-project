"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddCircle, PenNewSquare, TrashBinTrash, Refresh } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { createEventType, updateEventType, deleteEventType } from "@/actions/event-type";
import { usePermissions } from "@/hooks/use-permissions";
import type { EventTypesResult, EventTypeItem } from "@/lib/queries/event-types";
import { cn } from "@/lib/utils";

interface Props {
  initialData: EventTypesResult;
}

const ROWS_PER_PAGE = 10;

export function EventTypeManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [editingItem, setEditingItem] = useState<EventTypeItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventTypeItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Sort descending by createdAt
  const sortedItems = useMemo(() =>
    [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/event-types");
      if (res.ok) {
        const data = await res.json() as EventTypesResult;
        setItems(data);
        toast.success("Data diperbarui.");
      } else {
        toast.error("Gagal memuat ulang data.");
      }
    } catch {
      toast.error("Gagal memuat ulang data.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const totalPages = Math.ceil(sortedItems.length / ROWS_PER_PAGE);
  const paginatedItems = sortedItems.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormCode("");
    setFormOpen(true);
  }

  function handleOpenEdit(item: EventTypeItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCode.trim()) return;
    setSaving(true);
    const payload = { name: formName.trim(), code: formCode.trim() };
    const result = editingItem
      ? await updateEventType(editingItem.id, payload)
      : await createEventType(payload);

    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }

    if (editingItem) {
      setItems((prev) => prev.map((i) => i.id === editingItem.id ? { ...i, name: payload.name, code: payload.code.toUpperCase() } : i));
      toast.success("Berhasil diperbarui.");
    } else {
      const newItem = result.item as EventTypeItem;
      setItems((prev) => [...prev, newItem]);
      toast.success("Berhasil ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteEventType(deleteTarget.id);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <Card>
          <CardContent className="p-0">
            <div className={cn("flex", "flex-col", "sm:flex-row", "items-start", "sm:items-center", "justify-between", "px-4", "sm:px-6", "pb-4", "gap-3", "border-b")}>
              <div className={cn("flex", "items-center", "gap-2")}>
                <h2 className={cn("text-base", "font-bold", "text-foreground")}>Event Types</h2>
                <span className={cn("text-sm", "text-muted-foreground")}>({items.length})</span>
              </div>
              <div className={cn("flex", "items-center", "gap-2")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={cn("h-9", "w-9", "p-0", "cursor-pointer")}
                  aria-label="Refresh"
                >
                  <Refresh weight="BoldDuotone" className={cn("w-4", "h-4", refreshing && "animate-spin")} />
                </Button>
                {(can("settings-event-types", "create") || isAdmin) && (
                  <Button onClick={handleOpenAdd} className={cn("cursor-pointer")}>
                    <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-2")} /> Tambah
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile: card list (<sm) */}
            <div className="block sm:hidden px-3 py-2 space-y-2">
              {paginatedItems.length === 0 ? (
                <div className={cn("text-center", "py-8", "text-muted-foreground", "text-sm")}>Belum ada data.</div>
              ) : (
                paginatedItems.map((item, idx) => (
                  <Card key={item.id} className="rounded-lg border bg-card shadow-none">
                    <CardContent className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}. {item.name}
                        </p>
                        <span className={cn("inline-flex", "items-center", "rounded-md", "bg-secondary", "px-2", "py-0.5", "text-xs", "font-mono", "font-medium", "shrink-0")}>
                          {item.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(can("settings-event-types", "edit") || isAdmin) && (
                          <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                            <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                          </button>
                        )}
                        {(can("settings-event-types", "delete") || isAdmin) && (
                          <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                            <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
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
                    <TableHead className={cn("w-12", "px-4", "sm:px-6")}>#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-28">Kode PO</TableHead>
                    <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className={cn("text-center", "py-8", "text-muted-foreground")}>
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className={cn("px-4", "sm:px-6", "text-muted-foreground")}>
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <span className={cn("inline-flex", "items-center", "rounded-md", "bg-secondary", "px-2", "py-0.5", "text-xs", "font-mono", "font-medium")}>
                            {item.code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className={cn("flex", "items-center", "gap-1", "justify-end", "pr-2")}>
                            {(can("settings-event-types", "edit") || isAdmin) && (
                              <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                                <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                              </button>
                            )}
                            {(can("settings-event-types", "delete") || isAdmin) && (
                              <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                                <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
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

            {totalPages > 1 && (
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                label="Navigasi halaman event type"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Event Type</DialogTitle>
          <div className={cn("space-y-4", "pt-2")}>
            <div className="space-y-1.5">
              <Label>Nama</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Akad & Resepsi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kode PO</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="Contoh: AR"
                maxLength={10}
                className="font-mono uppercase"
              />
              <p className={cn("text-xs", "text-muted-foreground")}>Kode ini akan dipakai di nomor PO.</p>
            </div>
            <div className={cn("flex", "gap-3")}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn("flex-1", "cursor-pointer")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim() || !formCode.trim()} className={cn("flex-1", "cursor-pointer")}>
                {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Event Type</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn("bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90")}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
