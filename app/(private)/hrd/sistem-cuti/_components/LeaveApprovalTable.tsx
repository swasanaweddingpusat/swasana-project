"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import {
  usePendingForManager,
  useLeaveRequests,
  useManagerApproveLeave,
  useManagerRejectLeave,
  useHrApproveLeave,
  useHrRejectLeave,
} from "@/hooks/use-leave-requests";
import { CheckCircle, CloseCircle, ClockCircle } from "@solar-icons/react";
import type { LeaveRequestItem } from "@/lib/queries/leaveRequests";

type DialogMode = "approve" | "reject";
type DialogScope = "manager" | "hr";

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function LeaveApprovalTable() {
  const { can } = usePermissions();
  const { data: pendingManager, isLoading: loadingManager } =
    usePendingForManager();
  const { data: pendingHr, isLoading: loadingHr } = useLeaveRequests(
    can("hr-leave", "approve") ? { status: "manager_approved" } : undefined
  );

  const managerApproveMut = useManagerApproveLeave();
  const managerRejectMut = useManagerRejectLeave();
  const hrApproveMut = useHrApproveLeave();
  const hrRejectMut = useHrRejectLeave();

  const [dialogTarget, setDialogTarget] = useState<LeaveRequestItem | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>("approve");
  const [dialogScope, setDialogScope] = useState<DialogScope>("manager");
  const [dialogNote, setDialogNote] = useState("");

  const openDialog = useCallback(
    (request: LeaveRequestItem, mode: DialogMode, scope: DialogScope) => {
      setDialogTarget(request);
      setDialogMode(mode);
      setDialogScope(scope);
      setDialogNote("");
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialogTarget(null);
    setDialogNote("");
  }, []);

  const handleConfirm = useCallback(() => {
    if (!dialogTarget) return;

    if (dialogMode === "reject" && !dialogNote.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }

    if (dialogScope === "manager") {
      if (dialogMode === "approve") {
        managerApproveMut.mutate(
          { requestId: dialogTarget.id, note: dialogNote || undefined },
          {
            onSuccess: (result) => {
              if (result.success) {
                toast.success("Pengajuan berhasil disetujui");
              } else {
                toast.error(result.error ?? "Gagal menyetujui pengajuan");
              }
              closeDialog();
            },
            onError: () => {
              toast.error("Terjadi kesalahan");
              closeDialog();
            },
          }
        );
      } else {
        managerRejectMut.mutate(
          { requestId: dialogTarget.id, reason: dialogNote },
          {
            onSuccess: (result) => {
              if (result.success) {
                toast.success("Pengajuan berhasil ditolak");
              } else {
                toast.error(result.error ?? "Gagal menolak pengajuan");
              }
              closeDialog();
            },
            onError: () => {
              toast.error("Terjadi kesalahan");
              closeDialog();
            },
          }
        );
      }
    } else {
      if (dialogMode === "approve") {
        hrApproveMut.mutate(
          { requestId: dialogTarget.id, note: dialogNote || undefined },
          {
            onSuccess: (result) => {
              if (result.success) {
                toast.success("Pengajuan berhasil disetujui oleh HR");
              } else {
                toast.error(result.error ?? "Gagal menyetujui pengajuan");
              }
              closeDialog();
            },
            onError: () => {
              toast.error("Terjadi kesalahan");
              closeDialog();
            },
          }
        );
      } else {
        hrRejectMut.mutate(
          { requestId: dialogTarget.id, reason: dialogNote },
          {
            onSuccess: (result) => {
              if (result.success) {
                toast.success("Pengajuan berhasil ditolak oleh HR");
              } else {
                toast.error(result.error ?? "Gagal menolak pengajuan");
              }
              closeDialog();
            },
            onError: () => {
              toast.error("Terjadi kesalahan");
              closeDialog();
            },
          }
        );
      }
    }
  }, [
    dialogTarget,
    dialogMode,
    dialogScope,
    dialogNote,
    managerApproveMut,
    managerRejectMut,
    hrApproveMut,
    hrRejectMut,
    closeDialog,
  ]);

  const isMutating =
    managerApproveMut.isPending ||
    managerRejectMut.isPending ||
    hrApproveMut.isPending ||
    hrRejectMut.isPending;

  const showManagerSection =
    pendingManager && pendingManager.length > 0;
  const showHrSection = can("hr-leave", "approve");

  return (
    <>
      <div className="space-y-6">
        {/* Manager Approval Section */}
        {(loadingManager || showManagerSection) && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <ClockCircle weight="BoldDuotone" className="h-5 w-5" />
                Menunggu Persetujuan Anda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingManager && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {!loadingManager && showManagerSection && (
                <ApprovalTableContent
                  requests={pendingManager}
                  scope="manager"
                  onApprove={(req) => openDialog(req, "approve", "manager")}
                  onReject={(req) => openDialog(req, "reject", "manager")}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* HR Approval Section */}
        {showHrSection && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <ClockCircle weight="BoldDuotone" className="h-5 w-5" />
                Menunggu Persetujuan HR
                {pendingHr && pendingHr.length > 0 && (
                  <Badge variant="secondary" className="rounded-full ml-2">
                    {pendingHr.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHr && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {!loadingHr && (!pendingHr || pendingHr.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle
                    weight="BoldDuotone"
                    className="h-10 w-10 text-muted-foreground/40"
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tidak ada pengajuan yang menunggu persetujuan HR
                  </p>
                </div>
              )}

              {!loadingHr && pendingHr && pendingHr.length > 0 && (
                <ApprovalTableContent
                  requests={pendingHr}
                  scope="hr"
                  onApprove={(req) => openDialog(req, "approve", "hr")}
                  onReject={(req) => openDialog(req, "reject", "hr")}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Approve / Reject Dialog */}
      <Dialog
        open={dialogTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {dialogMode === "approve" ? "Setujui Pengajuan" : "Tolak Pengajuan"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "approve"
                ? "Anda akan menyetujui pengajuan cuti berikut."
                : "Anda akan menolak pengajuan cuti berikut."}
              {dialogTarget && (
                <>
                  {" "}
                  <span className="font-semibold">
                    {dialogTarget.profile.fullName}
                  </span>{" "}
                  — {dialogTarget.leaveType.name} (
                  {formatDate(dialogTarget.startDate)} -{" "}
                  {formatDate(dialogTarget.endDate)}, {dialogTarget.totalDays}{" "}
                  hari)
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="dialog-note">
              {dialogMode === "approve"
                ? "Catatan (opsional)"
                : "Alasan Penolakan *"}
            </Label>
            <Textarea
              id="dialog-note"
              value={dialogNote}
              onChange={(e) => setDialogNote(e.target.value)}
              placeholder={
                dialogMode === "approve"
                  ? "Tulis catatan..."
                  : "Tulis alasan penolakan..."
              }
              className="rounded-xl"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={closeDialog}
              disabled={isMutating}
            >
              Batal
            </Button>
            {dialogMode === "approve" ? (
              <Button
                className="rounded-full"
                onClick={handleConfirm}
                disabled={isMutating}
              >
                {isMutating ? "Menyetujui..." : "Setujui"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="rounded-full"
                onClick={handleConfirm}
                disabled={isMutating}
              >
                {isMutating ? "Menolak..." : "Tolak"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Shared approval table content ──────────────────────────────────────────

function ApprovalTableContent({
  requests,
  scope,
  onApprove,
  onReject,
}: {
  requests: LeaveRequestItem[];
  scope: "manager" | "hr";
  onApprove: (req: LeaveRequestItem) => void;
  onReject: (req: LeaveRequestItem) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Karyawan</TableHead>
            <TableHead>Jenis Cuti</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Hari</TableHead>
            <TableHead>Alasan</TableHead>
            {scope === "hr" && <TableHead>Manager</TableHead>}
            <TableHead className="w-32">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((req) => (
            <TableRow key={req.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">
                    {req.profile.fullName}
                  </p>
                  {req.profile.department && (
                    <p className="text-xs text-muted-foreground">
                      {req.profile.department.name}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{req.leaveType.name}</TableCell>
              <TableCell className="text-sm">
                {formatDate(req.startDate)} - {formatDate(req.endDate)}
              </TableCell>
              <TableCell>{req.totalDays}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-40 truncate">
                {req.reason ?? "-"}
              </TableCell>
              {scope === "hr" && (
                <TableCell className="text-xs text-muted-foreground">
                  {req.managerApprover?.fullName ?? "-"}
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-primary hover:text-primary"
                    onClick={() => onApprove(req)}
                    title="Setujui"
                  >
                    <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                    onClick={() => onReject(req)}
                    title="Tolak"
                  >
                    <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
