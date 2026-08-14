"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddCircle, PenNewSquare, TrashBinTrash, Refresh, Magnifer } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { createComplimentary, updateComplimentary, deleteComplimentary } from "@/actions/complimentary";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import type { ComplimentariesResult, ComplimentaryItem } from "@/lib/queries/complimentary";

interface Props {
  initialData: ComplimentariesResult;
}

const ROWS_PER_PAGE = 10;

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function ComplimentaryManager({ initialData }: Props) {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplimentaryItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formDescription, setFormDescription] = useState("");
  const [formIsShowPrice, setFormIsShowPrice] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ComplimentaryItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/complimentaries?activeOnly=false");
      if (res.ok) {
        const data = await res.json() as { items: ComplimentariesResult };
        setItems(data.items);
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

  const filteredItems = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;
  const totalPages = Math.ceil(filteredItems.length / ROWS_PER_PAGE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleOpenAdd() {
    setEditingItem(null);
    setFormName("");
    setFormPrice(0);
    setFormDescription("");
    setFormIsShowPrice(false);
    setFormIsActive(true);
    setFormOpen(true);
  }

  function handleOpenEdit(item: ComplimentaryItem) {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.price);
    setFormDescription(item.description ?? "");
    setFormIsShowPrice(item.isShowPrice);
    setFormIsActive(item.isActive);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    const input = {
      name: formName.trim(),
      price: formPrice,
      description: formDescription.trim() || null,
      isShowPrice: formIsShowPrice,
      isActive: formIsActive,
    };

    const result = editingItem
      ? await updateComplimentary(editingItem.id, input)
      : await createComplimentary(input);

    setSaving(false);
    if (!result.success) { toast.error(result.error); return; }

    if (editingItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? { ...i, name: input.name, price: input.price, description: input.description ?? null, isShowPrice: input.isShowPrice, isActive: input.isActive }
            : i
        )
      );
      toast.success("Berhasil diperbarui.");
    } else {
      const newItem = result.item as ComplimentaryItem;
      setItems((prev) => [{ ...newItem, isActive: input.isActive, createdAt: new Date() }, ...prev]);
      toast.success("Berhasil ditambahkan.");
    }
    setFormOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteComplimentary(deleteTarget.id);
    if (!result.success) { toast.error(result.error); setDeleteTarget(null); return; }
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    toast.success("Berhasil dihapus.");
    setDeleteTarget(null);
  }

  return (
    <>
      <div className={cn("px-2", "sm:px-6", "pb-6")}>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-0">
            {/* Header */}
            <div className={cn("flex", "flex-col", "sm:flex-row", "items-start", "sm:items-center", "justify-between", "px-4", "sm:px-6", "py-4", "gap-3", "border-b")}>
              <div className={cn("flex", "items-center", "gap-2")}>
                <h2 className={cn("text-base", "font-bold", "text-foreground")}>Complimentary</h2>
                <span className={cn("text-sm", "text-muted-foreground")}>({filteredItems.length})</span>
              </div>
              <div className={cn("flex", "items-center", "gap-2")}>
                <div className="relative">
                  <Magnifer weight="BoldDuotone" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    placeholder="Cari nama..."
                    className="pl-8 h-9 w-48 rounded-xl"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={cn("h-9", "w-9", "p-0", "cursor-pointer", "rounded-xl")}
                  aria-label="Refresh"
                >
                  <Refresh weight="BoldDuotone" className={cn("w-4", "h-4", refreshing && "animate-spin")} />
                </Button>
                {(can("complimentary", "create") || isAdmin) && (
                  <Button onClick={handleOpenAdd} className={cn("cursor-pointer", "rounded-xl")}>
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
                paginatedItems.map((item) => (
                  <Card key={item.id} className="rounded-xl border bg-card shadow-none">
                    <CardContent className="px-3 py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {!item.isActive && <Badge variant="secondary" className="text-xs">Nonaktif</Badge>}
                          {(can("complimentary", "edit") || isAdmin) && (
                            <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                              <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                            </button>
                          )}
                          {(can("complimentary", "delete") || isAdmin) && (
                            <button onClick={() => setDeleteTarget(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Hapus">
                              <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground">Rp{fmtRp(item.price)}</p>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                      <div className="flex gap-2">
                        {item.isShowPrice && <Badge variant="outline" className="text-xs rounded-full">Harga tampil</Badge>}
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
                    <TableHead className="w-32 text-right">Harga</TableHead>
                    <TableHead className="w-28">Tampil Harga</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className={cn("text-center", "py-8", "text-muted-foreground")}>
                        Belum ada data.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className={cn("px-4", "sm:px-6", "text-muted-foreground")}>
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          Rp{fmtRp(item.price)}
                        </TableCell>
                        <TableCell>
                          {item.isShowPrice ? (
                            <Badge variant="outline" className="rounded-full text-xs">Tampil</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sembunyikan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="default" className="rounded-full text-xs bg-primary/10 text-primary border-0">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary" className="rounded-full text-xs">Nonaktif</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={cn("flex", "items-center", "gap-1", "justify-end", "pr-2")}>
                            {(can("complimentary", "edit") || isAdmin) && (
                              <button onClick={() => handleOpenEdit(item)} className={cn("p-1.5", "rounded-md", "hover:bg-muted", "cursor-pointer")} aria-label="Edit">
                                <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                              </button>
                            )}
                            {(can("complimentary", "delete") || isAdmin) && (
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
                label="Navigasi halaman complimentary"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit" : "Tambah"} Complimentary</DialogTitle>
          <div className={cn("space-y-4", "pt-2")}>
            <div className="space-y-1.5">
              <Label htmlFor="form-name">Nama <span className="text-destructive">*</span></Label>
              <Input
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contoh: Honeymoon Decoration, Free Cake"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="form-price">Harga (Rp)</Label>
              <Input
                id="form-price"
                value={formPrice ? fmtRp(formPrice) : ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                  setFormPrice(n);
                }}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="form-description">Deskripsi</Label>
              <Textarea
                id="form-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Keterangan tambahan (opsional)"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Tampilkan Harga di PO</p>
                <p className="text-xs text-muted-foreground">Nominal harga akan muncul di PDF Purchase Order</p>
              </div>
              <Switch
                checked={formIsShowPrice}
                onCheckedChange={setFormIsShowPrice}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Status Aktif</p>
                <p className="text-xs text-muted-foreground">Item nonaktif tidak muncul di dropdown booking</p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>

            <div className={cn("flex", "gap-3")}>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving} className={cn("flex-1", "cursor-pointer", "rounded-xl")}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim()} className={cn("flex-1", "cursor-pointer", "rounded-xl")}>
                {saving ? "Menyimpan..." : editingItem ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Complimentary</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Item yang sudah di-snapshot di booking lama tidak terpengaruh, tapi item ini tidak bisa dipilih lagi di booking baru.
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
