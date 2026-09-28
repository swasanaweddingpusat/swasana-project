"use client";

import { useCallback, useState } from "react";
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
  useMyAttendanceCorrections,
  useCancelAttendanceCorrection,
} from "@/hooks/use-attendance-corrections";
import { CloseCircle, History } from "@solar-icons/react";
import type { AttendanceCorrectionItem } from "@/lib/queries/attendanceCorrections";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function getStatusBadge(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "pending":
      return { label: "Menunggu Manager", variant: "secondary" };
    case "manager_approved":
      return { label: "Menunggu HR", variant: "secondary" };
    case "approved":
      return { label: "Disetujui", variant: "default" };
    case "rejected":
      return { label: "Ditolak", variant: "destructive" };
    case "cancelled":
      return { label: "Dibatalkan", variant: "outline" };
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

function formatTimeShort(date: string | Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function canBeCancelled(request: AttendanceCorrectionItem): boolean {
  return request.status === "pending" || request.status === "manager_approved";
}

export function AttendanceCorrectionHistory() {
  const { data: requests, isLoading } = useMyAttendanceCorrections();
  const cancelMutation = useCancelAttendanceCorrection();

  const [cancelTarget, setCancelTarget] = useState<AttendanceCorrectionItem | null>(null);
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
            toast.success("Pengajuan koreksi absen berhasil dibatalkan");
          } else {
            toast.error(result.error ?? "Gagal membatalkan pengajuan");
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
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <History weight="BoldDuotone" className="h-5 w-5" />
            Riwayat Koreksi Absen
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pantau status pengajuan koreksi absen yang pernah Anda kirim.
          </p>
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
              <History weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada pengajuan koreksi absen</p>
            </div>
          )}

          {!isLoading && requests && requests.length > 0 && (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Clock In Diminta</TableHead>
                    <TableHead>Clock Out Diminta</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const statusBadge = getStatusBadge(req.status);
                    return (
                      <TableRow key={req.id} className="group">
                        <TableCell className="font-medium">{formatDate(req.date)}</TableCell>
                        <TableCell>{formatTimeShort(req.requestedClockInAt)}</TableCell>
                        <TableCell>{formatTimeShort(req.requestedClockOutAt)}</TableCell>
                        <TableCell className="max-w-60 truncate text-sm text-muted-foreground" title={req.reason}>
                          {req.reason}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={statusBadge.variant} className="w-fit rounded-full text-xs">
                              {statusBadge.label}
                            </Badge>
                            {req.status === "rejected" && req.rejectionReason && (
                              <span className="max-w-48 text-xs text-muted-foreground">
                                {req.rejectionReason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {canBeCancelled(req) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setCancelTarget(req)}
                              title="Batalkan"
                            >
                              <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
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

      <Dialog open={cancelTarget !== null} onOpenChange={handleCancelDialogClose}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Batalkan Koreksi Absen</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membatalkan pengajuan koreksi absen tanggal{" "}
              <span className="font-semibold">{cancelTarget && formatDate(cancelTarget.date)}</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="correction-cancel-reason">Alasan Pembatalan (opsional)</Label>
            <Textarea
              id="correction-cancel-reason"
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
              {cancelMutation.isPending ? "Membatalkan..." : "Batalkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
