"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAttendanceList, useDeleteAttendanceRecord, useDeleteBulkAttendanceRecords } from "@/hooks/use-attendance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { PhotoPreviewModal } from "./PhotoPreviewModal";
import { EmployeeOverviewDrawer } from "./EmployeeOverviewDrawer";
import { AttendanceEditDialog } from "./AttendanceEditDialog";
import { Gallery, ArrowLeft, ArrowRight, ChartSquare, Pen, TrashBinTrash } from "@solar-icons/react";
import type { AttendanceListItem } from "@/lib/queries/attendance";
import type { AttendanceOverviewQuery } from "@/lib/validations/attendance";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  on_time: { label: "Hadir", variant: "default" },
  late: { label: "Terlambat", variant: "secondary" },
  absent: { label: "Absen", variant: "destructive" },
};

const ATTENDANT_TYPE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  WORKDAY: { label: "Work Day", variant: "outline" },
  DAY_OFF: { label: "Day Off", variant: "secondary" },
};

const WORK_TYPE_LABEL: Record<string, string> = {
  WFO: "WFO",
  WFH: "WFH",
  WFA: "WFA",
};

const WORK_TYPE_APPROVAL_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Menunggu", variant: "secondary" },
  manager_approved: { label: "Menunggu HR", variant: "outline" },
  approved: { label: "Disetujui", variant: "default" },
  rejected: { label: "Ditolak", variant: "destructive" },
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTimeShort(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(clockInAt: string | Date | null, clockOutAt: string | Date | null): string {
  if (!clockInAt || !clockOutAt) return "-";
  const ms = new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
  if (ms <= 0) return "-";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}j ${minutes}m`;
}

export function AttendanceTable() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceListItem | null>(null);
  const [overviewTarget, setOverviewTarget] = useState<{ profileId: string; profileName: string } | null>(null);
  const [editTarget, setEditTarget] = useState<AttendanceListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const deleteMutation = useDeleteAttendanceRecord();
  const bulkDeleteMutation = useDeleteBulkAttendanceRecords();

  const mode = searchParams.get("mode") ?? "month";
  const date = mode === "date" ? (searchParams.get("date") ?? undefined) : undefined;
  const month = mode === "month"
    ? (Number(searchParams.get("month")) || (new Date().getMonth() + 1))
    : undefined;
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const profileId = searchParams.get("profileId") ?? undefined;
  const venueId = searchParams.get("venueId") ?? undefined;

  const { data, isLoading } = useAttendanceList({
    date,
    month,
    year,
    profileId,
    venueId,
    page,
    limit: 50,
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;
  const rows = data?.data ?? [];

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? rows.map((r) => r.id) : []);
  }

  function toggleSelectRow(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Data kehadiran berhasil dihapus");
          setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
        } else {
          toast.error(result.error ?? "Gagal menghapus data kehadiran");
        }
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Terjadi kesalahan");
        setDeleteTarget(null);
      },
    });
  }

  async function handleBulkDelete() {
    const result = await bulkDeleteMutation.mutateAsync(selectedIds);
    if (result.success) {
      toast.success(`${result.count ?? selectedIds.length} data kehadiran berhasil dihapus`);
      setSelectedIds([]);
    } else {
      toast.error(result.error ?? "Gagal menghapus data kehadiran");
    }
    setBulkDeleteOpen(false);
  }

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">Rekap Kehadiran</CardTitle>
            {data && (
              <span className="text-sm text-muted-foreground">{data.total} record</span>
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-4 py-2">
              <span className="text-sm">
                <span className="font-semibold">{selectedIds.length}</span> data dipilih
              </span>
              <PermissionGate module="hr-attendance" action="delete">
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <TrashBinTrash weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
                  Hapus Terpilih
                </Button>
              </PermissionGate>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && (!data || data.data.length === 0) && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Tidak ada data kehadiran untuk periode ini
            </p>
          )}

          {!isLoading && data && data.data.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={rows.length > 0 && selectedIds.length === rows.length}
                          onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        />
                      </TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead>Durasi Kerja</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Tipe Kerja</TableHead>
                      <TableHead>Tipe Hari</TableHead>
                      <TableHead>Tanggal Merah</TableHead>
                      <TableHead className="w-16">Foto</TableHead>
                      <TableHead className="w-16">Overview</TableHead>
                      <TableHead className="w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((record) => {
                      const badge = STATUS_BADGE[record.status] ?? STATUS_BADGE.absent;
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(record.id)}
                              onCheckedChange={(checked) => toggleSelectRow(record.id, checked === true)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {record.profile.fullName ?? "-"}
                          </TableCell>
                          <TableCell>{formatDate(record.date)}</TableCell>
                          <TableCell>{formatTimeShort(record.clockInAt)}</TableCell>
                          <TableCell>{formatTimeShort(record.clockOutAt)}</TableCell>
                          <TableCell>{formatDuration(record.clockInAt, record.clockOutAt)}</TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell>{record.workLocation?.name ?? "-"}</TableCell>
                          <TableCell>{record.workShift?.name ?? "-"}</TableCell>
                          <TableCell>
                            {record.workType ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant="outline">{WORK_TYPE_LABEL[record.workType] ?? record.workType}</Badge>
                                {record.workType !== "WFO" && record.workTypeApprovalStatus && (
                                  <Badge variant={WORK_TYPE_APPROVAL_BADGE[record.workTypeApprovalStatus].variant}>
                                    {WORK_TYPE_APPROVAL_BADGE[record.workTypeApprovalStatus].label}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              if (record.isPublicHoliday) {
                                return <Badge variant="destructive">Public Holiday</Badge>;
                              }
                              const atBadge = ATTENDANT_TYPE_BADGE[record.attendantType] ?? ATTENDANT_TYPE_BADGE.WORKDAY;
                              return <Badge variant={atBadge.variant}>{atBadge.label}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell>
                            {record.isPublicHoliday ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant="destructive" className="w-fit">Ya</Badge>
                                {record.publicHolidayName && (
                                  <span className="text-xs text-muted-foreground">{record.publicHolidayName}</span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline">Tidak</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {(record.clockInEvidence || record.clockOutEvidence) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => setSelectedRecord(record)}
                              >
                                <Gallery weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() =>
                                setOverviewTarget({ profileId: record.profile.id, profileName: record.profile.fullName ?? "-" })
                              }
                            >
                              <ChartSquare weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <PermissionGate module="hr-attendance" action="edit">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => setEditTarget(record)}
                                >
                                  <Pen weight="BoldDuotone" className="h-4 w-4" />
                                </Button>
                              </PermissionGate>
                              <PermissionGate module="hr-attendance" action="delete">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                                  onClick={() => setDeleteTarget(record)}
                                >
                                  <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                                </Button>
                              </PermissionGate>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ArrowLeft weight="BoldDuotone" className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ArrowRight weight="BoldDuotone" className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PhotoPreviewModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      <EmployeeOverviewDrawer
        isOpen={!!overviewTarget}
        onClose={() => setOverviewTarget(null)}
        profileName={overviewTarget?.profileName ?? null}
        query={
          overviewTarget
            ? ({ profileId: overviewTarget.profileId, date, month, year } as AttendanceOverviewQuery)
            : null
        }
      />

      <AttendanceEditDialog
        key={editTarget?.id ?? "closed"}
        record={editTarget}
        onClose={() => setEditTarget(null)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Data Kehadiran</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus data kehadiran{" "}
              <span className="font-semibold">{deleteTarget?.profile.fullName ?? "-"}</span> pada tanggal{" "}
              {deleteTarget ? formatDate(deleteTarget.date) : "-"}? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Data Terpilih</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus {selectedIds.length} data kehadiran terpilih? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setBulkDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Menghapus..." : "Hapus Semua"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
