"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { BudgetFormDrawer } from "./BudgetFormDrawer";
import {
  Wallet,
  Pen,
  TrashBinTrash,
  MenuDots,
  Buildings3,
} from "@solar-icons/react";
import {
  useVenueBudgetList,
  useDeleteVenueBudget,
} from "@/hooks/useProcurement";
import type { VenueBudgetItem } from "@/lib/queries/procurement";

// ─── Props ────────────────────────────────────────────────────────────────────

interface VenueBudgetTabProps {
  venues: { id: string; name: string }[];
  addTrigger?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(v: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function formatPeriod(period: string): string {
  const d = new Date(`${period}-01`);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getRemainingBadgeBg(budget: number, remaining: number): string {
  if (budget <= 0) return "bg-muted text-muted-foreground";
  const pct = remaining / budget;
  if (pct > 0.5)
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (pct >= 0.2)
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  return "bg-destructive/10 text-destructive";
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function VenueBudgetTab({ venues, addTrigger = 0 }: VenueBudgetTabProps): React.JSX.Element {
  const [period, setPeriod] = useState<string>(getCurrentPeriod);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<VenueBudgetItem | null>(null);

  const prevTrigger = useRef(addTrigger);
  useEffect(() => {
    if (addTrigger > prevTrigger.current) {
      setEditItem(null);
      setDrawerOpen(true);
    }
    prevTrigger.current = addTrigger;
  }, [addTrigger]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VenueBudgetItem | null>(null);

  const { data, isLoading, isError } = useVenueBudgetList(period || undefined, page, LIMIT);
  const { mutateAsync: deleteMutation, isPending: isDeleting } = useDeleteVenueBudget();

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  function handleOpenEdit(item: VenueBudgetItem): void {
    setEditItem(item);
    setDrawerOpen(true);
  }

  function handleOpenDelete(item: VenueBudgetItem): void {
    setDeleteTarget(item);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await deleteMutation(deleteTarget.id);
      toast.success("Anggaran berhasil dihapus.");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus anggaran"
      );
    }
  }

  function handleDrawerOpenChange(open: boolean): void {
    setDrawerOpen(open);
    if (!open) {
      setEditItem(null);
    }
  }

  // Reset to page 1 when period changes
  function handlePeriodChange(value: string): void {
    setPeriod(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-secondary shrink-0">
          <Wallet weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-ink)]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Anggaran Venue
          </h2>
          <p className="text-xs text-muted-foreground">
            Kelola alokasi anggaran pengadaan per venue per periode
          </p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
        <label
          htmlFor="budget-period-filter"
          className="text-sm font-medium text-foreground shrink-0"
        >
          Periode
        </label>
        <input
          id="budget-period-filter"
          type="month"
          value={period}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-48"
        />
        {period && (
          <span className="text-xs text-muted-foreground">
            Menampilkan anggaran untuk{" "}
            <span className="font-medium">{formatPeriod(period)}</span>
          </span>
        )}
      </div>

      {/* Table card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Buildings3
            weight="BoldDuotone"
            className="h-4 w-4 text-muted-foreground"
          />
          <h3 className="text-sm font-semibold text-foreground">
            Daftar Anggaran
          </h3>
          {data && (
            <span className="ml-auto text-xs text-muted-foreground">
              {data.total} entri
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-center px-4">
            <Wallet
              weight="BoldDuotone"
              className="h-10 w-10 text-muted-foreground/30"
            />
            <p className="text-sm font-medium text-foreground">
              Gagal memuat data
            </p>
            <p className="text-xs text-muted-foreground">
              Coba muat ulang halaman
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-5 min-w-40">Venue</TableHead>
                    <TableHead className="min-w-28">Periode</TableHead>
                    <TableHead className="text-right min-w-36">Anggaran</TableHead>
                    <TableHead className="text-right min-w-36">Terpakai</TableHead>
                    <TableHead className="text-right min-w-36">Sisa</TableHead>
                    <TableHead className="min-w-36">Catatan</TableHead>
                    <TableHead className="min-w-36">Diperbarui oleh</TableHead>
                    <TableHead className="w-12 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-14 text-muted-foreground text-sm"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <Wallet
                            weight="BoldDuotone"
                            className="h-10 w-10 text-muted-foreground/30"
                          />
                          <div>
                            <p className="font-medium text-foreground">
                              Belum ada anggaran
                            </p>
                            <p className="text-xs mt-0.5">
                              {period
                                ? `Tidak ada anggaran untuk ${formatPeriod(period)}.`
                                : "Tambahkan anggaran venue untuk mulai."}
                            </p>
                          </div>
                          <p className="text-xs mt-1">
                            Gunakan tombol &quot;Tambah Baru&quot; di atas untuk menambahkan.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((row) => {
                      const budget = Number(row.budgetAmount);
                      const used = Number(row.usedAmount);
                      const remaining = budget - used;

                      return (
                        <TableRow key={row.id}>
                          <TableCell className="px-5 text-sm font-medium">
                            {row.venue.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatPeriod(row.period)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatRupiah(budget)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatRupiah(used)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${getRemainingBadgeBg(budget, remaining)}`}
                            >
                              {formatRupiah(remaining)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-40">
                            {row.note ? (
                              <span
                                className="truncate block max-w-36"
                                title={row.note}
                              >
                                {row.note}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 italic text-xs">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.updatedBy.fullName}
                          </TableCell>
                          <TableCell className="pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  aria-label="Opsi"
                                >
                                  <MenuDots
                                    weight="BoldDuotone"
                                    className="h-4 w-4"
                                  />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleOpenEdit(row)}
                                  className="gap-2"
                                >
                                  <Pen
                                    weight="BoldDuotone"
                                    className="h-4 w-4 text-muted-foreground"
                                  />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleOpenDelete(row)}
                                  className="gap-2 text-destructive focus:text-destructive"
                                >
                                  <TrashBinTrash
                                    weight="BoldDuotone"
                                    className="h-4 w-4"
                                  />
                                  Hapus
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <PaginationBar
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label="Navigasi halaman anggaran"
              />
            )}
          </>
        )}
      </div>

      {/* Add / Edit Drawer */}
      <BudgetFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
        item={editItem}
        venues={venues}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus Anggaran?"
        description={
          deleteTarget
            ? `Anggaran venue "${deleteTarget.venue.name}" untuk periode ${formatPeriod(deleteTarget.period)} akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.`
            : "Anggaran ini akan dihapus secara permanen."
        }
        confirmLabel={isDeleting ? "Menghapus..." : "Ya, Hapus"}
        cancelLabel="Batal"
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        destructive
      />
    </div>
  );
}
