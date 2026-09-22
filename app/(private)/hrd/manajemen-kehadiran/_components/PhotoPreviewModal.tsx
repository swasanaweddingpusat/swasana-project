"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera } from "@solar-icons/react";
import type { AttendanceListItem } from "@/lib/queries/attendance";
import type { FileDescriptor } from "@/lib/validations/common";
import { resolveAttendancePhotoUrl } from "@/lib/attendance-photo";

interface PhotoPreviewModalProps {
  record: AttendanceListItem | null;
  onClose: () => void;
}

export function PhotoPreviewModal({ record, onClose }: PhotoPreviewModalProps) {
  const clockInUrl = resolveAttendancePhotoUrl((record?.clockInEvidence ?? null) as FileDescriptor | null);
  const clockOutUrl = resolveAttendancePhotoUrl((record?.clockOutEvidence ?? null) as FileDescriptor | null);

  return (
    <Dialog open={!!record} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera weight="BoldDuotone" className="h-5 w-5" />
            Foto Absensi — {record?.profile.fullName ?? ""}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground text-center">Clock In</p>
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted">
              {clockInUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clockInUrl}
                  alt="Clock in selfie"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-muted-foreground">Tidak ada foto</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground text-center">Clock Out</p>
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-muted">
              {clockOutUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clockOutUrl}
                  alt="Clock out selfie"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-muted-foreground">Tidak ada foto</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
