"use client";

import { useState } from "react";
import { AddCircle, Pen, TrashBinTrash, BoxMinimalistic, Magnifer } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useTargetItems, useDeleteTargetItem } from "@/hooks/useKpiInsentif";
import { TargetItemDrawer } from "./TargetItemDrawer";
import { formatRupiah } from "@/lib/utils";
import type { TargetItemRow } from "@/lib/queries/kpiInsentif";
import { EmptyState } from "../../_components/EmptyState";

interface TargetItemClientProps {
  initialItems: TargetItemRow[];
}

function formatQtyColumn(
  qty: number | null,
  qtyReguler: number | null,
  qtyHadjatan: number | null
) {
  if (qty == null && qtyReguler == null && qtyHadjatan == null) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-sm">{qty != null ? `${qty} qty` : "-"}</p>
      {(qtyReguler != null || qtyHadjatan != null) && (
        <p className="font-mono text-xs text-muted-foreground">
          R: {qtyReguler ?? "-"} &middot; H: {qtyHadjatan ?? "-"}
        </p>
      )}
    </div>
  );
}

function formatOmsetColumn(
  price: TargetItemRow["omsetPrice"],
  priceReguler: TargetItemRow["omsetPriceReguler"],
  priceHadjatan: TargetItemRow["omsetPriceHadjatan"]
) {
  if (price == null && priceReguler == null && priceHadjatan == null) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-sm">
        {price != null ? formatRupiah(Number(price)) : "-"}
      </p>
      {(priceReguler != null || priceHadjatan != null) && (
        <p className="font-mono text-xs text-muted-foreground">
          R: {priceReguler != null ? formatRupiah(Number(priceReguler)) : "-"} &middot; H:{" "}
          {priceHadjatan != null ? formatRupiah(Number(priceHadjatan)) : "-"}
        </p>
      )}
    </div>
  );
}

export function TargetItemClient({ initialItems }: TargetItemClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<TargetItemRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteItemName, setDeleteItemName] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: items = initialItems, isLoading } = useTargetItems();
  const deleteMutation = useDeleteTargetItem();

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    return item.name.toLowerCase().includes(search.toLowerCase());
  });

  function handleEdit(item: TargetItemRow) {
    setEditItem(item);
    setDrawerOpen(true);
  }

  function handleAdd() {
    setEditItem(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditItem(null);
  }

  function confirmDelete(item: TargetItemRow) {
    setDeleteId(item.id);
    setDeleteItemName(item.name);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteMutation.mutateAsync(deleteId);
    if (result.success) {
      toast.success("Target item berhasil dihapus");
    } else {
      toast.error(result.error ?? "Gagal menghapus target item");
    }
    setDeleteId(null);
    setDeleteItemName("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Target Item"
        description="Kelola item target KPI (dealing, omset, homebase)"
        action={
          <PermissionGate module="kpi-master" action="create">
            <Button onClick={handleAdd} className="rounded-full gap-2">
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Target Item
            </Button>
          </PermissionGate>
        }
      />

      {/* Filter */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Magnifer weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="search"
            placeholder="Cari nama target item..."
            className="rounded-full h-8 text-sm max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BoxMinimalistic weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />}
            title="Belum ada target item"
            description="Tambahkan target item untuk memulai konfigurasi KPI"
            action={
              <PermissionGate module="kpi-master" action="create">
                <Button onClick={handleAdd} className="rounded-full gap-2" size="sm">
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah Target Item
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <>
            {/* Table — desktop (sm+) */}
            <div className="hidden sm:block w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Nama</TableHead>
                    <TableHead>Dealing</TableHead>
                    <TableHead>Omset</TableHead>
                    <TableHead>Homebase</TableHead>
                    <TableHead className="pr-5 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-5 font-medium">{item.name}</TableCell>
                      <TableCell>
                        {formatQtyColumn(
                          item.dealingQty,
                          item.dealingQtyReguler,
                          item.dealingQtyHadjatan
                        )}
                      </TableCell>
                      <TableCell>
                        {formatOmsetColumn(
                          item.omsetPrice,
                          item.omsetPriceReguler,
                          item.omsetPriceHadjatan
                        )}
                      </TableCell>
                      <TableCell>
                        {formatQtyColumn(
                          item.homebaseQty,
                          item.homebaseQtyReguler,
                          item.homebaseQtyHadjatan
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <PermissionGate module="kpi-master" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => handleEdit(item)}
                            >
                              <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="kpi-master" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                              onClick={() => confirmDelete(item)}
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Card list — mobile (<sm) */}
            <div className="block sm:hidden p-4 space-y-3">
              {filtered.map((item) => (
                <div key={item.id} className="rounded-xl border bg-card p-3 space-y-2">
                  <p className="font-medium text-foreground truncate">{item.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Dealing</p>
                      {formatQtyColumn(item.dealingQty, item.dealingQtyReguler, item.dealingQtyHadjatan)}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Omset</p>
                      {formatOmsetColumn(item.omsetPrice, item.omsetPriceReguler, item.omsetPriceHadjatan)}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Homebase</p>
                      {formatQtyColumn(item.homebaseQty, item.homebaseQtyReguler, item.homebaseQtyHadjatan)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-border">
                    <PermissionGate module="kpi-master" action="edit">
                      <Button
                        variant="outline"
                        className="h-9 flex-1 text-xs"
                        onClick={() => handleEdit(item)}
                      >
                        <Pen weight="BoldDuotone" className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                        Edit
                      </Button>
                    </PermissionGate>
                    <PermissionGate module="kpi-master" action="delete">
                      <Button
                        variant="outline"
                        className="h-9 flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => confirmDelete(item)}
                      >
                        <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5 mr-1" />
                        Hapus
                      </Button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <TargetItemDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        editItem={editItem}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Target Item</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus target item{" "}
              <span className="font-semibold">&ldquo;{deleteItemName}&rdquo;</span>?
              Item yang masih digunakan di KPI Master tidak dapat dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={deleteMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
