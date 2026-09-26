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
  useMyAttendanceCorrections,
  useCancelAttendanceCorrection,
} from "@/hooks/use-attendance-corrections";
import { CloseCircle, History2, Gallery } from "@solar-icons/react";
import type { AttendanceCorrectionItem } from "@/lib/queries/attendanceCorrections";
import { AttendancePhotoEvidenceModal } from "@/components/shared/AttendancePhotoEvidenceModal";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function getStatusBadge(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "pending":
      return { label: "Menunggu HRD", variant: "secondary" };
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

function getTypeLabel(type: string): string {
  switch (type) {
    case "CLOCK_IN":
      return "Clock In";
    case "CLOCK_OUT":
      return "Clock Out";
    case "BOTH":
      return "Clock In & Out";
    default:
      return type;
  }
}

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string | Date | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReviewInfo(correction: AttendanceCorrectionItem): string {
  if (correction.status === "rejected" && correction.reviewer) {
    return `Ditolak oleh ${correction.reviewer.fullName}${correction.reviewNote ? `: ${correction.reviewNote}` : ""}`;
  }
  if (correction.status === "approved" && correction.reviewer) {
    return `Disetujui oleh ${correction.reviewer.fullName}`;
  }
  if (correction.status === "cancelled") {
    return correction.cancelledAt ? `Dibatalkan ${formatDate(correction.cancelledAt)}` : "Dibatalkan";
  }
  if (correction.status === "pending") return "Menunggu persetujuan HRD";
  return "-";
}

function canBeCancelled(correction: AttendanceCorrectionItem): boolean {
  return correction.status === "pending";
}

export function AttendanceCorrectionHistory() {
  const { data: corrections, isLoading } = useMyAttendanceCorrections();
  const cancelMutation = useCancelAttendanceCorrection();

  const [cancelTarget, setCancelTarget] = useState<AttendanceCorrectionItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [evidenceTarget, setEvidenceTarget] = useState<AttendanceCorrectionItem | null>(null);

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
      },
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
          <CardTitle className="font-heading text-lg">Riwayat Koreksi Absen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Lihat status pengajuan koreksi absen yang pernah Anda kirim.
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

          {!isLoading && (!corrections || corrections.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History2 weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Belum ada pengajuan koreksi absen</p>
            </div>
          )}

          {!isLoading && corrections && corrections.length > 0 && (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Jam Diajukan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Info</TableHead>
                    <TableHead className="w-16">Bukti</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((c) => {
                    const statusBadge = getStatusBadge(c.status);
                    return (
                      <TableRow key={c.id} className="group">
                        <TableCell className="text-sm">{formatDate(c.date)}</TableCell>
                        <TableCell className="font-medium">{getTypeLabel(c.type)}</TableCell>
                        <TableCell className="text-sm">
                          {c.requestedClockInAt && `Masuk ${formatTime(c.requestedClockInAt)}`}
                          {c.requestedClockInAt && c.requestedClockOutAt && " / "}
                          {c.requestedClockOutAt && `Keluar ${formatTime(c.requestedClockOutAt)}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadge.variant} className="rounded-full text-xs">
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-48">
                          {getReviewInfo(c)}
                        </TableCell>
                        <TableCell>
                          {c.evidence && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => setEvidenceTarget(c)}
                              title="Lihat bukti"
                            >
                              <Gallery weight="BoldDuotone" className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {canBeCancelled(c) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                              onClick={() => setCancelTarget(c)}
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
            <Label htmlFor="cancel-correction-reason">Alasan Pembatalan (opsional)</Label>
            <Textarea
              id="cancel-correction-reason"
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

      <AttendancePhotoEvidenceModal
        evidence={evidenceTarget?.evidence}
        title={evidenceTarget ? `Bukti Koreksi Absen — ${formatDate(evidenceTarget.date)}` : undefined}
        onClose={() => setEvidenceTarget(null)}
      />
    </>
  );
}
