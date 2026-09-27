// FILE: app/(private)/(general)/kpi-insentif/konfigurasi/_components/CommissionPolicyClient.tsx
"use client";

import { useState } from "react";
import { AddCircle, Pen, TrashBinTrash, WalletMoney, Magnifer } from "@solar-icons/react";
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
import { EmptyState } from "../../_components/EmptyState";
import { SummaryCard } from "@/components/shared/SummaryCard";
import {
  useCommissionPolicies,
  useDeleteCommissionPolicy,
} from "@/hooks/useKpiInsentif";
import { CommissionPolicyDrawer } from "./CommissionPolicyDrawer";
import { formatRupiah, formatPct } from "@/lib/utils/kpiFormatters";
import { formatDate } from "@/lib/utils";
import type { CommissionPolicyRow } from "@/lib/queries/kpiInsentif";

interface CommissionPolicyClientProps {
  initialPolicies: CommissionPolicyRow[];
}

const BUSINESS_ROLE_LABELS: Record<string, string> = {
  sales: "Sales",
  manager: "Manager",
};

const PACKAGE_CATEGORY_LABELS: Record<string, string> = {
  WEDDINGS: "Weddings",
  MICE: "MICE",
};

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

/** Prisma Decimal fields arrive typed as `Decimal | null` — normalize to plain number. */
function toNumber(value: { toString(): string } | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "object" ? Number(value.toString()) : Number(value);
  return Number.isNaN(num) ? null : num;
}

function formatPctOfRevenue(value: { toString(): string } | number | string | null | undefined): string {
  const num = toNumber(value);
  if (num === null) return "—";
  return formatPct(num * 100);
}

function formatBerlaku(policy: CommissionPolicyRow): string {
  const from = policy.effectiveFrom;
  const to = policy.effectiveTo;
  if (!from && !to) return "Selalu";
  if (from && to) return `${formatDate(from, SHORT_DATE_OPTIONS)} — ${formatDate(to, SHORT_DATE_OPTIONS)}`;
  if (from) return `Sejak ${formatDate(from, SHORT_DATE_OPTIONS)}`;
  return `Sampai ${formatDate(to, SHORT_DATE_OPTIONS)}`;
}

export function CommissionPolicyClient({ initialPolicies }: CommissionPolicyClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<CommissionPolicyRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePolicyName, setDeletePolicyName] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: policies = initialPolicies, isLoading } = useCommissionPolicies();
  const deleteMutation = useDeleteCommissionPolicy();

  const filtered = policies.filter((policy) => {
    if (!search.trim()) return true;
    return policy.name.toLowerCase().includes(search.toLowerCase());
  });

  const activeCount = policies.filter((p) => !p.isDraft).length;
  const draftCount = policies.filter((p) => p.isDraft).length;

  function handleEdit(policy: CommissionPolicyRow) {
    setEditPolicy(policy);
    setDrawerOpen(true);
  }

  function handleAdd() {
    setEditPolicy(null);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditPolicy(null);
  }

  function confirmDelete(policy: CommissionPolicyRow) {
    setDeleteId(policy.id);
    setDeletePolicyName(policy.name);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteMutation.mutateAsync(deleteId);
    if (result.success) {
      toast.success("Kebijakan komisi berhasil dihapus");
    } else {
      toast.error(result.error ?? "Gagal menghapus kebijakan komisi");
    }
    setDeleteId(null);
    setDeletePolicyName("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kebijakan Komisi & Bonus"
        description="Konfigurasi formula komisi per-deal, persentase omset, dan bonus over-achievement"
        action={
          <PermissionGate module="kpi-master" action="create">
            <Button onClick={handleAdd} className="rounded-full gap-2">
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />
              Tambah Kebijakan
            </Button>
          </PermissionGate>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Kebijakan" value={policies.length} />
        <SummaryCard label="Aktif" value={activeCount} valueClassName="text-primary" />
        <SummaryCard label="Draft" value={draftCount} valueClassName="text-muted-foreground" />
      </div>

      {/* Filter */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Magnifer weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="search"
            placeholder="Cari nama kebijakan..."
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
            icon={<WalletMoney weight="BoldDuotone" className="h-8 w-8 text-muted-foreground" />}
            title="Belum ada kebijakan komisi"
            description="Tambahkan kebijakan untuk mengatur formula komisi dan bonus over-achievement"
            action={
              <PermissionGate module="kpi-master" action="create">
                <Button onClick={handleAdd} className="rounded-full gap-2" size="sm">
                  <AddCircle weight="BoldDuotone" className="h-4 w-4" />
                  Tambah Kebijakan
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Nama</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Kategori Paket</TableHead>
                  <TableHead>Nominal/Deal</TableHead>
                  <TableHead>%Omset</TableHead>
                  <TableHead>OA Nominal/Deal</TableHead>
                  <TableHead>OA %Omset</TableHead>
                  <TableHead>Berlaku</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="pl-5">
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        {policy.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 max-w-48 truncate">
                            {policy.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-full text-xs">
                        {BUSINESS_ROLE_LABELS[policy.businessRole] ?? policy.businessRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {policy.packageCategory
                        ? (PACKAGE_CATEGORY_LABELS[policy.packageCategory] ?? policy.packageCategory)
                        : "Semua"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatRupiah(toNumber(policy.nominalPerDeal))}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatPctOfRevenue(policy.pctOfRevenue)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatRupiah(toNumber(policy.overAchievementNominalPerExtraDeal))}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatPctOfRevenue(policy.overAchievementPctOfExtraRevenue)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatBerlaku(policy)}
                    </TableCell>
                    <TableCell>
                      {policy.isDraft ? (
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
                            onClick={() => handleEdit(policy)}
                          >
                            <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="kpi-master" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                            onClick={() => confirmDelete(policy)}
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
        )}
      </div>

      <CommissionPolicyDrawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        editPolicy={editPolicy}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kebijakan Komisi</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus kebijakan{" "}
              <span className="font-semibold">&ldquo;{deletePolicyName}&rdquo;</span>? Tindakan ini
              tidak dapat dibatalkan.
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
