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
  useAttendanceCorrections,
  useHrApproveAttendanceCorrection,
  useHrRejectAttendanceCorrection,
} from "@/hooks/use-attendance-corrections";
import { CheckCircle, CloseCircle, ClipboardCheck, Gallery } from "@solar-icons/react";
import type { AttendanceCorrectionItem } from "@/lib/queries/attendanceCorrections";
import { AttendancePhotoEvidenceModal } from "@/components/shared/AttendancePhotoEvidenceModal";

type DialogMode = "approve" | "reject";

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

export function AttendanceCorrectionQueue() {
  const { can } = usePermissions();
  const canApprove = can("hr-attendance", "approve");

  const { data: pending, isLoading } = useAttendanceCorrections(
    canApprove ? { status: "pending" } : undefined,
  );

  const approveMut = useHrApproveAttendanceCorrection();
  const rejectMut = useHrRejectAttendanceCorrection();

  const [dialogTarget, setDialogTarget] = useState<AttendanceCorrectionItem | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>("approve");
  const [dialogNote, setDialogNote] = useState("");
  const [evidenceTarget, setEvidenceTarget] = useState<AttendanceCorrectionItem | null>(null);

  const openDialog = useCallback((correction: AttendanceCorrectionItem, mode: DialogMode) => {
    setDialogTarget(correction);
    setDialogMode(mode);
    setDialogNote("");
  }, []);

  const closeDialog = useCallback(() => {
    setDialogTarget(null);
    setDialogNote("");
  }, []);

  const isMutating = approveMut.isPending || rejectMut.isPending;

  const handleConfirm = useCallback(() => {
    if (!dialogTarget) return;

    if (dialogMode === "reject" && !dialogNote.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }

    if (dialogMode === "approve") {
      approveMut.mutate(
        { requestId: dialogTarget.id, note: dialogNote || undefined },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Koreksi absen berhasil disetujui");
            } else {
              toast.error(result.error ?? "Gagal menyetujui koreksi absen");
            }
            closeDialog();
          },
          onError: () => {
            toast.error("Terjadi kesalahan");
            closeDialog();
          },
        },
      );
    } else {
      rejectMut.mutate(
        { requestId: dialogTarget.id, reason: dialogNote },
        {
          onSuccess: (result) => {
            if (result.success) {
              toast.success("Koreksi absen berhasil ditolak");
            } else {
              toast.error(result.error ?? "Gagal menolak koreksi absen");
            }
            closeDialog();
          },
          onError: () => {
            toast.error("Terjadi kesalahan");
            closeDialog();
          },
        },
      );
    }
  }, [dialogTarget, dialogMode, dialogNote, approveMut, rejectMut, closeDialog]);

  if (!canApprove) return null;

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <ClipboardCheck weight="BoldDuotone" className="h-5 w-5" />
            Persetujuan Koreksi Absen
            {pending && pending.length > 0 && (
              <Badge variant="secondary" className="rounded-full ml-2">
                {pending.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {!isLoading && (!pending || pending.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Tidak ada pengajuan koreksi absen yang menunggu persetujuan
              </p>
            </div>
          )}

          {!isLoading && pending && pending.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead className="w-32">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{c.profile.fullName}</p>
                          {c.profile.department && (
                            <p className="text-xs text-muted-foreground">{c.profile.department.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(c.date)}</TableCell>
                      <TableCell className="text-sm">{getTypeLabel(c.type)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.requestedClockInAt && (
                          <p>
                            Masuk {formatTime(c.requestedClockInAt)}
                            {c.workShift ? ` · ${c.workShift.name}` : ""}
                          </p>
                        )}
                        {c.requestedClockOutAt && <p>Keluar {formatTime(c.requestedClockOutAt)}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-40 truncate">
                        {c.reason}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-primary hover:text-primary"
                            onClick={() => openDialog(c, "approve")}
                            title="Setujui"
                          >
                            <CheckCircle weight="BoldDuotone" className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                            onClick={() => openDialog(c, "reject")}
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
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {dialogMode === "approve" ? "Setujui Koreksi Absen" : "Tolak Koreksi Absen"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "approve"
                ? "Anda akan menyetujui pengajuan koreksi absen berikut."
                : "Anda akan menolak pengajuan koreksi absen berikut."}
              {dialogTarget && (
                <>
                  {" "}
                  <span className="font-semibold">{dialogTarget.profile.fullName}</span> —{" "}
                  {getTypeLabel(dialogTarget.type)} ({formatDate(dialogTarget.date)})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="correction-dialog-note">
              {dialogMode === "approve" ? "Catatan (opsional)" : "Alasan Penolakan *"}
            </Label>
            <Textarea
              id="correction-dialog-note"
              value={dialogNote}
              onChange={(e) => setDialogNote(e.target.value)}
              placeholder={dialogMode === "approve" ? "Tulis catatan..." : "Tulis alasan penolakan..."}
              className="rounded-xl"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={closeDialog} disabled={isMutating}>
              Batal
            </Button>
            {dialogMode === "approve" ? (
              <Button className="rounded-full" onClick={handleConfirm} disabled={isMutating}>
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

      <AttendancePhotoEvidenceModal
        evidence={evidenceTarget?.evidence}
        title={evidenceTarget ? `Bukti Koreksi Absen — ${evidenceTarget.profile.fullName}` : undefined}
        onClose={() => setEvidenceTarget(null)}
      />
    </>
  );
}
