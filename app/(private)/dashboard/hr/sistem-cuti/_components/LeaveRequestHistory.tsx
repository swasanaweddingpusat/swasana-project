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
import {
  useMyLeaveRequests,
  useCancelLeaveRequest,
} from "@/hooks/use-leave-requests";
import { CloseCircle, CalendarMinimalistic } from "@solar-icons/react";
import type { LeaveRequestItem } from "@/lib/queries/leaveRequests";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function getStatusBadge(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "pending":
      return { label: "Menunggu", variant: "secondary" };
    case "manager_approved":
      return { label: "Disetujui Manager", variant: "outline" };
    case "approved":
      return { label: "Disetujui", variant: "default" };
    case "rejected":
      return { label: "Ditolak", variant: "destructive" };
    case "cancelled":
      return { label: "Dibatalkan", variant: "secondary" };
    default:
      return { label: status, variant: "secondary" };
  }
}

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function canBeCancelled(request: LeaveRequestItem): boolean {
  const cancellableStatuses = ["pending", "manager_approved", "approved"];
  if (!cancellableStatuses.includes(request.status)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(request.startDate);
  return start > today;
}

function getApprovalInfo(request: LeaveRequestItem): string {
  if (request.status === "rejected" && request.rejector) {
    return `Ditolak oleh ${request.rejector.fullName}${request.rejectedAt ? ` (${formatDate(request.rejectedAt)})` : ""}`;
  }
  if (request.hrApprover) {
    return `HR: ${request.hrApprover.fullName}${request.hrApprovedAt ? ` (${formatDate(request.hrApprovedAt)})` : ""}`;
  }
  if (request.managerApprover) {
    return `Manager: ${request.managerApprover.fullName}${request.managerApprovedAt ? ` (${formatDate(request.managerApprovedAt)})` : ""}`;
  }
  if (request.status === "cancelled") {
    return request.cancelledAt ? `Dibatalkan ${formatDate(request.cancelledAt)}` : "Dibatalkan";
  }
  return "-";
}

export function LeaveRequestHistory() {
  const { data: requests, isLoading } = useMyLeaveRequests();
  const cancelMutation = useCancelLeaveRequest();

  const [cancelTarget, setCancelTarget] = useState<LeaveRequestItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const handleCancelConfirm = useCallback(() => {
    if (!cancelTarget) return;
    cancelMutation.mutate(
      {
        requestId: cancelTarget.id,
        reason: cancelReason || undefined,
      },
      {
        onSuccess: (result) => {
          if (result.success) {
            toast.success("Pengajuan cuti berhasil dibatalkan");
          } else {
            toast.error(result.error ?? "Gagal membatalkan cuti");
          }
          setCancelTarget(null);
          setCancelReason("");
        },
        onError: () => {
          toast.error("Terjadi kesalahan");
          setCancelTarget(null);
          setCancelReason("");
        },
      }
    );
  }, [cancelTarget, cancelReason, cancelMutation]);

  const handleCancelDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setCancelTarget(null);
      setCancelReason("");
    }
  }, []);

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Riwayat Pengajuan</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && (!requests || requests.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarMinimalistic
                weight="BoldDuotone"
                className="h-10 w-10 text-muted-foreground/40"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Belum ada pengajuan cuti
              </p>
            </div>
          )}

          {!isLoading && requests && requests.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenis Cuti</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Info Approval</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const statusBadge = getStatusBadge(req.status);
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">
                          {req.leaveType.name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(req.startDate)} - {formatDate(req.endDate)}
                        </TableCell>
                        <TableCell>{req.totalDays}</TableCell>
                        <TableCell>
                          <Badge
                            variant={statusBadge.variant}
                            className="rounded-full text-xs"
                          >
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-48">
                          {getApprovalInfo(req)}
                        </TableCell>
                        <TableCell>
                          {canBeCancelled(req) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setCancelTarget(req)}
                            >
                              <CloseCircle
                                weight="BoldDuotone"
                                className="h-4 w-4"
                              />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={handleCancelDialogClose}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Batalkan Cuti</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membatalkan pengajuan cuti{" "}
              <span className="font-semibold">
                {cancelTarget?.leaveType.name}
              </span>{" "}
              ({cancelTarget && formatDate(cancelTarget.startDate)} -{" "}
              {cancelTarget && formatDate(cancelTarget.endDate)})?
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="cancel-reason">Alasan Pembatalan (opsional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Tulis alasan pembatalan..."
              className="rounded-xl"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setCancelTarget(null)}
              disabled={cancelMutation.isPending}
            >
              Kembali
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleCancelConfirm}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Membatalkan..." : "Batalkan Cuti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
