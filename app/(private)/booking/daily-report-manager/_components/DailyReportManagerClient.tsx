"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AddCircle,
  DocumentText,
  TrashBinTrash,
  Pen,
  AltArrowLeft,
  AltArrowRight,
  UsersGroupRounded,
  Danger,
} from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  useDailyReports,
  useDeleteDailyReport,
} from "@/hooks/use-daily-report-manager";
import type { DailyReportListItem, DailyReportStatus } from "@/hooks/use-daily-report-manager";
import { DailyReportDrawer } from "./DailyReportDrawer";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  groups: { id: string; name: string }[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<DailyReportStatus, string> = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  OFF_TRACK: "Off Track",
};

function statusClass(status: DailyReportStatus): string {
  if (status === "ON_TRACK") return "bg-primary/10 text-primary";
  if (status === "AT_RISK") return "bg-accent text-accent-foreground";
  return "bg-destructive/10 text-destructive";
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatter
// ─────────────────────────────────────────────────────────────────────────────

function formatTanggal(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric card mini
// ─────────────────────────────────────────────────────────────────────────────

interface MetricMiniProps {
  label: string;
  value: number;
}

function MetricMini({ label, value }: MetricMiniProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-muted/50 p-3">
      <span className="text-lg font-semibold font-heading text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report card
// ─────────────────────────────────────────────────────────────────────────────

interface DailyReportCardProps {
  report: DailyReportListItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (report: DailyReportListItem) => void;
  onDelete: (report: DailyReportListItem) => void;
}

function DailyReportCard({
  report,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: DailyReportCardProps) {
  const completedCount = report.membersCompleted.length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md">
      {/* Top row: date + status + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-foreground">
            {formatTanggal(report.reportDate)}
          </span>
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusClass(report.status),
            )}
          >
            {STATUS_LABEL[report.status]}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PermissionGate module="daily-report-manager" action="edit">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onEdit(report)}
                aria-label="Edit laporan"
              >
                <Pen weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </PermissionGate>
          <PermissionGate module="daily-report-manager" action="delete">
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onDelete(report)}
                aria-label="Hapus laporan"
              >
                <TrashBinTrash weight="BoldDuotone" className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </PermissionGate>
        </div>
      </div>

      {/* Metrics grid 3×2 */}
      <div className="grid grid-cols-3 gap-2">
        <MetricMini label="Client Dihubungi" value={report.totalClientDihubungi} />
        <MetricMini label="Hot Prospect" value={report.totalHotProspect} />
        <MetricMini label="Leads Baru" value={report.totalLeadsBaru} />
        <MetricMini label="Follow Up" value={report.totalFollowUp} />
        <MetricMini label="Potensi Closing" value={report.totalPotensiClosing} />
        <MetricMini label="Closing Hari Ini" value={report.closingHariIni} />
      </div>

      {/* Member completion */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UsersGroupRounded weight="BoldDuotone" className="h-4 w-4 shrink-0" />
        <span>
          {completedCount}/{report.membersTotal} anggota sudah mengisi
        </span>
      </div>

      {/* Preview fields */}
      {(report.actionBesok ?? report.kendala) && (
        <div className="flex flex-col gap-2 pt-1 border-t border-border">
          {report.actionBesok && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Action Besok
              </span>
              <p className="text-sm text-foreground line-clamp-2">
                {report.actionBesok.slice(0, 100)}
                {report.actionBesok.length > 100 ? "…" : ""}
              </p>
            </div>
          )}
          {report.kendala && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Kendala
              </span>
              <p className="text-sm text-foreground line-clamp-2">
                {report.kendala.slice(0, 100)}
                {report.kendala.length > 100 ? "…" : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Submitted by */}
      <div className="text-xs text-muted-foreground">
        Dilaporkan oleh{" "}
        <span className="font-medium text-foreground">
          {report.submittedBy.fullName ?? "—"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────────────────────────────────────

function ReportCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-4 w-48 rounded-lg" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────

export function DailyReportManagerClient({
  groups,
  canCreate,
  canEdit,
  canDelete,
}: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groups[0]?.id ?? "",
  );
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editReport, setEditReport] = useState<DailyReportListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DailyReportListItem | null>(null);

  const { data, isLoading } = useDailyReports(selectedGroupId || undefined, page);
  const deleteMutation = useDeleteDailyReport();

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const reports = data?.data ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  function handleGroupChange(value: string) {
    setSelectedGroupId(value);
    setPage(1);
  }

  function handleOpenCreate() {
    setEditReport(null);
    setDrawerOpen(true);
  }

  function handleOpenEdit(report: DailyReportListItem) {
    setEditReport(report);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setEditReport(null);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (res) => {
        if (res.success) {
          toast.success("Laporan berhasil dihapus");
          setDeleteTarget(null);
        } else {
          toast.error(
            "error" in res ? (res.error ?? "Terjadi kesalahan") : "Terjadi kesalahan",
          );
        }
      },
      onError: () => toast.error("Terjadi kesalahan"),
    });
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
        <Danger weight="BoldDuotone" className="h-10 w-10" />
        <p className="text-sm">Tidak ada grup yang dapat diakses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold font-heading text-foreground">
            Daily Report Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Laporan harian aktivitas tim per grup
          </p>
        </div>
        {canCreate && (
          <PermissionGate module="daily-report-manager" action="create">
            <Button
              size="sm"
              className="h-9 gap-1.5 rounded-full"
              onClick={handleOpenCreate}
              disabled={!selectedGroupId}
            >
              <AddCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
              Buat Laporan Hari Ini
            </Button>
          </PermissionGate>
        )}
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0">Pilih Grup:</span>
          <Select value={selectedGroupId} onValueChange={handleGroupChange}>
            <SelectTrigger className="w-60 rounded-full h-9">
              <SelectValue placeholder="Pilih grup..." />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Report list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ReportCardSkeleton key={i} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground rounded-2xl border border-border bg-card">
          <DocumentText weight="BoldDuotone" className="h-10 w-10" />
          <div className="text-center">
            <p className="text-sm font-medium">Belum ada laporan</p>
            <p className="text-xs mt-1">
              {canCreate
                ? 'Klik "Buat Laporan Hari Ini" untuk membuat laporan pertama.'
                : "Belum ada laporan yang dibuat untuk grup ini."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <DailyReportCard
              key={report.id}
              report={report}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
            <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Drawer */}
      {selectedGroup && (
        <DailyReportDrawer
          key={editReport?.id ?? "create"}
          open={drawerOpen}
          onClose={handleCloseDrawer}
          groupId={selectedGroupId}
          groupName={selectedGroup.name}
          editReport={editReport ?? undefined}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Hapus Laporan"
        description={`Laporan tanggal ${deleteTarget ? formatTanggal(deleteTarget.reportDate) : ""} akan dihapus permanen. Lanjutkan?`}
        confirmLabel="Ya, Hapus"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
