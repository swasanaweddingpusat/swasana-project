"use client";

import { useState } from "react";
import { AddCircle, Pen, TrashBinTrash, BoxMinimalistic, Magnifer } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useTargetItems, useDeleteTargetItem } from "@/hooks/useKpiInsentif";
import { TargetItemDrawer } from "./TargetItemDrawer";
import { formatRupiah } from "@/lib/utils";
import type { TargetItemRow } from "@/lib/queries/kpiInsentif";

interface TargetItemClientProps {
  initialItems: TargetItemRow[];
}

const INDICATOR_LABELS: Record<string, string> = {
  dealing: "Dealing",
  omset: "Omset",
  homebase: "Homebase",
};

const INDICATOR_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  dealing: "default",
  omset: "secondary",
  homebase: "outline",
};

function IndicatorBadge({ type }: { type: string }) {
  return (
    <Badge variant={INDICATOR_VARIANT[type] ?? "secondary"} className="rounded-full text-xs">
      {INDICATOR_LABELS[type] ?? type}
    </Badge>
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

  function formatTargetValue(item: TargetItemRow): string {
    if (item.type === "qty") {
      if (item.qty != null) return `${item.qty} qty`;
      return "—";
    }
    if (item.price != null) return formatRupiah(Number(item.price));
    return "—";
  }

  function formatSplitReguler(item: TargetItemRow): string {
    if (item.type === "qty") {
      if (item.qtyReguler != null) return `${item.qtyReguler}`;
      return "—";
    }
    if (item.priceReguler != null) return formatRupiah(Number(item.priceReguler));
    return "—";
  }

  function formatSplitHadjatan(item: TargetItemRow): string {
    if (item.type === "qty") {
      if (item.qtyHadjatan != null) return `${item.qtyHadjatan}`;
      return "—";
    }
    if (item.priceHadjatan != null) return formatRupiah(Number(item.priceHadjatan));
    return "—";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Target Item"
        description="Kelola item target KPI (dealing, omset, homebase)"
        action={
          <Button onClick={handleAdd} className="rounded-full gap-2">
            <AddCircle weight="BoldDuotone" className="h-4 w-4" />
            Tambah Target Item
          </Button>
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
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BoxMinimalistic weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Belum ada target item</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tambahkan target item untuk memulai konfigurasi KPI
              </p>
            </div>
            <Button onClick={handleAdd} className="rounded-full gap-2" size="sm">
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Target Item
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Nama</TableHead>
                  <TableHead>Tipe Indikator</TableHead>
                  <TableHead>Tipe Target</TableHead>
                  <TableHead>Target Utama</TableHead>
                  <TableHead>Rincian Reguler</TableHead>
                  <TableHead>Rincian Hadjatan</TableHead>
                  <TableHead className="pr-5 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-5 font-medium">{item.name}</TableCell>
                    <TableCell>
                      <IndicatorBadge type={item.indicatorType} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full text-xs capitalize">
                        {item.type === "qty" ? "Qty" : "Harga"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatTargetValue(item)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatSplitReguler(item)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatSplitHadjatan(item)}
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl"
                          onClick={() => handleEdit(item)}
                        >
                          <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                          onClick={() => confirmDelete(item)}
                        >
                          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
