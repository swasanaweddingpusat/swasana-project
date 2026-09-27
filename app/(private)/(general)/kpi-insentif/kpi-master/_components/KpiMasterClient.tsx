"use client";

import { useState } from "react";
import { AddCircle, Pen, TrashBinTrash, BoxMinimalistic, Filter, Magnifer } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useKpiMasters, useDeleteKpiMaster } from "@/hooks/useKpiInsentif";
import { KpiMasterDrawer } from "./KpiMasterDrawer";
import type { KpiMasterRow } from "@/lib/queries/kpiInsentif";
import { EmptyState } from "../../_components/EmptyState";

interface KpiMasterClientProps {
  initialMasters: KpiMasterRow[];
}

const BUSINESS_ROLE_LABELS: Record<string, string> = {
  sales: "Sales",
  manager: "Manager",
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
];

function formatMonth(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function KpiMasterClient({ initialMasters }: KpiMasterClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMaster, setEditMaster] = useState<KpiMasterRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteMasterName, setDeleteMasterName] = useState<string>("");

  // Filters
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [search, setSearch] = useState("");

  const filterMonthDate = filterMonth ? new Date(`${filterMonth}-01`) : undefined;

  const { data: mastersRaw = initialMasters, isLoading } = useKpiMasters({
    businessRole: filterRole !== "all" ? filterRole : undefined,
    month: filterMonthDate,
  });

  const filtered = mastersRaw.filter((m) => {
    if (!search.trim()) return true;
    return m.name.toLowerCase().includes(search.toLowerCase());
  });

  const deleteMutation = useDeleteKpiMaster();

  function handleEdit(master: KpiMasterRow) {
    setEditMaster(master);
    setDrawerOpen(true);
  }

  function handleAdd() {
    setEditMaster(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditMaster(null);
  }

  function confirmDelete(master: KpiMasterRow) {
    setDeleteId(master.id);
    setDeleteMasterName(master.name);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteMutation.mutateAsync(deleteId);
    if (result.success) {
      toast.success("KPI Master berhasil dihapus");
    } else {
      toast.error(result.error ?? "Gagal menghapus KPI Master");
    }
    setDeleteId(null);
    setDeleteMasterName("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master KPI"
        description="Kelola konfigurasi KPI bulanan per role"
        action={
          <PermissionGate module="kpi-master" action="create">
            <Button onClick={handleAdd} className="rounded-full gap-2">
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah KPI Master
            </Button>
          </PermissionGate>
        }
      />

      {/* Filter Bar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter weight="BoldDuotone" className="h-4 w-4" />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="rounded-full h-8 text-sm w-36">
              <SelectValue placeholder="Semua Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Role</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="filter-month" className="text-sm text-muted-foreground whitespace-nowrap">
              Bulan:
            </Label>
            <Input
              id="filter-month"
              type="month"
              className="rounded-full h-8 text-sm w-36"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
            {filterMonth && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setFilterMonth("")}
              >
                Reset
              </button>
            )}
          </div>
          <div className="relative flex items-center">
            <Magnifer weight="BoldDuotone" className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Cari nama..."
              className="rounded-full h-8 text-sm w-40 pl-7"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
            title="Belum ada KPI Master"
            description={
              filterRole !== "all" || filterMonth || search.trim()
                ? "Tidak ada data sesuai filter"
                : "Buat KPI Master untuk mulai mengatur target dan skema achievement"
            }
            action={
              filterRole === "all" && !filterMonth && !search.trim() ? (
                <PermissionGate module="kpi-master" action="create">
                  <Button onClick={handleAdd} className="rounded-full gap-2" size="sm">
                    <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                    Tambah KPI Master
                  </Button>
                </PermissionGate>
              ) : undefined
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
                    <TableHead>Bulan</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Target Item</TableHead>
                    <TableHead>Skema Achievement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((master) => (
                    <TableRow key={master.id}>
                      <TableCell className="pl-5">
                        <div>
                          <p className="font-medium">{master.name}</p>
                          {master.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-40 truncate">
                              {master.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {formatMonth(master.month)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-xs">
                          {BUSINESS_ROLE_LABELS[master.businessRole] ?? master.businessRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-32">
                        <p className="truncate">{master.targetItem?.name ?? "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-32">
                        <p className="truncate">{master.achievementSchema?.name ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        {master.isDraft ? (
                          <Badge
                            variant="outline"
                            className="rounded-full text-xs bg-muted text-muted-foreground"
                          >
                            Draft
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full text-xs bg-primary/10 text-primary border-primary/30"
                          >
                            Aktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <PermissionGate module="kpi-master" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => handleEdit(master)}
                            >
                              <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="kpi-master" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                              onClick={() => confirmDelete(master)}
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
              {filtered.map((master) => (
                <div key={master.id} className="rounded-xl border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{master.name}</p>
                      {master.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {master.description}
                        </p>
                      )}
                    </div>
                    {master.isDraft ? (
                      <Badge variant="outline" className="shrink-0 rounded-full text-xs bg-muted text-muted-foreground">
                        Draft
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 rounded-full text-xs bg-primary/10 text-primary border-primary/30">
                        Aktif
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {BUSINESS_ROLE_LABELS[master.businessRole] ?? master.businessRole}
                    </Badge>
                    <span className="font-mono">{formatMonth(master.month)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p className="truncate">Target: {master.targetItem?.name ?? "—"}</p>
                    <p className="truncate">Skema: {master.achievementSchema?.name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-border">
                    <PermissionGate module="kpi-master" action="edit">
                      <Button
                        variant="outline"
                        className="h-9 flex-1 text-xs"
                        onClick={() => handleEdit(master)}
                      >
                        <Pen weight="BoldDuotone" className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                        Edit
                      </Button>
                    </PermissionGate>
                    <PermissionGate module="kpi-master" action="delete">
                      <Button
                        variant="outline"
                        className="h-9 flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => confirmDelete(master)}
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

      <KpiMasterDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        editMaster={editMaster}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open: boolean) => { if (!open) setDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus KPI Master</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus KPI Master{" "}
              <span className="font-semibold">&ldquo;{deleteMasterName}&rdquo;</span>?
              KPI Master yang masih memiliki assignment tidak dapat dihapus.
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
