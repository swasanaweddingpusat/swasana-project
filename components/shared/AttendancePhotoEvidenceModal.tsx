"use client";

import type { Prisma } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gallery } from "@solar-icons/react";
import type { FileDescriptor } from "@/lib/validations/common";
import { resolveAttendancePhotoUrl } from "@/lib/attendance-photo";

interface AttendancePhotoEvidenceModalProps {
  evidence: FileDescriptor | Prisma.JsonValue | null | undefined;
  title?: string;
  onClose: () => void;
}

export function AttendancePhotoEvidenceModal({
  evidence,
  title,
  onClose,
}: AttendancePhotoEvidenceModalProps) {
  const url = resolveAttendancePhotoUrl((evidence ?? null) as FileDescriptor | null);

  return (
    <Dialog open={evidence !== null && evidence !== undefined} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gallery weight="BoldDuotone" className="h-5 w-5" />
            {title ?? "Bukti Absen"}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl bg-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Bukti absen" className="max-h-[70vh] w-full object-contain" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center">
              <p className="text-xs text-muted-foreground">Tidak ada bukti</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
