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
import { PermissionGate } from "@/components/shared/permission-gate";
import { useAchievementSchemas, useDeleteAchievementSchema } from "@/hooks/useKpiInsentif";
import { AchievementSchemaDrawer } from "./AchievementSchemaDrawer";
import { EmptyState } from "../../_components/EmptyState";
import type { AchievementSchemaRow } from "@/lib/queries/kpiInsentif";

interface AchievementClientProps {
  initialSchemas: AchievementSchemaRow[];
}

const BUSINESS_ROLE_LABELS: Record<string, string> = {
  sales: "Sales",
  manager: "Manager",
};

export function AchievementClient({ initialSchemas }: AchievementClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editSchema, setEditSchema] = useState<AchievementSchemaRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSchemaName, setDeleteSchemaName] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: schemas = initialSchemas, isLoading } = useAchievementSchemas();
  const deleteMutation = useDeleteAchievementSchema();

  function handleEdit(schema: AchievementSchemaRow) {
    setEditSchema(schema);
    setDrawerOpen(true);
  }

  function handleAdd() {
    setEditSchema(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditSchema(null);
  }

  function confirmDelete(schema: AchievementSchemaRow) {
    setDeleteId(schema.id);
    setDeleteSchemaName(schema.name);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteMutation.mutateAsync(deleteId);
    if (result.success) {
      toast.success("Skema achievement berhasil dihapus");
    } else {
      toast.error(result.error ?? "Gagal menghapus skema achievement");
    }
    setDeleteId(null);
    setDeleteSchemaName("");
  }

  const filtered = schemas.filter((s) => {
    if (!search.trim()) return true;
    return s.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skema Achievement"
        description="Konfigurasi matriks bonus dan potongan per role"
        action={
          <PermissionGate module="kpi-master" action="create">
            <Button onClick={handleAdd} className="rounded-full gap-2">
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Skema
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
            placeholder="Cari nama skema..."
            className="rounded-full h-8 text-sm max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BoxMinimalistic weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />}
            title="Belum ada skema achievement"
            description="Buat skema achievement untuk mendefinisikan matriks bonus dan potongan"
            action={
              <PermissionGate module="kpi-master" action="create">
                <Button onClick={handleAdd} className="rounded-full gap-2" size="sm">
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah Skema
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
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gating</TableHead>
                    <TableHead className="pr-5 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((schema) => (
                    <TableRow key={schema.id}>
                      <TableCell className="pl-5">
                        <div>
                          <p className="font-medium">{schema.name}</p>
                          {schema.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-48 truncate">
                              {schema.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full text-xs">
                          {BUSINESS_ROLE_LABELS[schema.businessRole] ?? schema.businessRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {schema.isDraft ? (
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
                      <TableCell className="text-sm text-muted-foreground">
                        {schema.businessRole === "manager" && schema.gatingMinIndicators != null
                          ? `Min. ${schema.gatingMinIndicators} indikator`
                          : "—"}
                      </TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <PermissionGate module="kpi-master" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => handleEdit(schema)}
                            >
                              <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="kpi-master" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                              onClick={() => confirmDelete(schema)}
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
              {filtered.map((schema) => (
                <div key={schema.id} className="rounded-xl border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{schema.name}</p>
                      {schema.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {schema.description}
                        </p>
                      )}
                    </div>
                    {schema.isDraft ? (
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
                      {BUSINESS_ROLE_LABELS[schema.businessRole] ?? schema.businessRole}
                    </Badge>
                    {schema.businessRole === "manager" && schema.gatingMinIndicators != null && (
                      <span>Min. {schema.gatingMinIndicators} indikator</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pt-1 border-t border-border">
                    <PermissionGate module="kpi-master" action="edit">
                      <Button
                        variant="outline"
                        className="h-9 flex-1 text-xs"
                        onClick={() => handleEdit(schema)}
                      >
                        <Pen weight="BoldDuotone" className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                        Edit
                      </Button>
                    </PermissionGate>
                    <PermissionGate module="kpi-master" action="delete">
                      <Button
                        variant="outline"
                        className="h-9 flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => confirmDelete(schema)}
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

      <AchievementSchemaDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        editSchema={editSchema}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open: boolean) => { if (!open) setDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Skema Achievement</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus skema{" "}
              <span className="font-semibold">&ldquo;{deleteSchemaName}&rdquo;</span>?
              Skema yang masih digunakan di KPI Master tidak dapat dihapus.
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
